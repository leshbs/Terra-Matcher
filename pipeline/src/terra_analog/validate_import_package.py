"""Read-only checks of the current MVP package; no database access."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any

from terra_analog.ranking import ecdf_midrank, score_candidate

RUN_ID = "2026-11-14-mvp-v1"
WEIGHTS = {
    "median_slope_deg": 0.35,
    "terrain_roughness_m": 0.35,
    "relative_relief_m": 0.30,
}
FILES = (
    "candidates.geojson",
    "location-evidence.json",
    "location-features.json",
    "model_manifest.json",
    "processing-report.json",
    "ranking-contributions.json",
    "rankings.json",
    "study-population-features.json",
    "validation-report.json",
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def number(value: Any) -> float:
    require(
        type(value) in (int, float) and math.isfinite(value),
        f"Expected finite number, received {value!r}",
    )
    return float(value)


def close(actual: Any, expected: float, label: str) -> None:
    require(
        math.isclose(number(actual), expected, rel_tol=0, abs_tol=1e-6),
        f"{label}: received {actual!r}, expected {expected!r}",
    )


def unique_index(rows: list, fields: tuple[str, ...]) -> dict:
    require(isinstance(rows, list), "Expected a record list")
    result = {}
    for row in rows:
        key = tuple(row[field] for field in fields)
        require(key not in result, f"Duplicate record: {key}")
        result[key] = row
    return result


def validate_study_population(
    document: dict[str, Any],
    locations: dict,
    transforms: dict,
) -> None:
    """Check internal sample consistency, not raster extraction correctness."""
    rows = document["features"]
    index = unique_index(rows, ("locationId", "featureKey"))
    require(len(index) == 450, "Study population: expected 450 records")

    samples_by_parent = {parent: set() for parent in locations}
    values_by_transform = {key: [] for key in transforms}
    sources_by_transform = {key: set() for key in transforms}
    sample_parents = {}

    for (sample_id, key), row in index.items():
        parent_id = row["parentLocationId"]
        require(parent_id in locations, "Study population: unknown parent")
        require(key in WEIGHTS, "Study population: unexpected feature key")
        require(
            isinstance(sample_id, str) and bool(sample_id),
            "Study population: invalid sample ID",
        )
        require(
            row["studyPopulationId"] == sample_id,
            "Study population: sample identity mismatch",
        )
        require(
            sample_id not in sample_parents
            or sample_parents[sample_id] == parent_id,
            "Study population: sample assigned to multiple parents",
        )
        sample_parents[sample_id] = parent_id
        samples_by_parent[parent_id].add(sample_id)

        raw = number(row["rawValue"])
        require(raw >= 0, "Study population: negative raw value")
        if key == "median_slope_deg":
            require(raw <= 90, "Study population: slope exceeds 90 degrees")
        require(
            row["qualityFlag"] == "source-backed-derived",
            "Study population: unsupported quality flag for this MVP",
        )
        close(row["coverage"], 1, "Study population: extraction coverage")
        close(row["analysisResolutionM"], 500, "Study population: resolution")
        close(row["localWindowKm"], 3, "Study population: local window")

        source_id = row["sourceDatasetId"]
        require(
            isinstance(source_id, str) and bool(source_id),
            "Study population: invalid source dataset ID",
        )
        body = locations[parent_id]["body"]
        transform_id = f"{body}:{key}"
        values_by_transform[transform_id].append(raw)
        sources_by_transform[transform_id].add(source_id)

    require(
        all(len(samples) == 25 for samples in samples_by_parent.values()),
        "Study population: expected 25 samples per parent",
    )
    require(
        set(index) == {
            (sample_id, key)
            for samples in samples_by_parent.values()
            for sample_id in samples
            for key in WEIGHTS
        },
        "Study population: expected three features per sample",
    )

    for transform_id, transform in transforms.items():
        require(
            sorted(values_by_transform[transform_id])
            == transform["sortedRawValues"],
            f"{transform_id}: study population differs from manifest samples",
        )
        require(
            sorted(sources_by_transform[transform_id])
            == transform["sourceDatasetIds"],
            f"{transform_id}: study population source IDs differ from manifest",
        )


def validate_package(root: Path) -> dict[str, Any]:
    """Fail on the first core error; keep missing enrichment as a warning."""
    documents = {}
    hashes = {}
    for name in FILES:
        content = (root / name).read_bytes()
        hashes[name] = hashlib.sha256(content).hexdigest()
        documents[name] = json.loads(content.decode("utf-8-sig"))
        require(isinstance(documents[name], dict), f"{name}: expected object")
        if name != "candidates.geojson":
            require(
                documents[name].get("modelRunId") == RUN_ID,
                f"{name}: missing or unexpected modelRunId",
            )

    geojson = documents["candidates.geojson"]
    require(geojson.get("type") == "FeatureCollection", "Invalid GeoJSON type")
    locations = {}
    for feature in geojson["features"]:
        require(feature.get("type") == "Feature", "Invalid GeoJSON feature")
        properties = feature["properties"]
        location_id = properties["id"]
        require(location_id not in locations, "Duplicate GeoJSON location ID")
        require(properties["modelRunId"] == RUN_ID, "GeoJSON run mismatch")
        geometry = feature["geometry"]
        require(geometry["type"] == "Point", "Expected Point geometry")
        coordinates = geometry["coordinates"]
        require(len(coordinates) == 2, "Expected longitude and latitude")
        longitude, latitude = map(number, coordinates)
        require(
            -180 <= longitude <= 180 and -90 <= latitude <= 90,
            f"{location_id}: coordinates outside permitted bounds",
        )
        locations[location_id] = properties

    references = [
        key for key, row in locations.items()
        if row["kind"] == "reference-scenario"
    ]
    candidates = [
        key for key, row in locations.items() if row["kind"] == "candidate"
    ]
    require(
        len(locations) == 6 and len(references) == 1 and len(candidates) == 5,
        "Expected one reference and five candidates",
    )
    reference_id = references[0]
    require(locations[reference_id]["body"] == "mars", "Reference must be Mars")
    require(
        all(locations[key]["body"] == "earth" for key in candidates),
        "Candidates must be Earth locations",
    )

    transforms = documents["model_manifest.json"]["transforms"]
    require(
        set(transforms) == {
            f"{body}:{key}" for body in ("mars", "earth") for key in WEIGHTS
        },
        "Expected six body-specific transforms",
    )
    for transform_id, transform in transforms.items():
        body, key = transform_id.split(":")
        values = [number(value) for value in transform["sortedRawValues"]]
        expected_count = 25 if body == "mars" else 125
        require(
            len(values) == expected_count
            and transform["sampleCount"] == expected_count,
            f"{transform_id}: unexpected sample count",
        )
        require(values == sorted(values), f"{transform_id}: unsorted values")
        require(
            transform["body"] == body
            and transform["featureKey"] == key
            and transform["modelRunId"] == RUN_ID
            and transform["transformationVersion"] == "ecdf-midrank-v1",
            f"{transform_id}: metadata mismatch",
        )
        close(transform["analysisResolutionM"], 500, transform_id)
        close(transform["localWindowKm"], 3, transform_id)

    validate_study_population(
        documents["study-population-features.json"], locations, transforms
    )

    feature_rows = documents["location-features.json"]["features"]
    features = unique_index(feature_rows, ("locationId", "featureKey"))
    require(
        set(features) == {
            (location_id, key) for location_id in locations for key in WEIGHTS
        },
        "Expected exactly three features for each of six locations",
    )
    profiles = {location_id: {} for location_id in locations}
    missing_normalized = 0
    for (location_id, key), feature in features.items():
        raw = number(feature["rawValue"])
        require(raw >= 0, f"{location_id}/{key}: negative raw value")
        if key == "median_slope_deg":
            require(raw <= 90, f"{location_id}: slope exceeds 90 degrees")
        require(
            feature["qualityFlag"] == "source-backed-derived",
            f"{location_id}/{key}: unsupported quality flag for this MVP",
        )
        close(feature["coverage"], 1, f"{location_id}/{key}: extraction coverage")
        close(feature["analysisResolutionM"], 500, f"{location_id}/{key}")
        close(feature["localWindowKm"], 3, f"{location_id}/{key}")
        body = locations[location_id]["body"]
        values = transforms[f"{body}:{key}"]["sortedRawValues"]
        normalized = ecdf_midrank(raw, values)
        if "normalizedValue" in feature:
            close(feature["normalizedValue"], normalized, f"{location_id}/{key}")
        else:
            missing_normalized += 1
        profiles[location_id][key] = {
            **feature,
            "normalizedValue": normalized,
        }

    ranking_rows = documents["rankings.json"]["rankings"]
    rankings = unique_index(ranking_rows, ("candidateLocationId",))
    require(
        set(rankings) == {(key,) for key in candidates},
        "Ranking candidate IDs do not match GeoJSON",
    )
    contribution_rows = documents["ranking-contributions.json"]["contributions"]
    contributions = unique_index(
        contribution_rows, ("candidateLocationId", "featureKey")
    )
    require(
        set(contributions) == {
            (candidate_id, key) for candidate_id in candidates for key in WEIGHTS
        },
        "Expected exactly three contributions for each candidate",
    )
    preview = []
    for candidate_id in candidates:
        ranking = rankings[(candidate_id,)]
        require(
            ranking["modelRunId"] == RUN_ID
            and ranking["referenceLocationId"] == reference_id,
            f"{candidate_id}: ranking metadata mismatch",
        )
        score, coverage, computed = score_candidate(
            profiles[reference_id], profiles[candidate_id], WEIGHTS
        )
        close(ranking["similarityScore"], round(score, 6), f"{candidate_id}: score")
        close(ranking["dataCoverage"], coverage, f"{candidate_id}: weight coverage")
        properties = locations[candidate_id]
        for field in ("similarityScore", "dataCoverage"):
            require(
                field in properties,
                f"{candidate_id}: GeoJSON missing {field}",
            )
            close(
                properties[field],
                number(ranking[field]),
                f"{candidate_id}: GeoJSON {field}",
            )
        for expected in computed:
            key = expected["featureKey"]
            actual = contributions[(candidate_id, key)]
            require(
                actual["modelRunId"] == RUN_ID
                and actual["referenceLocationId"] == reference_id
                and actual["available"] is True,
                f"{candidate_id}/{key}: contribution metadata mismatch",
            )
            for field in (
                "referenceRawValue", "candidateRawValue",
                "referenceNormalizedValue", "candidateNormalizedValue",
                "featureDistance", "normalizedWeight", "weightedContribution",
            ):
                close(actual[field], expected[field], f"{candidate_id}/{key}/{field}")
        preview.append({
            "candidateId": candidate_id,
            "name": locations[candidate_id]["name"],
            "pipelineScore": ranking["similarityScore"],
            "databaseScorePreview": number(ranking["similarityScore"]) / 100,
        })

    preview.sort(key=lambda row: (-row["pipelineScore"], row["candidateId"]))
    for rank, row in enumerate(preview, start=1):
        candidate_id = row["candidateId"]
        declared_rank = rankings[(candidate_id,)]["rank"]
        require(
            type(declared_rank) is int and declared_rank == rank,
            f"{candidate_id}: incorrect rank",
        )
        geojson_rank = locations[candidate_id].get("rank")
        require(
            type(geojson_rank) is int and geojson_rank == declared_rank,
            f"{candidate_id}: incorrect GeoJSON rank",
        )

    warnings = []
    if missing_normalized:
        warnings.append(
            f"{missing_normalized}/18 feature records lack normalizedValue; "
            "recomputed in memory only. Original files were not modified."
        )
    return {
        "coreChecks": "passed",
        "modelRunId": RUN_ID,
        "publicationReadiness": "not_assessed",
        "warnings": warnings,
        "notVerified": [
            "Raw raster integrity or extraction correctness.",
            "Official handoff, execution commit, model version or generation time.",
            "Detailed evidence, source provenance and processing-report contents.",
            "GeoJSON strongest/largest match properties against evidence.",
            "Study-grid offsets, sample positions or detailed extraction methods.",
            "Scientific validity or operational suitability of locations.",
        ],
        "fileSha256": hashes,
        "preview": preview,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        report = validate_package(args.package_dir)
    except (OSError, ValueError, KeyError, TypeError, IndexError) as exc:
        print(json.dumps({
            "coreChecks": "failed",
            "publicationReadiness": "not_assessed",
            "error": str(exc),
        }, indent=2))
        return 1
    print(json.dumps(report, indent=2, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())