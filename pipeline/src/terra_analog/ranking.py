"""Normalise terrain features and compute weighted similarity rankings."""

from __future__ import annotations

from bisect import bisect_right
from collections.abc import Mapping, Sequence
from typing import Any


def fit_ecdf(values: Sequence[float]) -> tuple[float, ...]:
    """Return a sorted empirical distribution from valid numeric observations."""
    return tuple(sorted(float(value) for value in values))


def ecdf_midrank(value: float, sorted_values: Sequence[float]) -> float:
    """Return the bounded empirical-CDF mid-rank percentile for one value."""
    if not sorted_values:
        raise ValueError("ECDF requires at least one value")
    rank = bisect_right(sorted_values, float(value))
    return max(0.0, min(1.0, (rank - 0.5) / len(sorted_values)))


def normalise_features(
    features: Sequence[Mapping[str, Any]], transforms: Mapping[str, Sequence[float]]
) -> list[dict[str, Any]]:
    """Copy feature records and add their ECDF mid-rank normalised values."""
    normalised: list[dict[str, Any]] = []
    for feature in features:
        feature_key = feature.get("featureKey")
        if not isinstance(feature_key, str) or feature_key not in transforms:
            raise ValueError(f"missing transform for feature: {feature_key}")
        raw_value = feature.get("rawValue")
        if feature.get("qualityFlag") == "invalid":
            record = dict(feature)
            record["normalizedValue"] = None
            normalised.append(record)
            continue
        if not isinstance(raw_value, (int, float)):
            raise ValueError(f"feature has nonnumeric raw value: {feature_key}")
        record = dict(feature)
        record["normalizedValue"] = ecdf_midrank(float(raw_value), transforms[feature_key])
        normalised.append(record)
    return normalised


def score_candidate(
    reference: Mapping[str, Mapping[str, Any]],
    candidate: Mapping[str, Mapping[str, Any]],
    weights: Mapping[str, float],
) -> tuple[float, float, list[dict[str, Any]]]:
    """Score one candidate and return score, source-weight coverage, contributions."""
    contributions: list[dict[str, Any]] = []
    available_weight = 0.0
    for feature_key, original_weight in weights.items():
        reference_feature = reference[feature_key]
        candidate_feature = candidate[feature_key]
        available = (
            reference_feature.get("qualityFlag") != "invalid"
            and candidate_feature.get("qualityFlag") != "invalid"
        )
        if available:
            available_weight += float(original_weight)
        contributions.append(
            {
                "featureKey": feature_key,
                "referenceRawValue": reference_feature.get("rawValue"),
                "candidateRawValue": candidate_feature.get("rawValue"),
                "referenceNormalizedValue": reference_feature.get("normalizedValue"),
                "candidateNormalizedValue": candidate_feature.get("normalizedValue"),
                "available": available,
                "featureDistance": None,
                "normalizedWeight": 0.0,
                "weightedContribution": 0.0,
            }
        )
    if available_weight == 0.0:
        raise ValueError("candidate has no available features")

    for contribution in contributions:
        if not contribution["available"]:
            continue
        feature_key = contribution["featureKey"]
        normalized_weight = float(weights[feature_key]) / available_weight
        distance = abs(
            float(contribution["referenceNormalizedValue"])
            - float(contribution["candidateNormalizedValue"])
        )
        contribution["normalizedWeight"] = normalized_weight
        contribution["featureDistance"] = distance
        contribution["weightedContribution"] = normalized_weight * distance

    weighted_distance = sum(float(item["weightedContribution"]) for item in contributions)
    return 100.0 * (1.0 - weighted_distance), available_weight, contributions
