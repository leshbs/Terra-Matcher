import unittest

from terra_analog.ranking import ecdf_midrank, fit_ecdf, normalise_features, score_candidate


WEIGHTS = {
    "median_slope_deg": 0.35,
    "terrain_roughness_m": 0.35,
    "relative_relief_m": 0.30,
}


def profile(value, flag="source-backed-derived"):
    return {
        "rawValue": value,
        "normalizedValue": value,
        "qualityFlag": flag,
    }


class RankingTests(unittest.TestCase):
    def test_ecdf_midrank_uses_declared_formula(self):
        self.assertEqual(ecdf_midrank(20.0, fit_ecdf([10.0, 20.0, 30.0, 40.0])), 0.375)

    def test_normalisation_copies_records_and_adds_midrank(self):
        feature = {"featureKey": "median_slope_deg", "rawValue": 2.0}

        result = normalise_features([feature], {"median_slope_deg": [1.0, 2.0, 3.0]})

        self.assertEqual(feature, {"featureKey": "median_slope_deg", "rawValue": 2.0})
        self.assertEqual(result[0]["normalizedValue"], 0.5)

    def test_invalid_feature_keeps_raw_provenance_without_a_normalised_value(self):
        feature = {
            "featureKey": "median_slope_deg",
            "rawValue": None,
            "qualityFlag": "invalid",
        }

        result = normalise_features([feature], {"median_slope_deg": [1.0, 2.0, 3.0]})

        self.assertIsNone(result[0]["normalizedValue"])
        self.assertIsNone(result[0]["rawValue"])

    def test_matching_profile_scores_higher_than_extreme_profile(self):
        reference = {key: profile(0.5) for key in WEIGHTS}
        matching = {key: profile(0.5) for key in WEIGHTS}
        extreme = {key: profile(1.0) for key in WEIGHTS}

        self.assertEqual(score_candidate(reference, matching, WEIGHTS)[0], 100.0)
        self.assertLess(score_candidate(reference, extreme, WEIGHTS)[0], 100.0)

    def test_invalid_feature_is_excluded_and_weights_are_renormalised(self):
        reference = {key: profile(0.5) for key in WEIGHTS}
        candidate = {key: profile(0.5) for key in WEIGHTS}
        candidate["relative_relief_m"] = profile(0.5, "invalid")

        score, coverage, contributions = score_candidate(reference, candidate, WEIGHTS)

        self.assertEqual(score, 100.0)
        self.assertAlmostEqual(coverage, 0.70)
        self.assertEqual(
            [row["normalizedWeight"] for row in contributions if row["available"]],
            [0.5, 0.5],
        )
        self.assertAlmostEqual(sum(row["weightedContribution"] for row in contributions), 0.0)


if __name__ == "__main__":
    unittest.main()
