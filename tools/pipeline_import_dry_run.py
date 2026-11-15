"""Read-only mapping preview. No database client, credentials, or file writes."""
import argparse
import copy
import json
import math
import sys
import unittest
from pathlib import Path

RUN_ID = "2026-11-14-mvp-v1"
SCENARIO_ID = "mars-gale-aeolis-palus-v1"
UNITS = {
    "median_slope_deg": "degrees",
    "terrain_roughness_m": "m",
    "relative_relief_m": "m",
}

def require(condition, message):
    if not condition:
        raise ValueError(message)

def number(value, label, low, high=None):
    require(
        type(value) in (int, float) and math.isfinite(value),
        f"{label}: expected a finite number",
    )
    require(value >= low, f"{label}: below minimum")
    require(high is None or value <= high, f"{label}: above maximum")
    return value

def text(value, label):
    require(isinstance(value, str) and bool(value.strip()), f"{label}: empty text")
    return value

def datasets(value):
    require(isinstance(value, list) and bool(value), "Missing dataset IDs")
    for item in value:
        text(item, "dataset ID")
    require(len(set(value)) == len(value), "Duplicate dataset IDs")
    return set(value)

def build_preview(rankings, features, geojson):
    require(rankings.get("modelRunId") == RUN_ID, "Ranking run mismatch")
    require(features.get("modelRunId") == RUN_ID, "Feature run mismatch")
    require(geojson.get("type") == "FeatureCollection", "Invalid GeoJSON type")

    ranking_rows = rankings.get("rankings")
    feature_rows = features.get("features")
    geo_rows = geojson.get("features")
    require(isinstance(ranking_rows, list) and bool(ranking_rows), "No rankings")
    require(isinstance(feature_rows, list), "Missing feature list")
    require(isinstance(geo_rows, list), "Missing GeoJSON feature list")

    locations = {}
    for row in geo_rows:
        require(row.get("type") == "Feature", "Invalid GeoJSON feature")
        props = row["properties"]
        location_id = text(props.get("id"), "location ID")
        require(location_id not in locations, "Duplicate location ID")
        require(props.get("modelRunId") == RUN_ID, "GeoJSON run mismatch")
        text(props.get("name"), "location name")
        datasets(props.get("datasetIds"))
        geometry = row["geometry"]
        require(geometry.get("type") == "Point", "Expected Point geometry")
        coords = geometry.get("coordinates")
        require(isinstance(coords, list) and len(coords) == 2, "Invalid coordinates")
        number(coords[0], "longitude", -180, 180)
        number(coords[1], "latitude", -90, 90)
        locations[location_id] = row

    require(SCENARIO_ID in locations, "Missing reference location")
    reference = locations[SCENARIO_ID]["properties"]
    require(
        reference.get("kind") == "reference-scenario"
        and reference.get("body") == "mars",
        "Invalid reference location",
    )
    reference_sources = datasets(reference["datasetIds"])

    values = {}
    for row in feature_rows:
        location_id = row["locationId"]
        key = row["featureKey"]
        require(location_id in locations, "Feature references unknown location")
        require(key in UNITS, "Unexpected feature key")
        require((location_id, key) not in values, "Duplicate location feature")
        require(row.get("unit") == UNITS[key], "Feature unit mismatch")
        require(row.get("isFinal") is True, "Feature is not final")
        number(row.get("coverage"), "feature coverage", 0, 1)
        sources = datasets(locations[location_id]["properties"]["datasetIds"])
        require(row.get("sourceDatasetId") in sources, "Feature source mismatch")
        values[(location_id, key)] = number(
            row.get("rawValue"), key, 0, 90 if key == "median_slope_deg" else None
        )

    for location_id in locations:
        for key in UNITS:
            require((location_id, key) in values, f"Missing {location_id}:{key}")

    candidates = []
    scores = []
    seen = set()
    previous_score = float("inf")
    for expected_rank, row in enumerate(ranking_rows, start=1):
        candidate_id = text(row.get("candidateLocationId"), "candidate ID")
        require(candidate_id not in seen, "Duplicate ranked candidate")
        seen.add(candidate_id)
        require(candidate_id in locations, "Ranked candidate missing from GeoJSON")
        require(row.get("modelRunId") == RUN_ID, "Ranking row run mismatch")
        require(row.get("referenceLocationId") == SCENARIO_ID, "Reference mismatch")
        require(
            type(row.get("rank")) is int and row["rank"] == expected_rank,
            "Ranks must be ordered and contiguous",
        )
        score = number(row.get("similarityScore"), "similarity score", 0, 100)
        require(score <= previous_score, "Scores are not descending")
        previous_score = score
        number(row.get("dataCoverage"), "ranking coverage", 0, 1)

        location = locations[candidate_id]
        props = location["properties"]
        require(
            props.get("kind") == "candidate" and props.get("body") == "earth",
            "Ranked location is not an Earth candidate",
        )
        require(props.get("rank") == expected_rank, "GeoJSON rank mismatch")
        require(
            number(props.get("similarityScore"), "GeoJSON score", 0, 100) == score,
            "GeoJSON score mismatch",
        )
        candidate_sources = datasets(props["datasetIds"])
        require(
            datasets(row.get("sourceDatasetIds"))
            == candidate_sources | reference_sources,
            "Ranking source mismatch",
        )
        longitude, latitude = location["geometry"]["coordinates"]
        candidates.append({
            "id": candidate_id,
            "name": props["name"],
            "country": None,
            "latitude": latitude,
            "longitude": longitude,
            "source": "; ".join(sorted(candidate_sources)),
        })
        scores.append({
            "model_run_id": RUN_ID,
            "model_version": None,
            "scenario_id": SCENARIO_ID,
            "candidate_id": candidate_id,
            **{key: values[(candidate_id, key)] for key in UNITS},
            "similarity_score": score / 100,
            "generated_at": None,
        })

    geo_candidates = {
        key for key, row in locations.items()
        if row["properties"].get("kind") == "candidate"
    }
    require(seen == geo_candidates, "Ranking/GeoJSON candidate set mismatch")
    require(
        set(locations) == seen | {SCENARIO_ID},
        "Unexpected location outside this scenario",
    )

    return {
        "mode": "read-only-dry-run",
        "mappingStatus": "passed",
        "importReadiness": "blocked",
        "publicationReadiness": "not_assessed",
        "databaseContacted": False,
        "scope": [
            "rankings.json",
            "location-features.json",
            "candidates.geojson",
        ],
        "limitations": [
            "Not a full nine-artifact package or hash verification.",
            "Not a raster, scientific validity, or publication assessment.",
            "Preview contains nulls in required DB columns; not importable.",
            "country is null because the input has no explicit country field.",
            "source is a sorted dataset-ID list joined with semicolons.",
            "Reference features are checked but not stored by this DB schema.",
        ],
        "blockers": [
            "Authoritative model_version has not been supplied.",
            "Original generated_at has not been recorded.",
            "Canonical package identity and publication approval are unresolved.",
            "Private draft access/RLS must be designed and verified before writes.",
            "API/dashboard do not yet support this pipeline run.",
        ],
        "counts": {"scenarios": 1, "candidates": len(candidates), "scores": len(scores)},
        "preview": {
            "scenarios": [{
                "id": SCENARIO_ID,
                "name": reference["name"],
                "body": "Mars",
                "description": None,
                "data_mode": "production",
            }],
            "candidates": candidates,
            "candidate_scores": scores,
        },
    }

def sample_input():
    candidate_id = "earth-test-v1"
    points = []
    feature_rows = []
    for location_id, kind, body, source in [
        (SCENARIO_ID, "reference-scenario", "mars", "mars-source"),
        (candidate_id, "candidate", "earth", "earth-source"),
    ]:
        props = {
            "id": location_id, "kind": kind, "body": body,
            "modelRunId": RUN_ID, "name": "Synthetic test location",
            "datasetIds": [source],
        }
        if kind == "candidate":
            props.update(rank=1, similarityScore=97.36)
        points.append({
            "type": "Feature", "properties": props,
            "geometry": {"type": "Point", "coordinates": [-155.4681, 19.8207]},
        })
        for key, unit in UNITS.items():
            feature_rows.append({
                "locationId": location_id, "featureKey": key,
                "rawValue": 7.0, "unit": unit, "isFinal": True,
                "coverage": 1.0, "sourceDatasetId": source,
            })
    return (
        {"modelRunId": RUN_ID, "rankings": [{
            "candidateLocationId": candidate_id,
            "referenceLocationId": SCENARIO_ID, "modelRunId": RUN_ID,
            "rank": 1, "similarityScore": 97.36, "dataCoverage": 1.0,
            "sourceDatasetIds": ["earth-source", "mars-source"],
        }]},
        {"modelRunId": RUN_ID, "features": feature_rows},
        {"type": "FeatureCollection", "features": points},
    )

class DryRunTests(unittest.TestCase):
    def test_mapping_and_blockers(self):
        report = build_preview(*sample_input())
        score = report["preview"]["candidate_scores"][0]
        candidate = report["preview"]["candidates"][0]
        self.assertAlmostEqual(score["similarity_score"], 0.9736)
        self.assertEqual(score["median_slope_deg"], 7.0)
        self.assertEqual(candidate["longitude"], -155.4681)
        self.assertEqual(candidate["latitude"], 19.8207)
        self.assertIsNone(score["model_version"])
        self.assertIsNone(score["generated_at"])
        self.assertEqual(report["importReadiness"], "blocked")
        self.assertFalse(report["databaseContacted"])

    def test_rejects_invalid_inputs(self):
        mutations = [
            lambda r, f, g: r.update(modelRunId="wrong"),
            lambda r, f, g: r["rankings"].append(copy.deepcopy(r["rankings"][0])),
            lambda r, f, g: f["features"].pop(),
            lambda r, f, g: f["features"].append(copy.deepcopy(f["features"][0])),
            lambda r, f, g: f["features"][0].update(unit="radians"),
            lambda r, f, g: f["features"][0].update(rawValue=float("nan")),
            lambda r, f, g: r["rankings"][0].update(similarityScore=101),
            lambda r, f, g: g["features"][1]["geometry"].update(coordinates=[0, 91]),
            lambda r, f, g: g["features"][1]["properties"].update(similarityScore=10),
            lambda r, f, g: r["rankings"][0].update(sourceDatasetIds=["wrong"]),
        ]
        for index, mutate in enumerate(mutations):
            with self.subTest(case=index):
                inputs = sample_input()
                mutate(*inputs)
                with self.assertRaises(ValueError):
                    build_preview(*inputs)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(DryRunTests)
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        return 0 if result.wasSuccessful() else 1
    if args.run_dir is None:
        parser.error("--run-dir is required unless --self-test is used")
    try:
        documents = []
        for name in ("rankings.json", "location-features.json", "candidates.geojson"):
            with (args.run_dir / name).open(encoding="utf-8-sig") as handle:
                documents.append(json.load(handle))
        report = build_preview(*documents)
        print(json.dumps(report, indent=2, ensure_ascii=True, allow_nan=False))
        # Exit 0 means mapping passed, NOT permission to import or publish.
        return 0
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
        print(json.dumps({
            "mode": "read-only-dry-run",
            "mappingStatus": "failed",
            "importReadiness": "blocked",
            "error": str(exc),
        }), file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())