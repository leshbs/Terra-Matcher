"""Synthetic tests; never read or modify the real training package."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from terra_analog.validate_import_package import (
    FILES,
    RUN_ID,
    WEIGHTS,
    validate_package,
)


def synthetic_documents():
    reference_id = "mars-test-reference"
    candidate_ids = [f"earth-test-{index}" for index in range(5)]
    location_ids = [reference_id, *candidate_ids]
    documents = {name: {"modelRunId": RUN_ID} for name in FILES}

    geo_features = []
    features = []
    transforms = {}
    for body, count in (("mars", 25), ("earth", 125)):
        for key in WEIGHTS:
            transforms[f"{body}:{key}"] = {
                "body": body,
                "featureKey": key,
                "modelRunId": RUN_ID,
                "transformationVersion": "ecdf-midrank-v1",
                "analysisResolutionM": 500,
                "localWindowKm": 3,
                "sampleCount": count,
                "sortedRawValues": [2.0] * count,
            }

    for location_id in location_ids:
        is_reference = location_id == reference_id
        geo_features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [0, 0]},
            "properties": {
                "id": location_id,
                "name": location_id,
                "body": "mars" if is_reference else "earth",
                "kind": "reference-scenario" if is_reference else "candidate",
                "modelRunId": RUN_ID,
            },
        })
        for key in WEIGHTS:
            features.append({
                "locationId": location_id,
                "featureKey": key,
                "rawValue": 2.0,
                "qualityFlag": "source-backed-derived",
                "coverage": 1.0,
                "analysisResolutionM": 500,
                "localWindowKm": 3,
            })

    # Independent expected values for the currently declared formula:
    # Mars: (25 - 0.5) / 25 = 0.98
    # Earth: (125 - 0.5) / 125 = 0.996
    # Distance: 0.016; score: 100 * (1 - 0.016) = 98.4
    rankings = []
    contributions = []
    for rank, candidate_id in enumerate(candidate_ids, start=1):
        rankings.append({
            "candidateLocationId": candidate_id,
            "referenceLocationId": reference_id,
            "modelRunId": RUN_ID,
            "similarityScore": 98.4,
            "dataCoverage": 1.0,
            "rank": rank,
        })
        for key, weight in WEIGHTS.items():
            contributions.append({
                "candidateLocationId": candidate_id,
                "referenceLocationId": reference_id,
                "modelRunId": RUN_ID,
                "featureKey": key,
                "available": True,
                "referenceRawValue": 2.0,
                "candidateRawValue": 2.0,
                "referenceNormalizedValue": 0.98,
                "candidateNormalizedValue": 0.996,
                "featureDistance": 0.016,
                "normalizedWeight": weight,
                "weightedContribution": weight * 0.016,
            })

    documents["candidates.geojson"] = {
        "type": "FeatureCollection",
        "features": geo_features,
    }
    documents["location-features.json"]["features"] = features
    documents["model_manifest.json"]["transforms"] = transforms
    documents["rankings.json"]["rankings"] = rankings
    documents["ranking-contributions.json"]["contributions"] = contributions
    # Other documents contain only run identity on purpose:
    # their detailed contents are outside the current validator's scope.
    return documents


class ValidateImportPackageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.documents = synthetic_documents()
        self.write_documents()

    def write_documents(self):
        for name, document in self.documents.items():
            (self.root / name).write_text(
                json.dumps(document), encoding="utf-8"
            )

    def test_valid_core_has_warning_and_does_not_modify_files(self):
        before = {
            name: (self.root / name).read_bytes() for name in FILES
        }
        report = validate_package(self.root)
        self.assertEqual(report["coreChecks"], "passed")
        self.assertEqual(report["publicationReadiness"], "not_assessed")
        self.assertEqual(len(report["warnings"]), 1)
        self.assertIn("18/18", report["warnings"][0])
        self.assertTrue(report["notVerified"])
        self.assertAlmostEqual(
            report["preview"][0]["databaseScorePreview"], 0.984
        )
        self.assertEqual(
            [row["candidateId"] for row in report["preview"]],
            [f"earth-test-{index}" for index in range(5)],
        )
        for name, content in before.items():
            self.assertEqual((self.root / name).read_bytes(), content)
            self.assertEqual(
                report["fileSha256"][name],
                hashlib.sha256(content).hexdigest(),
            )

    def test_incorrect_score_is_rejected(self):
        self.documents["rankings.json"]["rankings"][0]["similarityScore"] = 50
        self.write_documents()
        with self.assertRaisesRegex(ValueError, "score"):
            validate_package(self.root)

    def test_duplicate_feature_is_rejected(self):
        rows = self.documents["location-features.json"]["features"]
        rows.append(dict(rows[0]))
        self.write_documents()
        with self.assertRaisesRegex(ValueError, "Duplicate record"):
            validate_package(self.root)

    def test_boolean_raw_value_is_rejected(self):
        self.documents["location-features.json"]["features"][0]["rawValue"] = True
        self.write_documents()
        with self.assertRaisesRegex(ValueError, "finite number"):
            validate_package(self.root)

    def test_nonfinite_raw_values_are_rejected(self):
        for value in (float("nan"), float("inf"), float("-inf")):
            with self.subTest(value=value):
                self.documents["location-features.json"]["features"][0]["rawValue"] = value
                self.write_documents()
                with self.assertRaisesRegex(ValueError, "finite number"):
                    validate_package(self.root)

    def test_incorrect_normalized_value_is_rejected(self):
        self.documents["location-features.json"]["features"][0]["normalizedValue"] = 0.5
        self.write_documents()
        with self.assertRaises(ValueError):
            validate_package(self.root)

    def test_incorrect_contribution_is_rejected(self):
        self.documents["ranking-contributions.json"]["contributions"][0]["weightedContribution"] = 0.9
        self.write_documents()
        with self.assertRaisesRegex(ValueError, "weightedContribution"):
            validate_package(self.root)

    def test_wrong_run_is_rejected(self):
        self.documents["validation-report.json"]["modelRunId"] = "other-run"
        self.write_documents()
        with self.assertRaisesRegex(ValueError, "modelRunId"):
            validate_package(self.root)

    def test_out_of_bounds_coordinates_are_rejected(self):
        self.documents["candidates.geojson"]["features"][1]["geometry"]["coordinates"] = [181, 0]
        self.write_documents()
        with self.assertRaisesRegex(ValueError, "coordinates"):
            validate_package(self.root)

    def test_incorrect_tie_rank_is_rejected(self):
        self.documents["rankings.json"]["rankings"][0]["rank"] = 2
        self.write_documents()
        with self.assertRaisesRegex(ValueError, "incorrect rank"):
            validate_package(self.root)


if __name__ == "__main__":
    unittest.main()