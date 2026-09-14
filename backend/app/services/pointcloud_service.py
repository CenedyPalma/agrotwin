"""Coloured point clouds -> a small streamable 3D Tileset (plain POINTS glTF).

Two-level quadtree: a root subsample the whole field can show at once, then
four leaves holding the rest, so a laptop streams a few million points rather
than all of them. Points sit in a local ENU frame (stored glTF y-up as
(E, U, -N)) under an ENU->ECEF root transform with their absolute heights,
and placement.json declares the ground height so the viewer lifts the cloud
onto its terrain (frontend lib/cesiumPlacement.ts).
"""

import json
import logging
import shutil
import struct
from pathlib import Path

import numpy as np

from app.services.geodesy import enu_matrix, geodetic_to_ecef, local_crs

log = logging.getLogger(__name__)

DEFAULT_MAX_POINTS = 5_000_000
STRAY_HEIGHT_M = 40  # points this far above/below the median height are strays


class NoCoordinateSystemError(ValueError):
    pass


def box_volume(pos_enu: np.ndarray) -> dict:
    """3D Tiles oriented box in the tile frame (x=E, y=N, z=U)."""
    lo, hi = pos_enu.min(0), pos_enu.max(0)
    c, half = (lo + hi) / 2, (hi - lo) / 2 + 0.5
    return {"box": [*c.tolist(), half[0], 0, 0, 0, half[1], 0, 0, 0, half[2]]}


def write_points_glb(path: Path, pos: np.ndarray, rgb: np.ndarray) -> None:
    pos = pos.astype(np.float32)
    rgba = np.concatenate([rgb.astype(np.uint8), np.full((len(rgb), 1), 255, np.uint8)], 1)
    pb, cb = pos.tobytes(), rgba.tobytes()
    cb += b"\x00" * ((-len(cb)) % 4)
    gltf = {
        "asset": {"version": "2.0", "generator": "agrotwin pointcloud_service"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "COLOR_0": 1}, "mode": 0}]}],
        "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(pb)},
                        {"buffer": 0, "byteOffset": len(pb), "byteLength": len(cb)}],
        "accessors": [{"bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3",
                       "min": pos.min(0).tolist(), "max": pos.max(0).tolist()},
                      {"bufferView": 1, "componentType": 5121, "count": len(pos), "type": "VEC4", "normalized": True}],
        "buffers": [{"byteLength": len(pb) + len(cb)}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    bin_chunk = pb + cb
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_chunk)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack("<II", len(bin_chunk), 0x004E4942))
        f.write(bin_chunk)


def las_crs(header) -> str | None:
    """Horizontal CRS from a LAS header's projection records: OGC WKT, else
    the GeoTIFF key directory's EPSG code."""
    vlrs = list(header.vlrs) + list(getattr(header, "evlrs", None) or [])
    for vlr in vlrs:
        wkt = getattr(vlr, "string", None)
        if vlr.record_id == 2112 and wkt and wkt.strip("\x00 \n"):
            return wkt.strip("\x00 \n")
    for vlr in vlrs:
        if vlr.record_id == 34735:
            keys = {k.id: k.value_offset for k in getattr(vlr, "geo_keys", [])}
            code = keys.get(3072) or keys.get(2048)  # ProjectedCSTypeGeoKey, GeographicTypeGeoKey
            if code and code != 32767:  # 32767 = user-defined, not an EPSG code
                return f"EPSG:{code}"
    return None


def load_las(path: Path, max_points: int = DEFAULT_MAX_POINTS) -> tuple[np.ndarray, np.ndarray, int]:
    """(xyz, rgb uint8, total point count), thinned to about max_points."""
    import laspy

    with laspy.open(path) as f:
        n = f.header.point_count
        step = max(1, n // max_points)
        xyz_parts, rgb_parts = [], []
        for chunk in f.chunk_iterator(4_000_000):
            sel = np.arange(0, len(chunk), step)
            xyz_parts.append(np.column_stack([chunk.x[sel], chunk.y[sel], chunk.z[sel]]))
            if "red" in chunk.point_format.dimension_names:
                r, g, b = chunk.red[sel], chunk.green[sel], chunk.blue[sel]
                scale = 256 if max(int(r.max(initial=0)), int(g.max(initial=0)), int(b.max(initial=0))) > 255 else 1
                rgb_parts.append(np.column_stack([r // scale, g // scale, b // scale]))
            else:
                rgb_parts.append(np.full((len(sel), 3), 160, np.uint8))
    if not xyz_parts:
        raise ValueError(f"{path.name} contains no points")
    return np.concatenate(xyz_parts), np.concatenate(rgb_parts).astype(np.uint8), n


def tile_points(
    xyz: np.ndarray, rgb: np.ndarray, crs, out_dir: Path, ground_h: float | None = None
) -> tuple[Path, tuple[float, float, float, float]]:
    """Writes the tileset; returns (tileset.json path, (west, south, east, north))."""
    from rasterio.crs import CRS
    from rasterio.warp import transform

    src_crs = CRS.from_user_input(crs)
    z = xyz[:, 2].astype(np.float64)
    if src_crs.is_projected:
        # a State Plane cloud in (US survey) feet stores its heights in feet too
        z = z * src_crs.linear_units_factor[1]
    lon, lat = transform(src_crs, "EPSG:4326", xyz[:, 0].tolist(), xyz[:, 1].tolist())
    lon0, lat0 = float(np.mean(lon)), float(np.mean(lat))
    ex, ny = transform("EPSG:4326", local_crs(lon0, lat0), lon, lat)
    enu = np.column_stack([ex, ny, z])
    z_ground = float(np.median(z))
    sane = np.abs(z - z_ground) < STRAY_HEIGHT_M
    enu, rgb = enu[sane], rgb[sane]
    lon, lat = np.asarray(lon)[sane], np.asarray(lat)[sane]
    if len(enu) == 0:
        raise ValueError("no points left after removing height outliers")

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    def gltf_pos(p):
        return np.column_stack([p[:, 0], p[:, 2], -p[:, 1]])  # (E, U, -N)

    order = np.random.default_rng(0).permutation(len(enu))
    root_n = min(len(enu), max(200_000, len(enu) // 4))
    root_idx, rest = order[:root_n], order[root_n:]
    write_points_glb(out_dir / "root.glb", gltf_pos(enu[root_idx]), rgb[root_idx])
    root = {"boundingVolume": box_volume(enu), "geometricError": 3.0, "refine": "ADD",
            "content": {"uri": "root.glb"}, "children": []}
    cx, cy = np.median(enu[:, 0]), np.median(enu[:, 1])
    quadrants = {
        "sw": (enu[rest, 0] < cx) & (enu[rest, 1] < cy),
        "se": (enu[rest, 0] >= cx) & (enu[rest, 1] < cy),
        "nw": (enu[rest, 0] < cx) & (enu[rest, 1] >= cy),
        "ne": (enu[rest, 0] >= cx) & (enu[rest, 1] >= cy),
    }
    for name, sel in quadrants.items():
        idx = rest[sel]
        if len(idx) == 0:
            continue
        write_points_glb(out_dir / f"{name}.glb", gltf_pos(enu[idx]), rgb[idx])
        root["children"].append({"boundingVolume": box_volume(enu[idx]), "geometricError": 0.0, "refine": "ADD",
                                 "content": {"uri": f"{name}.glb"}})

    origin = geodetic_to_ecef(np.array([lon0]), np.array([lat0]), np.array([0.0]))[0]
    T = np.eye(4)
    T[:3, :3], T[:3, 3] = enu_matrix(lon0, lat0), origin
    root["transform"] = T.T.flatten().tolist()
    (out_dir / "tileset.json").write_text(json.dumps({"asset": {"version": "1.1"}, "geometricError": 50.0, "root": root}))
    (out_dir / "placement.json").write_text(json.dumps({"ground_h": float(ground_h if ground_h is not None else z_ground)}))
    log.info("wrote %s (%d points)", out_dir / "tileset.json", len(enu))
    return out_dir / "tileset.json", (float(lon.min()), float(lat.min()), float(lon.max()), float(lat.max()))


def tile_las(path: Path, out_dir: Path, max_points: int = DEFAULT_MAX_POINTS):
    import laspy

    with laspy.open(path) as f:
        crs = las_crs(f.header)
    if crs is None:
        raise NoCoordinateSystemError(
            f"{path.name} has no coordinate reference system (no WKT or GeoTIFF projection record) — "
            "export the point cloud georeferenced (e.g. in UTM) and import it again."
        )
    xyz, rgb, n = load_las(path, max_points)
    log.info("point cloud %s: kept %d of %d points", path.name, len(xyz), n)
    return tile_points(xyz, rgb, crs, out_dir)
