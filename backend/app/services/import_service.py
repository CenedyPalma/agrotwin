"""Manual import of processed survey data (§13 Mode B).

Every accepted format carries its own geographic placement — nothing is
positioned by guesswork:

  GeoTIFF   orthomosaic / ndvi / ndre / gndvi / dsm    CRS + bounds from the file
  GeoJSON   geojson                                     WGS84 lon/lat (RFC 7946)
  3D Tiles  model3d / tileset  (.zip with tileset.json) root volume/transform in ECEF
  LAS/LAZ   pointcloud                                  CRS from the projection records

A bare glTF/GLB/OBJ/PLY has no geographic placement, so it is refused with a
pointer to the georeferenced export rather than dropped at the field centre.

Files live in data/surveys/<survey>/imports/<asset>/ and are served by the
API (routers/surveys.get_asset_file), so an import appears in the viewer
without restarting the frontend server.
"""

import json
import math
import shutil
import zipfile
from pathlib import Path
from typing import BinaryIO

import numpy as np
from sqlalchemy.orm import Session

from app import models
from app.services import storage_service

RASTER_TYPES = {"orthomosaic", "ndvi", "ndre", "gndvi", "dsm"}
SINGLE_BAND_TYPES = {"ndvi", "ndre", "gndvi", "dsm"}
TILESET_TYPES = {"model3d", "tileset"}

ACCEPTED_SUFFIXES = {
    **{t: (".tif", ".tiff") for t in RASTER_TYPES},
    **{t: (".zip",) for t in TILESET_TYPES},
    "pointcloud": (".las", ".laz"),
    "geojson": (".geojson", ".json"),
}
UNPLACED_MODEL_SUFFIXES = {".glb", ".gltf", ".obj", ".ply", ".fbx", ".dae", ".3ds", ".osgb", ".stl"}
MAX_UNZIPPED_BYTES = 20 * 1024**3
GEOMETRY_TYPES = {"Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon", "GeometryCollection"}


class ImportRejected(ValueError):
    """The file can't be placed on the map; the message says what to export instead."""


def import_asset(db: Session, survey: models.Survey, asset_type: str, filename: str, fileobj: BinaryIO) -> models.SurveyAsset:
    suffix = Path(filename).suffix.lower()
    if asset_type not in ACCEPTED_SUFFIXES:
        raise ImportRejected(f"Unknown asset type '{asset_type}'")
    if suffix in UNPLACED_MODEL_SUFFIXES:
        raise ImportRejected(
            f"{filename} has no geographic placement, so it can't be put on the map. Export the model as "
            "Cesium 3D Tiles and import the .zip (Metashape: Export Tiled Model > Cesium 3D Tiles; "
            "DJI Terra: 3D Tiles output; OpenDroneMap: --3d-tiles)."
        )
    if suffix not in ACCEPTED_SUFFIXES[asset_type]:
        expected = " or ".join(ACCEPTED_SUFFIXES[asset_type])
        raise ImportRejected(f"A {asset_type} import must be a {expected} file, not {suffix or 'a file without extension'}.")

    asset = models.SurveyAsset(
        survey_id=survey.id, asset_type=asset_type, file_path="", format=suffix.lstrip("."), source="manual_import"
    )
    db.add(asset)
    db.flush()  # the id names the import folder

    root = storage_service.asset_import_dir(survey.id, asset.id)
    root.mkdir(parents=True, exist_ok=True)
    try:
        upload_path = root / filename
        with upload_path.open("wb") as f:
            shutil.copyfileobj(fileobj, f)
        if asset_type in RASTER_TYPES:
            _import_raster(asset, upload_path)
        elif asset_type == "geojson":
            _import_geojson(asset, upload_path)
        elif asset_type in TILESET_TYPES:
            _import_tileset(asset, upload_path, root)
        else:
            _import_pointcloud(asset, upload_path, root)
    except BaseException:
        shutil.rmtree(root, ignore_errors=True)
        raise
    return asset


def _bbox_geojson(west: float, south: float, east: float, north: float) -> str:
    return json.dumps({
        "type": "Polygon",
        "coordinates": [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
    })


def _import_raster(asset: models.SurveyAsset, path: Path) -> None:
    import rasterio
    from rasterio.errors import RasterioIOError

    from app.services.orthomosaic_service import extract_bounds_geojson

    try:
        with rasterio.open(path) as src:
            if src.crs is None:
                raise ImportRejected(f"{path.name} has no coordinate reference system — export it as a georeferenced GeoTIFF.")
            if asset.asset_type in SINGLE_BAND_TYPES and src.count != 1:
                raise ImportRejected(f"A {asset.asset_type} raster must have a single band; {path.name} has {src.count}.")
    except RasterioIOError as exc:
        raise ImportRejected(f"{path.name} is not a readable GeoTIFF: {exc}") from exc
    asset.file_path = str(path)
    asset.format = "tif"
    asset.bounds_geojson = json.dumps(extract_bounds_geojson(path))


def _import_geojson(asset: models.SurveyAsset, path: Path) -> None:
    from shapely.geometry import shape

    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ImportRejected(f"{path.name} is not valid JSON: {exc}") from exc

    kind = data.get("type") if isinstance(data, dict) else None
    if kind == "FeatureCollection":
        geometries = [f.get("geometry") for f in data.get("features") or [] if isinstance(f, dict)]
    elif kind == "Feature":
        geometries = [data.get("geometry")]
    elif kind in GEOMETRY_TYPES:
        geometries = [data]
    else:
        raise ImportRejected(f"{path.name} is not GeoJSON (no FeatureCollection, Feature or geometry at the top level).")

    crs_name = str(((data.get("crs") or {}).get("properties") or {}).get("name", ""))
    if crs_name and not any(tag in crs_name for tag in ("4326", "CRS84")):
        raise ImportRejected(f"{path.name} is in {crs_name}; GeoJSON must be WGS84 longitude/latitude. Reproject it first.")

    shapes = []
    for g in geometries:
        if not g:
            continue
        try:
            shapes.append(shape(g))
        except (ValueError, TypeError, AttributeError, KeyError) as exc:
            raise ImportRejected(f"{path.name} has an invalid geometry: {exc}") from exc
    shapes = [s for s in shapes if not s.is_empty]
    if not shapes:
        raise ImportRejected(f"{path.name} contains no geometries.")

    west = min(s.bounds[0] for s in shapes)
    south = min(s.bounds[1] for s in shapes)
    east = max(s.bounds[2] for s in shapes)
    north = max(s.bounds[3] for s in shapes)
    if not (-180 <= west <= east <= 180 and -90 <= south <= north <= 90):
        raise ImportRejected(
            f"{path.name}'s coordinates are not longitude/latitude (GeoJSON requires WGS84). Reproject it before importing."
        )
    asset.file_path = str(path)
    asset.format = "geojson"
    asset.bounds_geojson = _bbox_geojson(west, south, east, north)


def _import_tileset(asset: models.SurveyAsset, upload_path: Path, root: Path) -> None:
    if not zipfile.is_zipfile(upload_path):
        raise ImportRejected(f"{upload_path.name} is not a zip archive.")
    dest = root / "tiles"
    dest_resolved = dest.resolve()
    with zipfile.ZipFile(upload_path) as zf:
        members = zf.infolist()
        if sum(m.file_size for m in members) > MAX_UNZIPPED_BYTES:
            raise ImportRejected(f"{upload_path.name} unpacks to more than {MAX_UNZIPPED_BYTES // 1024**3} GB.")
        for m in members:
            if not (dest / m.filename).resolve().is_relative_to(dest_resolved):
                raise ImportRejected(f"{upload_path.name} contains an unsafe path: {m.filename}")
        zf.extractall(dest)
    upload_path.unlink()

    candidates = sorted(dest.rglob("tileset.json"), key=lambda p: len(p.relative_to(dest).parts))
    if not candidates:
        raise ImportRejected("The archive has no tileset.json — it must be a Cesium 3D Tiles export.")
    tileset_path = candidates[0]
    try:
        tileset = json.loads(tileset_path.read_text(encoding="utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ImportRejected(f"tileset.json is not valid JSON: {exc}") from exc

    placement = _tileset_placement(tileset.get("root") if isinstance(tileset, dict) else None)
    if placement is None:
        raise ImportRejected(
            "The tileset is in local coordinates (its root volume isn't on the globe), so it can't be placed. "
            "Export it georeferenced (Cesium 3D Tiles in a geographic/projected CRS)."
        )
    (west, south, east, north), lowest_h = placement
    placement_path = tileset_path.with_name("placement.json")
    if not placement_path.exists():
        # the viewer lifts the product so this height lands on its terrain (lib/cesiumPlacement.ts);
        # a field capture's lowest point is the ground
        placement_path.write_text(json.dumps({"ground_h": lowest_h, "estimated_from": "root bounding volume"}))

    asset.file_path = str(tileset_path)
    asset.format = "3dtiles"
    asset.bounds_geojson = _bbox_geojson(west, south, east, north)


def _tileset_placement(root) -> tuple[tuple[float, float, float, float], float] | None:
    """((west, south, east, north), lowest height) of a tileset's root volume,
    or None when the volume is in local coordinates."""
    from app.services.geodesy import ecef_to_geodetic

    if not isinstance(root, dict):
        return None
    bv = root.get("boundingVolume") or {}
    try:
        if "region" in bv:
            w, s, e, n, h_min, _ = (float(v) for v in bv["region"])
            return (math.degrees(w), math.degrees(s), math.degrees(e), math.degrees(n)), h_min
        transform = np.array(root["transform"], float).reshape(4, 4).T if "transform" in root else np.eye(4)
        if "box" in bv:
            b = np.array(bv["box"], float)
            c, axes = b[:3], b[3:].reshape(3, 3)
            corners = np.array(
                [c + sx * axes[0] + sy * axes[1] + sz * axes[2] for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
            )
            pad = 0.0
        elif "sphere" in bv:
            cx, cy, cz, pad = (float(v) for v in bv["sphere"])
            corners = np.array([[cx, cy, cz]])
        else:
            return None
    except (TypeError, ValueError):
        return None

    pts = (transform @ np.c_[corners, np.ones(len(corners))].T).T[:, :3]
    radii = np.linalg.norm(pts, axis=1)
    if not np.all((radii > 6.30e6) & (radii < 6.42e6)):
        return None
    lon, lat, h = ecef_to_geodetic(pts)
    dlat = math.degrees(pad / 6.371e6)
    dlon = dlat / max(math.cos(math.radians(float(lat.mean()))), 1e-6)
    bounds = (float(lon.min() - dlon), float(lat.min() - dlat), float(lon.max() + dlon), float(lat.max() + dlat))
    return bounds, float(h.min() - pad)


def _import_pointcloud(asset: models.SurveyAsset, upload_path: Path, root: Path) -> None:
    from app.services import pointcloud_service

    try:
        tileset_path, (west, south, east, north) = pointcloud_service.tile_las(upload_path, root / "tiles")
    except pointcloud_service.NoCoordinateSystemError as exc:
        raise ImportRejected(str(exc)) from exc
    except (OSError, ValueError) as exc:
        raise ImportRejected(f"{upload_path.name} could not be read as a LAS/LAZ point cloud: {exc}") from exc
    asset.file_path = str(tileset_path)
    asset.format = "3dtiles"
    asset.bounds_geojson = _bbox_geojson(west, south, east, north)
