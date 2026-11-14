"""Build local-population terrain transforms and Earth candidate rankings."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from collections.abc import Callable
from pathlib import Path
from typing import Any

from terra_analog.ranking import fit_ecdf, normalise_features, score_candidate
from terra_analog.run_training_features import (
    ANALYSIS_RESOLUTION_M,
    LOCAL_WINDOW_KM,
    MODEL_RUN_ID,
    build_location_feature_records,
    offset_location,
)
from terra_analog.source_rasters import MolaRaster, NasademCatalog


FEATURE_WEIGHTS = {
    "median_slope_deg": 0.35,
    "terrain_roughness_m": 0.35,
    "relative_relief_m": 0.30,
}
OFFSETS_KM = (-8.0, -4.0, 0.0, 4.0, 8.0)
STUDY_RADIUS_M = 3_000
TRANSFORMATION_VERSION = "ecdf-midrank-v1"
APPROVAL_LIMITATION = "This is a data-derived terrain-similarity result, not mission-site approval."


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _study_locations(location: dict[str, Any]) -> list[dict[str, Any]]:
    samples = []
    for north_km in OFFSETS_KM:
        for east_km in OFFSETS_KM:
            sample = offset_location(location, east_km=east_km, north_km=north_km)
            sample["id"] = f"{location['id']}:study:e{east_km:g}:n{north_km:g}"
            sample["parentLocationId"] = location["id"]
            sample["offsetEastKm"] = east_km
            sample["offsetNorthKm"] = north_km
            samples.append(sample)
    return samples


def _source_samplers(training_root: Path) -> tuple[MolaRaster, NasademCatalog]:
    raw_root = training_root / "raw"
    return (
        MolaRaster.from_files(raw_root / "mars" / "megt00n090hb.img", raw_root / "mars" / "megt00n090hb.hdr"),
        NasademCatalog(raw_root / "earth"),
    )


def _group_features(features: list[dict[str, Any]]) -> dict[str, dict[str, dict[str, Any]]]:
    grouped: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for feature in features:
        grouped[str(feature["locationId"])][str(feature["featureKey"])] = feature
    return dict(grouped)


def _build_manifest(study_features: list[dict[str, Any]], locations_by_id: dict[str, dict[str, Any]]) -> dict[str, Any]:
    values: dict[tuple[str, str], list[float]] = defaultdict(list)
    source_ids: dict[tuple[str, str], set[str]] = defaultdict(set)
    for feature in study_features:
        parent = locations_by_id[str(feature["parentLocationId"])]
        if feature["qualityFlag"] != "invalid" and isinstance(feature["rawValue"], (int, float)):
            key = (str(parent["body"]), str(feature["featureKey"]))
            values[key].append(float(feature["rawValue"]))
            source_ids[key].add(str(feature["sourceDatasetId"]))
    transforms: dict[str, dict[str, Any]] = {}
    for body in ("mars", "earth"):
        for feature_key in FEATURE_WEIGHTS:
            key = (body, feature_key)
            sorted_values = fit_ecdf(values[key])
            if not sorted_values:
                raise ValueError(f"no valid study values for {body}:{feature_key}")
            transforms[f"{body}:{feature_key}"] = {
                "body": body,
                "featureKey": feature_key,
                "sampleCount": len(sorted_values),
                "sortedRawValues": list(sorted_values),
                "sourceDatasetIds": sorted(source_ids[key]),
                "modelRunId": MODEL_RUN_ID,
                "transformationVersion": TRANSFORMATION_VERSION,
                "analysisResolutionM": ANALYSIS_RESOLUTION_M,
                "localWindowKm": LOCAL_WINDOW_KM,
            }
    return {"modelRunId": MODEL_RUN_ID, "transforms": transforms}


def _normalise_display_features(features: list[dict[str, Any]], locations_by_id: dict[str, dict[str, Any]], manifest: dict[str, Any]) -> list[dict[str, Any]]:
    by_body: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for feature in features:
        by_body[str(locations_by_id[str(feature["locationId"])]["body"])].append(feature)
    result: list[dict[str, Any]] = []
    for body, body_features in by_body.items():
        transforms = {
            key: manifest["transforms"][f"{body}:{key}"]["sortedRawValues"]
            for key in FEATURE_WEIGHTS
        }
        result.extend(normalise_features(body_features, transforms))
    return result


def _evidence(location: dict[str, Any], ranking: dict[str, Any], contributions: list[dict[str, Any]]) -> dict[str, Any]:
    available = [row for row in contributions if row["available"]]
    strongest = min(available, key=lambda row: row["weightedContribution"])
    mismatch = max(available, key=lambda row: row["weightedContribution"])
    return {
        "modelRunId": MODEL_RUN_ID,
        "locationId": location["id"],
        "operationalHypothesis": location["operationalHypothesis"],
        "limitations": [*location["limitations"], APPROVAL_LIMITATION],
        "sourceDatasetIds": ranking["sourceDatasetIds"],
        "strongestMatch": {"featureKey": strongest["featureKey"], "weightedContribution": strongest["weightedContribution"]},
        "largestMismatch": {"featureKey": mismatch["featureKey"], "weightedContribution": mismatch["weightedContribution"]},
    }


def _validate_outputs(outputs: dict[str, Any]) -> dict[str, Any]:
    rankings = outputs["rankings"]
    contributions = outputs["contributions"]
    if len(rankings) != 5 or len(contributions) != 15:
        raise ValueError("expected five rankings and three contributions per candidate")
    for ranking in rankings:
        if not ranking["modelRunId"] or not ranking["sourceDatasetIds"]:
            raise ValueError("ranking is missing provenance")
        if not 0.0 <= ranking["similarityScore"] <= 100.0 or ranking["dataCoverage"] <= 0.0:
            raise ValueError("ranking score or coverage is invalid")
    if len(outputs["manifest"]["transforms"]) != 6:
        raise ValueError("missing normalisation transform")
    return {
        "modelRunId": MODEL_RUN_ID,
        "status": "passed",
        "rankings": len(rankings),
        "contributions": len(contributions),
        "transforms": len(outputs["manifest"]["transforms"]),
    }


def build_ranked_outputs(
    training_root: Path,
    study_feature_builder: Callable[[dict[str, Any], Any, int], list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    """Generate ranked output JSON from local source rasters or an injected test builder."""
    training_root = Path(training_root)
    locations = _read_json(training_root / "locations.json")["locations"]
    locations_by_id = {location["id"]: location for location in locations}
    output_root = training_root / "processed" / MODEL_RUN_ID
    display_features = _read_json(output_root / "location-features.json")["features"]
    mars_sampler, earth_sampler = _source_samplers(training_root) if study_feature_builder is None else (None, None)

    study_features: list[dict[str, Any]] = []
    for location in locations:
        sampler = mars_sampler if location["body"] == "mars" else earth_sampler
        for study_location in _study_locations(location):
            records = (
                build_location_feature_records(study_location, sampler, radius_m=STUDY_RADIUS_M)
                if study_feature_builder is None
                else study_feature_builder(study_location, sampler, STUDY_RADIUS_M)
            )
            for record in records:
                record = dict(record)
                record["studyPopulationId"] = study_location["id"]
                record["parentLocationId"] = location["id"]
                record["offsetEastKm"] = study_location["offsetEastKm"]
                record["offsetNorthKm"] = study_location["offsetNorthKm"]
                study_features.append(record)

    manifest = _build_manifest(study_features, locations_by_id)
    enriched_features = _normalise_display_features(display_features, locations_by_id, manifest)
    grouped = _group_features(enriched_features)
    reference = next(location for location in locations if location["kind"] == "reference-scenario")
    candidates = [location for location in locations if location["kind"] == "candidate"]
    rankings: list[dict[str, Any]] = []
    contributions: list[dict[str, Any]] = []
    evidence: list[dict[str, Any]] = []
    for candidate in candidates:
        score, coverage, candidate_contributions = score_candidate(grouped[reference["id"]], grouped[candidate["id"]], FEATURE_WEIGHTS)
        source_ids = sorted({record["sourceDatasetId"] for record in [*grouped[reference["id"]].values(), *grouped[candidate["id"]].values()]})
        ranking = {
            "modelRunId": MODEL_RUN_ID,
            "referenceLocationId": reference["id"],
            "candidateLocationId": candidate["id"],
            "similarityScore": round(score, 6),
            "dataCoverage": round(coverage, 6),
            "sourceDatasetIds": source_ids,
        }
        for contribution in candidate_contributions:
            contribution["modelRunId"] = MODEL_RUN_ID
            contribution["candidateLocationId"] = candidate["id"]
            contribution["referenceLocationId"] = reference["id"]
        rankings.append(ranking)
        contributions.extend(candidate_contributions)
        evidence.append(_evidence(candidate, ranking, candidate_contributions))
    rankings.sort(key=lambda row: (-row["similarityScore"], row["candidateLocationId"]))
    for index, ranking in enumerate(rankings, start=1):
        ranking["rank"] = index
    outputs = {"studyFeatures": study_features, "manifest": manifest, "features": enriched_features, "rankings": rankings, "contributions": contributions, "evidence": evidence}
    validation = _validate_outputs(outputs)
    _write_json(output_root / "study-population-features.json", {"modelRunId": MODEL_RUN_ID, "features": study_features})
    _write_json(output_root / "model_manifest.json", manifest)
    _write_json(output_root / "location-features.json", {"modelRunId": MODEL_RUN_ID, "features": enriched_features})
    _write_json(output_root / "rankings.json", {"modelRunId": MODEL_RUN_ID, "rankings": rankings})
    _write_json(output_root / "ranking-contributions.json", {"modelRunId": MODEL_RUN_ID, "contributions": contributions})
    _write_json(output_root / "location-evidence.json", {"modelRunId": MODEL_RUN_ID, "evidence": evidence})
    _write_json(output_root / "validation-report.json", validation)
    outputs["validation"] = validation
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--training-root", type=Path, required=True)
    arguments = parser.parse_args()
    outputs = build_ranked_outputs(arguments.training_root)
    print(json.dumps(outputs["validation"], sort_keys=True))


if __name__ == "__main__":
    main()
