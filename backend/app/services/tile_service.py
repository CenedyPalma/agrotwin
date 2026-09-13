"""Web-Mercator XYZ tile pyramids for survey rasters (the Google-Maps model).

A single flat preview PNG cannot stay sharp when the user zooms in on a
crop row: 2048 px across a 250 m field is ~12 cm/px, however fine the
source raster is. A tile pyramid keeps the raster's native resolution at the
deepest zoom level and serves only the 256x256 tiles the view needs, so the
browser never decodes more than a few megapixels at once.

Layout (served as static files by Next.js, no tile server process):
    frontend/public/tiles/<survey_id>/<layer>/{z}/{x}/{y}.<webp|png>
    frontend/public/tiles/<survey_id>/<layer>/tilemeta.json

Deepest zoom is chosen from the raster's ground sample distance so the last
level is at (or slightly finer than) native resolution; coarser levels are
built bottom-up by 2x2 box-filtering the children with premultiplied alpha
(no dark fringes at the raster's edge). Reprojection to EPSG:3857 is done
per block through a rasterio WarpedVRT, so a multi-gigapixel orthophoto is
never held in memory.

Uses the same colour ramps as the flat previews (orthomosaic_service) so a
layer looks identical whichever provider the viewer picked.
"""

from __future__ import annotations

import json
import logging
import math
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

from app.config import settings
from app.services import orthomosaic_service as ortho

log = logging.getLogger(__name__)

TILE = 256
R = 6378137.0
ORIGIN = -math.pi * R  # web-mercator extent is [-ORIGIN, ORIGIN]
BLOCK_TILES = 8  # warp 8x8 tiles (2048 px) at a time
MIN_ZOOM = 14
MAX_ZOOM_CAP = 24
INDEX_LAYERS = {"ndvi", "ndre", "gndvi"}
ELEVATION_LAYERS = {"dsm", "dtm"}
SOURCE_RANK = {"photogrammetry_odm": 0, "direct_georeferencing": 1}


def tile_ext(layer: str) -> str:
    # photos compress far better as lossy WebP; colour ramps stay exact as PNG
    return "webp" if layer == "orthomosaic" else "png"


def lonlat_to_tile(lon: float, lat: float, z: int) -> tuple[int, int]:
    n = 2**z
    x = int((lon + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2.0 * n)
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)


def tile_size_m(z: int) -> float:
    return 2 * math.pi * R / (2**z)


def zoom_for_gsd(gsd_m: float, lat: float) -> int:
    """Deepest zoom whose ground resolution at this latitude is <= the raster's GSD."""
    ground_per_px_z0 = 2 * math.pi * R * math.cos(math.radians(lat)) / TILE
    z = math.ceil(math.log2(ground_per_px_z0 / gsd_m))
    return int(min(max(z, MIN_ZOOM), MAX_ZOOM_CAP))


def _source_gsd_m(src) -> float:
    if src.crs and src.crs.is_projected:
        return float(abs(src.res[0]))
    lat = (src.bounds.top + src.bounds.bottom) / 2
    return float(abs(src.res[0]) * 111320.0 * math.cos(math.radians(lat)))


def _stats_for_colorize(src, layer: str) -> tuple[float, float] | None:
    """Global stretch limits so every tile of a DSM shares one colour ramp."""
    if layer not in ELEVATION_LAYERS:
        return None
    scale = max(1, max(src.width, src.height) // 2048)
    arr = src.read(1, out_shape=(src.height // scale, src.width // scale), masked=True).astype(np.float32)
    vals = np.asarray(arr.compressed())
    if vals.size == 0:
        return (0.0, 1.0)
    lo, hi = np.percentile(vals, [2, 98])
    return (float(lo), float(hi if hi > lo else lo + 1.0))


def _colorize(bands: np.ndarray, alpha: np.ndarray, layer: str, stats) -> np.ndarray:
    """(bands, H, W) float + alpha (H, W) uint8 -> RGBA uint8."""
    valid = alpha > 0
    if layer in INDEX_LAYERS:
        rgba = ortho._colorize_index(bands[0], valid)
    elif layer in ELEVATION_LAYERS:
        lo, hi = stats
        v = np.clip((np.nan_to_num(bands[0], nan=lo) - lo) / (hi - lo), 0, 1)
        r = np.interp(v, ortho.ELEVATION_STOPS, [c[0] for c in ortho.ELEVATION_COLORS])
        g = np.interp(v, ortho.ELEVATION_STOPS, [c[1] for c in ortho.ELEVATION_COLORS])
        b = np.interp(v, ortho.ELEVATION_STOPS, [c[2] for c in ortho.ELEVATION_COLORS])
        rgba = np.dstack([r, g, b, np.zeros_like(r)]).astype(np.uint8)
    elif bands.shape[0] >= 3:
        rgb = [np.clip(np.nan_to_num(bands[i], nan=0), 0, 255).astype(np.uint8) for i in range(3)]
        rgba = np.dstack([*rgb, np.zeros_like(rgb[0])])
    else:
        g = np.clip(np.nan_to_num(bands[0], nan=0), 0, 255).astype(np.uint8)
        rgba = np.dstack([g, g, g, np.zeros_like(g)])
    rgba[..., 3] = alpha
    rgba[~valid, :3] = 0
    return rgba


def _save_tile(rgba: np.ndarray, path: Path, ext: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.fromarray(rgba, "RGBA")
    if ext == "webp":
        img.save(path, "WEBP", quality=88, method=4)
    else:
        img.save(path, "PNG", optimize=True)


def _load_tile(path: Path) -> np.ndarray | None:
    if not path.exists():
        return None
    with Image.open(path) as im:
        return np.asarray(im.convert("RGBA"))


def _downsample(parent: np.ndarray) -> np.ndarray:
    """512x512 RGBA -> 256x256 with premultiplied-alpha box filter."""
    f = parent.astype(np.float32)
    a = f[..., 3:4] / 255.0
    pre = np.concatenate([f[..., :3] * a, a], axis=-1)
    box = pre.reshape(TILE, 2, TILE, 2, 4).mean(axis=(1, 3))
    out_a = box[..., 3:4]
    rgb = np.where(out_a > 1e-6, box[..., :3] / np.maximum(out_a, 1e-6), 0)
    return np.concatenate([rgb, out_a * 255.0], axis=-1).round().clip(0, 255).astype(np.uint8)


def build_xyz_tiles(src_path: Path, out_dir: Path, layer: str, max_zoom: int | None = None,
                    min_zoom: int = MIN_ZOOM) -> dict:
    """Builds the pyramid for one raster; returns the tilemeta that was written."""
    import rasterio
    from rasterio.enums import ColorInterp, Resampling
    from rasterio.transform import from_origin
    from rasterio.vrt import WarpedVRT
    from rasterio.windows import Window

    ext = tile_ext(layer)
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    with rasterio.open(src_path) as src:
        west, south, east, north = ortho.get_bounds_wsen(src_path)
        lat_c = (south + north) / 2
        gsd = _source_gsd_m(src)
        zmax = max_zoom if max_zoom is not None else zoom_for_gsd(gsd, lat_c)
        zmin = min(min_zoom, zmax)
        stats = _stats_for_colorize(src, layer)
        has_alpha = src.count in (2, 4) and src.colorinterp[-1] == ColorInterp.alpha
        data_bands = src.count - 1 if has_alpha else src.count

        x0, y0 = lonlat_to_tile(west, north, zmax)
        x1, y1 = lonlat_to_tile(east, south, zmax)
        res = tile_size_m(zmax) / TILE
        grid_w, grid_h = (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE
        transform = from_origin(ORIGIN + x0 * tile_size_m(zmax), -ORIGIN - y0 * tile_size_m(zmax), res, res)
        log.info("tiles %s: z%d..%d, %dx%d tiles at z%d (%.1f cm/px ground), gsd %.1f cm",
                 layer, zmin, zmax, x1 - x0 + 1, y1 - y0 + 1, zmax, res * math.cos(math.radians(lat_c)) * 100, gsd * 100)

        vrt_kwargs = dict(crs="EPSG:3857", transform=transform, width=grid_w, height=grid_h,
                          resampling=Resampling.bilinear)
        if not has_alpha:
            vrt_kwargs["add_alpha"] = True
        written = 0
        with WarpedVRT(src, **vrt_kwargs) as vrt:
            for by in range(0, y1 - y0 + 1, BLOCK_TILES):
                for bx in range(0, x1 - x0 + 1, BLOCK_TILES):
                    nty = min(BLOCK_TILES, y1 - y0 + 1 - by)
                    ntx = min(BLOCK_TILES, x1 - x0 + 1 - bx)
                    win = Window(bx * TILE, by * TILE, ntx * TILE, nty * TILE)
                    block = vrt.read(window=win).astype(np.float32)
                    alpha = np.clip(block[-1], 0, 255).astype(np.uint8)
                    if not alpha.any():
                        continue
                    rgba = _colorize(block[:data_bands], alpha, layer, stats)
                    for ty in range(nty):
                        for tx in range(ntx):
                            tile = rgba[ty * TILE:(ty + 1) * TILE, tx * TILE:(tx + 1) * TILE]
                            if not tile[..., 3].any():
                                continue
                            _save_tile(tile, out_dir / str(zmax) / str(x0 + tx + bx) / f"{y0 + ty + by}.{ext}", ext)
                            written += 1
                log.info("tiles %s: z%d row block %d/%d", layer, zmax, by // BLOCK_TILES + 1,
                         math.ceil((y1 - y0 + 1) / BLOCK_TILES))

    # coarser levels from the children
    for z in range(zmax - 1, zmin - 1, -1):
        cx0, cy0 = lonlat_to_tile(west, north, z)
        cx1, cy1 = lonlat_to_tile(east, south, z)
        for x in range(cx0, cx1 + 1):
            for y in range(cy0, cy1 + 1):
                parent = np.zeros((2 * TILE, 2 * TILE, 4), np.uint8)
                any_child = False
                for dy in (0, 1):
                    for dx in (0, 1):
                        child = _load_tile(out_dir / str(z + 1) / str(2 * x + dx) / f"{2 * y + dy}.{ext}")
                        if child is not None:
                            parent[dy * TILE:(dy + 1) * TILE, dx * TILE:(dx + 1) * TILE] = child
                            any_child = True
                if any_child:
                    _save_tile(_downsample(parent), out_dir / str(z) / str(x) / f"{y}.{ext}", ext)
                    written += 1

    written += fill_blank_tiles(out_dir, west, south, east, north, zmin, zmax, ext)

    meta = {
        "layer": layer,
        "bounds": [west, south, east, north],
        "minzoom": zmin,
        "maxzoom": zmax,
        "format": ext,
        "tile_size": TILE,
        "scheme": "xyz",
        "source_gsd_m": round(gsd, 4),
        "tiles": written,
    }
    (out_dir / "tilemeta.json").write_text(json.dumps(meta, indent=2))
    log.info("tiles %s: %d tiles written to %s", layer, written, out_dir)
    return meta


def fill_blank_tiles(out_dir: Path, west, south, east, north, zmin: int, zmax: int, ext: str) -> int:
    """Writes a fully transparent tile at every in-bounds position that has
    no data, so the viewer never logs 404s for the raster's empty corners."""
    blank = np.zeros((TILE, TILE, 4), np.uint8)
    n = 0
    for z in range(zmin, zmax + 1):
        x0, y0 = lonlat_to_tile(west, north, z)
        x1, y1 = lonlat_to_tile(east, south, z)
        # one tile of margin: Cesium's rectangle->tile range can round outwards
        for x in range(max(x0 - 1, 0), min(x1 + 2, 2**z)):
            for y in range(max(y0 - 1, 0), min(y1 + 2, 2**z)):
                path = out_dir / str(z) / str(x) / f"{y}.{ext}"
                if not path.exists():
                    _save_tile(blank, path, ext)
                    n += 1
    return n


def public_tiles_dir(survey_id: str, layer: str) -> Path:
    return settings.public_tiles_dir / survey_id / layer


def tiles_url(survey_id: str, layer: str) -> str:
    return f"/tiles/{survey_id}/{layer}"


def build_survey_tiles(db, survey, layers: tuple[str, ...] = ("orthomosaic", "ndvi", "ndre", "gndvi", "dsm"),
                       max_zoom: int | None = None) -> list:
    """Tiles each of the survey's GeoTIFF rasters and registers an "xyz" asset
    next to the source raster asset (same asset_type, format="xyz")."""
    from app import models

    created = []
    for layer in layers:
        cands = [a for a in survey.assets if a.asset_type == layer and (a.format or "").lower() in ("tif", "tiff")
                 and a.path.exists()]
        if not cands:
            continue
        src = min(cands, key=lambda a: SOURCE_RANK.get(a.source, 2))
        out_dir = public_tiles_dir(survey.id, layer)
        meta = build_xyz_tiles(src.path, out_dir, layer, max_zoom=max_zoom)
        for old in [a for a in survey.assets if a.asset_type == layer and a.format == "xyz"]:
            db.delete(old)
        db.flush()
        asset = models.SurveyAsset(
            survey_id=survey.id, asset_type=layer, file_path=str(out_dir), format="xyz",
            bounds_geojson=json.dumps(ortho.extract_bounds_geojson(src.path)), source=src.source,
        )
        db.add(asset)
        created.append(asset)
        log.info("registered xyz asset %s (z%d..%d)", layer, meta["minzoom"], meta["maxzoom"])
    db.flush()
    return created
