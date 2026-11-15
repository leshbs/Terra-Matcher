import unittest
import json
from pathlib import Path

import numpy as np

from terra_analog.run_training_features import (
    build_location_feature_records,
    build_location_features,
    offset_location,
)
from terra_analog.source_rasters import NasademCatalog
from terra_analog.terrain_features import derive_feature_summary


class TerrainFeatureTests(unittest.TestCase):
    def test_offset_location_moves_a_copy_of_an_earth_location(self):
        original = {
            "id": "test-earth",
            "body": "earth",
            "center": {"latitude": 0.0, "longitude": 0.0},
            "datasetIds": ["earth-nasadem-hgt-v001"],
        }

        shifted = offset_location(original, east_km=4.0, north_km=-4.0)

        self.assertEqual(original["center"], {"latitude": 0.0, "longitude": 0.0})
        self.assertLess(shifted["center"]["latitude"], 0.0)
        self.assertGreater(shifted["center"]["longitude"], 0.0)

    def test_reusable_profile_builder_keeps_feature_provenance_at_study_radius(self):
        class PlanarSampler:
            def sample(self, latitude, longitude):
                return latitude * 10_000 + longitude * 10_000

        location = {
            "id": "test-earth",
            "body": "earth",
            "center": {"latitude": 0.0, "longitude": 0.0},
            "datasetIds": ["earth-nasadem-hgt-v001"],
        }

        records = build_location_feature_records(location, PlanarSampler(), radius_m=3_000)

        self.assertEqual({record["featureKey"] for record in records}, {
            "median_slope_deg", "terrain_roughness_m", "relative_relief_m"
        })
        self.assertTrue(all(record["sourceDatasetId"] == "earth-nasadem-hgt-v001" for record in records))
        self.assertTrue(all(record["unit"] for record in records))
        self.assertTrue(all(record["qualityFlag"] for record in records))
    def test_planar_surface_has_expected_slope_and_local_elevation_spread(self):
        _, x = np.mgrid[0:15, 0:15]

        result = derive_feature_summary(x.astype(float) * 100, spacing_m=500, window_cells=7)

        self.assertAlmostEqual(
            result["median_slope_deg"]["rawValue"],
            np.degrees(np.arctan(0.2)),
            places=6,
        )
        self.assertEqual(result["terrain_roughness_m"]["rawValue"], 200.0)
        self.assertEqual(result["relative_relief_m"]["rawValue"], 600.0)

    def test_quality_flags_follow_coverage_thresholds(self):
        values = np.full((15, 15), 100.0)
        values[:4, :4] = np.nan

        result = derive_feature_summary(values, spacing_m=500, window_cells=7)

        self.assertEqual(result["relative_relief_m"]["qualityFlag"], "partial-coverage")
        self.assertIsNotNone(result["relative_relief_m"]["rawValue"])

    def test_study_boundary_is_not_counted_as_source_missingness(self):
        rows, columns = np.mgrid[0:15, 0:15]
        study_mask = np.hypot(rows - 7, columns - 7) <= 7
        values = np.where(study_mask, 100.0, np.nan)

        result = derive_feature_summary(
            values,
            spacing_m=500,
            window_cells=7,
            analysis_mask=study_mask,
        )

        self.assertEqual(result["relative_relief_m"]["coverage"], 1.0)
        self.assertEqual(result["relative_relief_m"]["qualityFlag"], "source-backed-derived")

    def test_nasadem_catalog_uses_lower_left_tile_name(self):
        catalog = NasademCatalog(Path("data/training/raw/earth"))

        self.assertEqual(catalog.tile_path(29.576, 35.421).name, "n29e035.hgt")
        self.assertEqual(catalog.tile_path(-23.479, -68.312).name, "s24w069.hgt")

    def test_source_backed_run_exports_three_records_per_location(self):
        records, report = build_location_features(Path("data/training"))

        self.assertEqual(len(records), 18)
        self.assertEqual(report["summary"]["locations"], 6)
        self.assertTrue(all(record["sourceDatasetId"] for record in records))
        self.assertTrue(all(record["unit"] for record in records))
        self.assertTrue(all(record["qualityFlag"] for record in records))
        self.assertTrue(
            all(
                record["qualityFlag"]
                in {"source-backed-derived", "partial-coverage", "invalid"}
                for record in records
            )
        )

    def test_source_checksum_inventory_has_file_level_provenance(self):
        build_location_features(Path("data/training"))
        inventory = json.loads(Path("data/training/raw/source-checksums.json").read_text(encoding="utf-8"))

        self.assertEqual(inventory["modelRunId"], "2026-11-14-mvp-v1")
        self.assertEqual(len(inventory["files"]), 9)
        self.assertTrue(all(record["sha256"] for record in inventory["files"]))
        self.assertTrue(all(record["sourceUrl"] for record in inventory["files"]))
        self.assertTrue(all("localObservedAt" in record for record in inventory["files"]))
        self.assertTrue(all(record["datasetId"] for record in inventory["files"]))


if __name__ == "__main__":
    unittest.main()
