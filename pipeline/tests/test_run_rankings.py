import json
import tempfile
import unittest
from pathlib import Path

from terra_analog.run_rankings import build_ranked_outputs


FEATURE_KEYS = ("median_slope_deg", "terrain_roughness_m", "relative_relief_m")


def feature_records(location, multiplier=1.0):
    return [
        {
            "id": f"{location['id']}:{key}",
            "locationId": location["id"],
            "featureKey": key,
            "rawValue": (index + 1) * multiplier,
            "unit": "degrees" if key == "median_slope_deg" else "m",
            "sourceDatasetId": location["datasetIds"][0],
            "analysisResolutionM": 500,
            "localWindowKm": 3,
            "validCellCount": 49,
            "coverage": 1.0,
            "qualityFlag": "source-backed-derived",
            "isFinal": True,
        }
        for index, key in enumerate(FEATURE_KEYS)
    ]


class RunRankingsTests(unittest.TestCase):
    def test_exports_five_rankings_with_provenance_and_all_transforms(self):
        locations = [
            {
                "id": "mars-reference",
                "name": "Mars reference",
                "body": "mars",
                "kind": "reference-scenario",
                "center": {"latitude": 0.0, "longitude": 0.0},
                "datasetIds": ["mars-dem"],
                "operationalHypothesis": "Reference.",
                "limitations": ["Not approval."],
            },
            *[
                {
                    "id": f"earth-{index}",
                    "name": f"Earth candidate {index}",
                    "body": "earth",
                    "kind": "candidate",
                    "center": {"latitude": float(index), "longitude": float(index)},
                    "datasetIds": ["earth-dem"],
                    "operationalHypothesis": "Candidate.",
                    "limitations": ["Not approval."],
                }
                for index in range(1, 6)
            ],
        ]
        display_features = [record for location in locations for record in feature_records(location)]

        def study_feature_builder(location, sampler, radius_m):
            return feature_records(location, multiplier=1.0 + abs(location["center"]["latitude"]) / 100)

        with tempfile.TemporaryDirectory() as temporary_directory:
            training_root = Path(temporary_directory)
            (training_root / "processed" / "2026-11-14-mvp-v1").mkdir(parents=True)
            (training_root / "locations.json").write_text(json.dumps({"locations": locations}), encoding="utf-8")
            (training_root / "processed" / "2026-11-14-mvp-v1" / "location-features.json").write_text(
                json.dumps({"features": display_features}), encoding="utf-8"
            )

            outputs = build_ranked_outputs(training_root, study_feature_builder=study_feature_builder)

            self.assertEqual(len(outputs["rankings"]), 5)
            self.assertEqual(len(outputs["contributions"]), 15)
            self.assertTrue(all(0.0 <= row["similarityScore"] <= 100.0 for row in outputs["rankings"]))
            self.assertTrue(all(row["modelRunId"] for row in outputs["rankings"]))
            self.assertTrue(all(row["sourceDatasetIds"] for row in outputs["rankings"]))
            self.assertEqual(
                set(outputs["manifest"]["transforms"]),
                {
                    "mars:median_slope_deg",
                    "mars:terrain_roughness_m",
                    "mars:relative_relief_m",
                    "earth:median_slope_deg",
                    "earth:terrain_roughness_m",
                    "earth:relative_relief_m",
                },
            )
            self.assertEqual(outputs["manifest"]["inputDatasetIds"], ["earth-dem", "mars-dem"])
            self.assertEqual(outputs["manifest"]["analysisResolutionM"], 500)
            self.assertEqual(outputs["manifest"]["localWindowKm"], 3)
            self.assertEqual(outputs["manifest"]["transformationVersion"], "ecdf-midrank-v1")
            output_root = training_root / "processed" / "2026-11-14-mvp-v1"
            self.assertTrue((output_root / "validation-report.json").exists())
            self.assertTrue((output_root / "location-evidence.json").exists())
            geojson = json.loads((output_root / "candidates.geojson").read_text(encoding="utf-8"))
            self.assertEqual(geojson["type"], "FeatureCollection")
            self.assertEqual(len(geojson["features"]), 6)
            reference_features = [
                feature for feature in geojson["features"] if feature["properties"]["kind"] == "reference-scenario"
            ]
            candidate_features = [
                feature for feature in geojson["features"] if feature["properties"]["kind"] == "candidate"
            ]
            self.assertEqual(len(reference_features), 1)
            self.assertEqual(len(candidate_features), 5)
            self.assertTrue(all(feature["properties"]["modelRunId"] for feature in geojson["features"]))
            self.assertTrue(all(feature["properties"]["rank"] >= 1 for feature in candidate_features))
            self.assertNotIn("rank", reference_features[0]["properties"])
            explorer_grid = json.loads((output_root / "explorer-grid-samples.json").read_text(encoding="utf-8"))
            self.assertEqual(explorer_grid["modelRunId"], "2026-11-14-mvp-v1")
            self.assertEqual(len(explorer_grid["samples"]), 150)
            first_sample = explorer_grid["samples"][0]
            self.assertEqual(
                set(first_sample),
                {
                    "id", "windowId", "modelRunId", "datasetId", "offsetEastKm", "offsetNorthKm",
                    "slope", "roughness", "relativeRelief", "qualityFlag",
                },
            )
            self.assertEqual(first_sample["qualityFlag"], "source-backed-derived")


if __name__ == "__main__":
    unittest.main()
