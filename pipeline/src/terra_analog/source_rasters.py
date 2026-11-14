"""Small readers for the downloaded MOLA and NASADEM elevation rasters."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np


EARTH_SAMPLES = 3601
EARTH_NODATA = -32768


def _tile_stem(latitude: float, longitude: float) -> str:
    lat = math.floor(latitude)
    lon = math.floor(longitude)
    lat_prefix = "n" if lat >= 0 else "s"
    lon_prefix = "e" if lon >= 0 else "w"
    return f"{lat_prefix}{abs(lat):02d}{lon_prefix}{abs(lon):03d}"


class NasademCatalog:
    """Reads individual NASADEM HGT tiles stored in their downloaded folders."""

    def __init__(self, raw_root: Path):
        self.raw_root = Path(raw_root)
        self._arrays: dict[Path, np.ndarray] = {}

    def tile_path(self, latitude: float, longitude: float) -> Path:
        stem = _tile_stem(latitude, longitude)
        return self.raw_root / f"NASADEM_HGT_{stem}" / f"{stem}.hgt"

    def _array(self, path: Path) -> np.ndarray:
        if path not in self._arrays:
            if not path.exists():
                raise FileNotFoundError(f"NASADEM tile not found: {path}")
            values = np.fromfile(path, dtype=">i2")
            if values.size != EARTH_SAMPLES * EARTH_SAMPLES:
                raise ValueError(f"unexpected NASADEM tile size: {path}")
            self._arrays[path] = values.reshape(EARTH_SAMPLES, EARTH_SAMPLES)
        return self._arrays[path]

    def sample(self, latitude: float, longitude: float) -> float | None:
        path = self.tile_path(latitude, longitude)
        values = self._array(path)
        tile_lat = math.floor(latitude)
        tile_lon = math.floor(longitude)
        row = int(round(((tile_lat + 1) - latitude) * 3600))
        column = int(round((longitude - tile_lon) * 3600))
        row = min(max(row, 0), EARTH_SAMPLES - 1)
        column = min(max(column, 0), EARTH_SAMPLES - 1)
        value = int(values[row, column])
        return None if value == EARTH_NODATA else float(value)

    def source_paths(self) -> list[Path]:
        return sorted(self.raw_root.glob("NASADEM_HGT_*/*.hgt"))


@dataclass(frozen=True)
class MolaRaster:
    values: np.ndarray
    north: float = 0.0
    south: float = -44.0
    west: float = 90.0
    east: float = 180.0
    pixels_per_degree: int = 128

    @classmethod
    def from_files(cls, image_path: Path, header_path: Path) -> "MolaRaster":
        header = Path(header_path).read_text(encoding="ascii")
        samples = int(re.search(r"samples\s*=\s*(\d+)", header).group(1))
        lines = int(re.search(r"lines\s*=\s*(\d+)", header).group(1))
        if (samples, lines) != (11520, 5632):
            raise ValueError("unexpected MOLA MEG128 dimensions")
        values = np.memmap(image_path, dtype=">i2", mode="r", shape=(lines, samples))
        return cls(values=values)

    def sample(self, latitude: float, longitude: float) -> float | None:
        if not self.south <= latitude <= self.north or not self.west <= longitude <= self.east:
            return None
        row = int(round((self.north - latitude) * self.pixels_per_degree))
        column = int(round((longitude - self.west) * self.pixels_per_degree))
        row = min(max(row, 0), self.values.shape[0] - 1)
        column = min(max(column, 0), self.values.shape[1] - 1)
        value = int(self.values[row, column])
        return None if value == 0 else float(value)
