"""Numerical terrain summaries on a common local analysis grid."""

from __future__ import annotations

from typing import Any

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view


FEATURE_KEYS = ("median_slope_deg", "terrain_roughness_m", "relative_relief_m")


def _quality_flag(coverage: float, valid_cell_count: int) -> str:
    if valid_cell_count == 0 or coverage < 0.75:
        return "invalid"
    if coverage < 0.95:
        return "partial-coverage"
    return "source-backed-derived"


def _summary(values: np.ndarray, coverage: float, valid_cell_count: int) -> dict[str, Any]:
    quality_flag = _quality_flag(coverage, valid_cell_count)
    raw_value = None if quality_flag == "invalid" else float(np.median(values))
    return {
        "rawValue": raw_value,
        "validCellCount": int(valid_cell_count),
        "coverage": float(coverage),
        "qualityFlag": quality_flag,
    }


def derive_feature_summary(
    elevation: np.ndarray,
    spacing_m: float,
    window_cells: int,
) -> dict[str, dict[str, Any]]:
    """Summarise slope, local roughness, and local relief from an elevation grid.

    A feature value is included only where the centred local elevation window is
    entirely finite. This prevents a no-data edge from contaminating the metric.
    """

    if elevation.ndim != 2:
        raise ValueError("elevation must be a two-dimensional grid")
    if spacing_m <= 0:
        raise ValueError("spacing_m must be positive")
    if window_cells < 3 or window_cells % 2 == 0:
        raise ValueError("window_cells must be an odd integer of at least three")
    if min(elevation.shape) < window_cells:
        raise ValueError("elevation grid is smaller than the local window")

    values = np.asarray(elevation, dtype=float)
    half_window = window_cells // 2
    windows = sliding_window_view(values, (window_cells, window_cells))
    window_is_valid = np.isfinite(windows).all(axis=(-2, -1))
    possible_cells = window_is_valid.size
    valid_cell_count = int(window_is_valid.sum())
    coverage = valid_cell_count / possible_cells

    dz_dx = (values[1:-1, 2:] - values[1:-1, :-2]) / (2 * spacing_m)
    dz_dy = (values[2:, 1:-1] - values[:-2, 1:-1]) / (2 * spacing_m)
    slope = np.full(values.shape, np.nan)
    slope[1:-1, 1:-1] = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))

    center_slope = slope[half_window:-half_window, half_window:-half_window]
    slope_values = center_slope[window_is_valid]
    valid_windows = windows[window_is_valid]
    roughness_values = np.std(valid_windows, axis=(1, 2))
    relief_values = np.max(valid_windows, axis=(1, 2)) - np.min(valid_windows, axis=(1, 2))

    return {
        "median_slope_deg": _summary(slope_values, coverage, valid_cell_count),
        "terrain_roughness_m": _summary(roughness_values, coverage, valid_cell_count),
        "relative_relief_m": _summary(relief_values, coverage, valid_cell_count),
    }
