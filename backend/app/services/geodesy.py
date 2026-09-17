"""WGS84 helpers for placing products in Cesium's ECEF frame."""

import math

import numpy as np

A = 6378137.0
E2 = 6.69437999014e-3


def geodetic_to_ecef(lon, lat, h):
    lon, lat = np.radians(lon), np.radians(lat)
    n = A / np.sqrt(1 - E2 * np.sin(lat) ** 2)
    return np.stack(
        [(n + h) * np.cos(lat) * np.cos(lon), (n + h) * np.cos(lat) * np.sin(lon), (n * (1 - E2) + h) * np.sin(lat)], -1
    )


def ecef_to_geodetic(xyz: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(lon°, lat°, ellipsoidal height m) for an (N, 3) array of ECEF points."""
    x, y, z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
    lon = np.arctan2(y, x)
    p = np.hypot(x, y)
    lat = np.arctan2(z, p * (1 - E2))
    h = np.zeros_like(p)
    for _ in range(6):
        n = A / np.sqrt(1 - E2 * np.sin(lat) ** 2)
        h = p / np.cos(lat) - n
        lat = np.arctan2(z, p * (1 - E2 * n / (n + h)))
    return np.degrees(lon), np.degrees(lat), h


def enu_matrix(lon0: float, lat0: float) -> np.ndarray:
    lo, la = math.radians(lon0), math.radians(lat0)
    e = [-math.sin(lo), math.cos(lo), 0.0]
    n = [-math.sin(la) * math.cos(lo), -math.sin(la) * math.sin(lo), math.cos(la)]
    u = [math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)]
    return np.array([e, n, u]).T  # columns = ENU axes in ECEF


def local_crs(lon0: float, lat0: float) -> str:
    """Transverse Mercator centred on the field: x/y equal ENU east/north to
    within a millimetre over a few hundred metres, and rasterio can transform into it."""
    return f"+proj=tmerc +lat_0={lat0} +lon_0={lon0} +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
