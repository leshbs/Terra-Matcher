"""Generate terrain-feature records from locally downloaded source rasters."""

from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import UTC, datetime
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np

from terra_analog.source_rasters import MolaRaster, NasademCatalog
from terra_analog.terrain_features import derive_feature_summary


MODEL_RUN_ID = "2026-11-14-mvp-v1"
ANALYSIS_RESOLUTION_M = 500
LOCAL_WINDOW_KM = 3
WINDOW_CELLS = 7
MARS_RADIUS_M = 3_396_000
FEATURE_UNITS = {
    "median_slope_deg": "degrees",
    "terrain_roughness_m": "m",
    "relative_relief_m": "m",
}


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _source_url(path: Path, dataset_id: str) -> str:
    if dataset_id == "mars-mola-megdr-v2":
        return f"https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg128/{path.name}"
    tile = path.stem
    return f"https://e4ftl01.cr.usgs.gov/MEASURES/NASADEM_HGT.001/2000.02.11/NASADEM_HGT_{tile}.zip"


def _source_metadata(path: Path, dataset_id: str) -> dict[str, Any]:
    observed_at = datetime.fromtimestamp(path.stat().st_mtime, UTC).isoformat().replace("+00:00", "Z")
    if dataset_id == "mars-mola-megdr-v2":
        return {
            "datasetId": dataset_id,
            "sourceUrl": _source_url(path, dataset_id),
            "retrievedAt": None,
            "retrievalTimestampStatus": "not-recorded; localObservedAt is filesystem evidence only",
            "localObservedAt": observed_at,
            "product": "MGS MOLA MEGDR topography, 128 pixels per degree",
            "productVersion": "PDS4 maintained bundle product 1.1; final MEGDR product version 2.0",
            "nativeResolution": {"value": 0.4630576672, "unit": "km/pixel"},
            "unit": "m above MOLA areoid",
            "crs": "Mars simple cylindrical / equirectangular; 3396 km sphere; central meridian 180 degrees",
        }
    return {
        "datasetId": dataset_id,
        "sourceUrl": _source_url(path, dataset_id),
        "retrievedAt": None,
        "retrievalTimestampStatus": "not-recorded; localObservedAt is filesystem evidence only",
        "localObservedAt": observed_at,
        "product": "NASADEM Merged DEM Global 1 arc second",
        "productVersion": "V001",
        "nativeResolution": {"value": 1, "unit": "arc-second", "approximateMetersAtEquator": 30},
        "unit": "m relative to the EGM96 geoid",
        "crs": "geographic latitude/longitude (EPSG:4326); vertical reference EGM96 geoid",
    }


def _earth_meters_per_degree(latitude: float) -> tuple[float, float]:
    radians = math.radians(latitude)
    latitude_m = 111_132.92 - 559.82 * math.cos(2 * radians) + 1.175 * math.cos(4 * radians)
    longitude_m = 111_412.84 * math.cos(radians) - 93.5 * math.cos(3 * radians)
    return latitude_m, longitude_m


def _coordinates(center: dict[str, float], body: str, radius_m: int = 20_000) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    axis = np.arange(-radius_m, radius_m + ANALYSIS_RESOLUTION_M, ANALYSIS_RESOLUTION_M)
    east_m, north_m = np.meshgrid(axis, axis)
    circle_mask = np.hypot(east_m, north_m) <= radius_m
    latitude = float(center["latitude"])
    longitude = float(center["longitude"])
    if body == "mars":
        metres_per_degree_latitude = math.pi * MARS_RADIUS_M / 180
        metres_per_degree_longitude = metres_per_degree_latitude * math.cos(math.radians(latitude))
    else:
        metres_per_degree_latitude, metres_per_degree_longitude = _earth_meters_per_degree(latitude)
    latitudes = latitude + north_m / metres_per_degree_latitude
    longitudes = longitude + east_m / metres_per_degree_longitude
    return latitudes, longitudes, circle_mask


def offset_location(location: dict[str, Any], east_km: float, north_km: float) -> dict[str, Any]:
    """Return a copied location translated by a local east/north offset."""
    result = deepcopy(location)
    latitude = float(location["center"]["latitude"])
    if location["body"] == "mars":
        latitude_m = math.pi * MARS_RADIUS_M / 180
        longitude_m = latitude_m * math.cos(math.radians(latitude))
    else:
        latitude_m, longitude_m = _earth_meters_per_degree(latitude)
    result["center"]["latitude"] = latitude + (north_km * 1_000 / latitude_m)
    result["center"]["longitude"] = float(location["center"]["longitude"]) + (east_km * 1_000 / longitude_m)
    return result


def _sample_location(
    location: dict[str, Any], sampler: Any, radius_m: int = 20_000
) -> tuple[np.ndarray, np.ndarray]:
    latitudes, longitudes, circle_mask = _coordinates(location["center"], location["body"], radius_m=radius_m)
    elevation = np.full(latitudes.shape, np.nan)
    for row, column in np.argwhere(circle_mask):
        value = sampler.sample(float(latitudes[row, column]), float(longitudes[row, column]))
        if value is not None:
            elevation[row, column] = value
    return elevation, circle_mask


def build_location_feature_records(
    location: dict[str, Any], sampler: Any, radius_m: int = 20_000
) -> list[dict[str, Any]]:
    """Derive the three terrain features for a source-backed local profile."""
    elevation, circle_mask = _sample_location(location, sampler, radius_m=radius_m)
    summaries = derive_feature_summary(
        elevation,
        spacing_m=ANALYSIS_RESOLUTION_M,
        window_cells=WINDOW_CELLS,
        analysis_mask=circle_mask,
    )
    records = []
    for feature_key, summary in summaries.items():
        records.append(
            {
                "id": f"{location['id']}:{feature_key}",
                "locationId": location["id"],
                "featureKey": feature_key,
                "rawValue": summary["rawValue"],
                "unit": FEATURE_UNITS[feature_key],
                "sourceDatasetId": location["datasetIds"][0],
                "analysisResolutionM": ANALYSIS_RESOLUTION_M,
                "localWindowKm": LOCAL_WINDOW_KM,
                "validCellCount": summary["validCellCount"],
                "coverage": summary["coverage"],
                "qualityFlag": summary["qualityFlag"],
                "isFinal": summary["qualityFlag"] != "invalid",
                "method": "nearest-neighbour 500 m local grid; 7x7 complete local elevation neighbourhood",
            }
        )
    return records


def build_location_features(training_root: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    training_root = Path(training_root)
    datasets = _read_json(training_root / "datasets.json")["datasets"]
    locations = _read_json(training_root / "locations.json")["locations"]
    dataset_by_id = {dataset["id"]: dataset for dataset in datasets}
    raw_root = training_root / "raw"
    earth_catalog = NasademCatalog(raw_root / "earth")
    mars_raster = MolaRaster.from_files(raw_root / "mars" / "megt00n090hb.img", raw_root / "mars" / "megt00n090hb.hdr")

    records: list[dict[str, Any]] = []
    used_sources: dict[str, list[Path]] = {
        "mars-mola-megdr-v2": [
            raw_root / "mars" / "megt00n090hb.img",
            raw_root / "mars" / "megt00n090hb.hdr",
            raw_root / "mars" / "megt00n090hb.xml",
        ],
        "earth-nasadem-hgt-v001": earth_catalog.source_paths(),
    }
    for location in locations:
        source_id = location["datasetIds"][0]
        if source_id not in dataset_by_id:
            raise ValueError(f"location references unknown dataset: {source_id}")
        sampler = mars_raster if location["body"] == "mars" else earth_catalog
        records.extend(build_location_feature_records(location, sampler))

    checksums = {
        "modelRunId": MODEL_RUN_ID,
        "files": [
            {
                "path": path.relative_to(training_root).as_posix(),
                "sha256": _sha256(path),
                **_source_metadata(path, dataset_id),
            }
            for dataset_id, paths in used_sources.items()
            for path in paths
        ],
    }
    summary = {
        "locations": len(locations),
        "features": len(records),
        "sourceBackedDerived": sum(record["qualityFlag"] == "source-backed-derived" for record in records),
        "partialCoverage": sum(record["qualityFlag"] == "partial-coverage" for record in records),
        "invalid": sum(record["qualityFlag"] == "invalid" for record in records),
    }
    report = {
        "modelRunId": MODEL_RUN_ID,
        "analysisResolutionM": ANALYSIS_RESOLUTION_M,
        "localWindowKm": LOCAL_WINDOW_KM,
        "outputRoot": f"data/training/processed/{MODEL_RUN_ID}",
        "summary": summary,
        "limitations": [
            "MOLA and NASADEM retain different sensing methods and vertical reference surfaces.",
            "Only terrain morphology is measured; atmosphere, gravity, radiation, biology, access, and land permissions are not modelled.",
        ],
    }
    _write_json(raw_root / "source-checksums.json", checksums)
    output_root = training_root / "processed" / MODEL_RUN_ID
    _write_json(output_root / "location-features.json", {"modelRunId": MODEL_RUN_ID, "features": records})
    _write_json(output_root / "processing-report.json", report)
    return records, report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--training-root", type=Path, required=True)
    arguments = parser.parse_args()
    records, report = build_location_features(arguments.training_root)
    print(json.dumps({"modelRunId": MODEL_RUN_ID, "features": len(records), "summary": report["summary"]}, sort_keys=True))


if __name__ == "__main__":
    main()
