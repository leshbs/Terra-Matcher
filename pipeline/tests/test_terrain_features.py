import unittest

import numpy as np

from terra_analog.terrain_features import derive_feature_summary


class TerrainFeatureTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
