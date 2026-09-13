#!/usr/bin/env python3
"""Dense photogrammetry for the 3D Twin: GPU multi-view stereo on the survey's
frames -> dense point cloud, digital surface model, and a mesh.

Runs with the GPU splat venv, after build_splats.py has produced the
geo-aligned sparse model + undistorted workspace:
    ~/venvs/splat/bin/python -m scripts.build_dense --survey <id>

Dense geometry source (--source):
  splats (default)  the GPU-trained 3DGS reconstruction from build_splats.py:
                    each Gaussian's centre is a surface sample with colour
                    (SH0) and a normal (the ellipsoid's shortest axis, from
                    its quaternion + scales). Floaters are pruned the same
                    way tile_splats_spz.py does.
  mvs               COLMAP PatchMatch stereo + fusion — needs a CUDA build
                    of pycolmap (the PyPI wheel is CPU-only and refuses).

  outputs
       points   voxel-thinned point cloud -> 3D Tiles (plain POINTS glb)
                frontend/public/models/<survey_id>/points/
       dsm      digital surface model GeoTIFF (UTM, --dsm-gsd m/px): the
                upper envelope of the dense cloud — ground + crop + trees
                data/surveys/<survey_id>/outputs/dsm.tif  (asset type "dsm")
       mesh     2.5D terrain mesh from the DSM, textured with the RGB quick
                mosaic (glTF baseColorTexture, unlit) -> 3D Tiles glb
                frontend/public/models/<survey_id>/mesh/

The model frame is build_splats' glTF frame (x=E, y=U about the mean camera
height, z=-N); ENU origin (lat0, lon0, h0) comes from geo.json. Like the
splats, tiles are placed with the ground on the ellipsoid because the
viewer renders no terrain (--ground-at-ellipsoid).

Everything is derived from the real frames — nothing is synthesised.
"""

import argparse
import json
import math
import sqlite3
import struct
import sys
from pathlib import Path

import numpy as np
from plyfile import PlyData, PlyElement

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tile_splats_spz import enu_to_geodetic  # noqa: E402

AGROTWIN = Path(__file__).resolve().parents[2]
DB_PATH = AGROTWIN / "data" / "agrotwin.db"
SPLATS_DIR = AGROTWIN / "data" / "splats"
PUBLIC_MODELS = AGROTWIN / "frontend" / "public" / "models"
SPLAT_TOOLS = next((d for d in (Path(__file__).resolve().parents[2].parent / "CesiumSplatData",
                                Path("/media/cdev/Personal1/Development/Agro/CesiumSplatData")) if d.exists()),
                   Path("/media/cdev/Personal1/Development/Agro/CesiumSplatData"))


def log(msg):
    print(msg, flush=True)


# ---------------------------------------------------------------- MVS
def run_mvs(work: Path, max_image_size: int, fused: Path):
    import pycolmap

    if fused.exists():
        log("MVS: fused.ply exists, skipping")
        return
    depth_dir = work / "stereo" / "depth_maps"
    done = list(depth_dir.glob("*.geometric.bin")) if depth_dir.exists() else []
    if len(done) < 200:
        log(f"MVS 1/2: PatchMatch stereo on GPU (max {max_image_size}px, geometric consistency)")
        opts = pycolmap.PatchMatchOptions()
        opts.max_image_size = max_image_size
        opts.geom_consistency = True
        opts.num_iterations = 5
        opts.window_radius = 5
        opts.cache_size = 12
        pycolmap.patch_match_stereo(str(work), options=opts)
    else:
        log(f"MVS 1/2: {len(done)} geometric depth maps exist, skipping")
    log("MVS 2/2: stereo fusion")
    fopts = pycolmap.StereoFusionOptions()
    fopts.max_image_size = max_image_size
    fopts.min_num_pixels = 3
    pycolmap.stereo_fusion(str(fused), str(work), input_type="geometric", options=fopts)
    log(f"MVS: wrote {fused} ({fused.stat().st_size / 1e6:.0f} MB)")


# ---------------------------------------------------------------- helpers
SH_C0 = 0.28209479177387814


def read_splats(path: Path, band_m: float = 15.0):
    """3DGS ply -> surface samples: centres, SH0 colour, normal = shortest
    ellipsoid axis (oriented +up). Prunes floaters / faint / huge splats."""
    v = PlyData.read(str(path))["vertex"]
    pos = np.stack([v["x"], v["y"], v["z"]], axis=1).astype(np.float32)
    f_dc = np.stack([v[f"f_dc_{i}"] for i in range(3)], axis=1).astype(np.float32)
    col = np.clip((0.5 + SH_C0 * f_dc) * 255, 0, 255).astype(np.uint8)
    opacity = 1 / (1 + np.exp(-np.asarray(v["opacity"], np.float32)))
    log_scale = np.stack([v[f"scale_{i}"] for i in range(3)], axis=1).astype(np.float32)
    q = np.stack([v[f"rot_{i}"] for i in range(4)], axis=1).astype(np.float64)  # w x y z
    q /= np.linalg.norm(q, axis=1, keepdims=True).clip(min=1e-12)
    w, x, y, z = q.T
    R = np.stack([
        np.stack([1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], -1),
        np.stack([2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], -1),
        np.stack([2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)], -1),
    ], axis=1)  # (n,3,3), columns = ellipsoid axes
    k = np.argmin(log_scale, axis=1)
    nrm = R[np.arange(len(R)), :, k].astype(np.float32)
    nrm[nrm[:, 1] < 0] *= -1  # orient upwards (glTF y = up)

    ground = float(np.median(pos[:, 1]))
    keep = (np.abs(pos[:, 1] - ground) < band_m) & (opacity > 0.05) & (np.exp(log_scale).max(axis=1) < 3.0)
    log(f"splats: {int(keep.sum())}/{len(keep)} kept as surface samples (ground y≈{ground:.1f})")
    return pos[keep], col[keep], nrm[keep]


def read_fused(path: Path):
    v = PlyData.read(str(path))["vertex"]
    pos = np.stack([v["x"], v["y"], v["z"]], axis=1).astype(np.float32)
    col = np.stack([v["red"], v["green"], v["blue"]], axis=1).astype(np.uint8)
    nrm = np.stack([v["nx"], v["ny"], v["nz"]], axis=1).astype(np.float32) if "nx" in v.data.dtype.names else None
    return pos, col, nrm


def voxel_thin(pos, voxel):
    keys = np.floor(pos / voxel).astype(np.int64)
    _, idx = np.unique(keys, axis=0, return_index=True)
    return np.sort(idx)


def write_glb(path: Path, pos: np.ndarray, col: np.ndarray, indices: np.ndarray | None = None):
    """Minimal glTF 2.0 binary: POINTS (indices None) or TRIANGLES with vertex colours."""
    pos = pos.astype(np.float32)
    rgba = np.hstack([col.astype(np.uint8), np.full((len(col), 1), 255, np.uint8)])
    chunks = [pos.tobytes(), rgba.tobytes()]
    if indices is not None:
        chunks.append(indices.astype(np.uint32).tobytes())
    views, off = [], 0
    for c in chunks:
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(c)})
        off += len(c) + ((-len(c)) % 4)
    binc = b"".join(c + b"\0" * ((-len(c)) % 4) for c in chunks)
    accessors = [
        {"bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": pos.min(0).tolist(), "max": pos.max(0).tolist()},
        {"bufferView": 1, "componentType": 5121, "count": len(pos), "type": "VEC4", "normalized": True},
    ]
    prim = {"mode": 0 if indices is None else 4, "attributes": {"POSITION": 0, "COLOR_0": 1}}
    if indices is not None:
        accessors.append({"bufferView": 2, "componentType": 5125, "count": len(indices), "type": "SCALAR"})
        prim["indices"] = 2
        prim["material"] = 0
    gltf = {
        "asset": {"version": "2.0", "generator": "agrotwin build_dense.py"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [prim]}],
        "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": len(binc)}],
    }
    if indices is not None:
        gltf["materials"] = [{"pbrMetallicRoughness": {"metallicFactor": 0.0, "roughnessFactor": 1.0}, "doubleSided": True}]
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binc)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(binc), 0x004E4942)); f.write(binc)


def write_tileset(out: Path, uri: str, lo, hi, center, meta: dict, ground_y: float):
    import importlib.util

    spec = importlib.util.spec_from_file_location("ts", SPLAT_TOOLS / "tile_splat.py")
    ts = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ts)
    e, u, n = float(center[0]), float(center[1]), float(-center[2])
    lat, lon, _ = enu_to_geodetic(e, n, u, meta["lat0"], meta["lon0"], meta["h0"])
    h = u - ground_y  # ground plane on the ellipsoid (viewer has no terrain)
    R = ts.enu_to_ecef_matrix(lon, lat)
    T = np.eye(4)
    T[:3, :3], T[:3, 3] = R, ts.lonlat_to_ecef(lon, lat, h)
    half = ((hi - lo) / 2).tolist()
    tileset = {
        "asset": {"version": "1.1"},
        "geometricError": float(max(half) * 4 + 10),
        "root": {
            "transform": T.T.reshape(-1).tolist(),
            "boundingVolume": {"box": [0, 0, 0, half[0], 0, 0, 0, half[1], 0, 0, 0, half[2]]},
            "geometricError": 0.0, "refine": "ADD", "content": {"uri": uri},
        },
    }
    (out / "tileset.json").write_text(json.dumps(tileset))
    (out / "placement.json").write_text(json.dumps({"lon": lon, "lat": lat, "h": h}, indent=2))


# ---------------------------------------------------------------- outputs
def build_points(pos, col, meta, ground_y, out: Path, voxel: float):
    keep = voxel_thin(pos, voxel)
    p, c = pos[keep], col[keep]
    lo, hi = p.min(0), p.max(0)
    center = (lo + hi) / 2
    out.mkdir(parents=True, exist_ok=True)
    write_glb(out / "points.glb", p - center, c)
    write_tileset(out, "points.glb", lo - center, hi - center, center, meta, ground_y)
    log(f"points: {len(p)} points at {voxel} m -> {out / 'tileset.json'} ({(out / 'points.glb').stat().st_size / 1e6:.1f} MB)")
    return len(p)


def fill_holes(dsm: np.ndarray, iterations: int = 12) -> np.ndarray:
    """Fills NaN cells from the mean of their 3x3 neighbours, repeatedly, so
    small gaps between surface samples close while the outer edge (no
    neighbours at all) stays open."""
    out = dsm.copy()
    for _ in range(iterations):
        nan = np.isnan(out)
        if not nan.any():
            break
        padded = np.pad(out, 1, constant_values=np.nan)
        stack = np.stack([padded[dy:dy + out.shape[0], dx:dx + out.shape[1]] for dy in range(3) for dx in range(3)])
        with np.errstate(all="ignore"):
            mean = np.nanmean(stack, axis=0)
            cnt = np.sum(~np.isnan(stack), axis=0)
        fill = nan & (cnt >= 3)
        if not fill.any():
            break
        out[fill] = mean[fill]
    return out


def build_dsm(pos, meta, out_tif: Path, gsd: float):
    import rasterio
    from rasterio.transform import from_origin
    from rasterio.warp import transform as warp_transform

    E, N, U = pos[:, 0], -pos[:, 2], pos[:, 1] + meta["h0"]  # true ellipsoidal heights
    lat0, lon0 = meta["lat0"], meta["lon0"]
    zone = int((lon0 + 180) // 6) + 1
    epsg = (32600 if lat0 >= 0 else 32700) + zone
    ox, oy = warp_transform("EPSG:4326", f"EPSG:{epsg}", [lon0], [lat0])
    X, Y = E + ox[0], N + oy[0]
    x0, y1 = X.min(), Y.max()
    W = int(math.ceil((X.max() - x0) / gsd)) + 1
    H = int(math.ceil((y1 - Y.min()) / gsd)) + 1
    cols = ((X - x0) / gsd).astype(np.int64)
    rows = ((y1 - Y) / gsd).astype(np.int64)
    dsm = np.full(H * W, -np.inf, np.float32)
    np.maximum.at(dsm, rows * W + cols, U.astype(np.float32))  # upper envelope per cell
    dsm = dsm.reshape(H, W)
    dsm[~np.isfinite(dsm)] = np.nan
    raw_cov = float(np.isfinite(dsm).mean())
    dsm = fill_holes(dsm)
    out_tif.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(
        out_tif, "w", driver="GTiff", height=H, width=W, count=1, dtype="float32",
        crs=f"EPSG:{epsg}", transform=from_origin(x0, y1, gsd, gsd), nodata=np.nan, compress="deflate", tiled=True,
    ) as dst:
        dst.write(dsm, 1)
    log(f"dsm: {W}x{H} @ {gsd} m, {raw_cov:.0%} sampled -> {np.isfinite(dsm).mean():.0%} after hole filling, "
        f"height {np.nanmin(dsm):.1f}..{np.nanmax(dsm):.1f} m -> {out_tif}")
    return epsg


def build_dtm(dsm_path: Path, out_tif: Path, open_m: float = 40.0, smooth_m: float = 1.5) -> Path:
    """Bare-earth terrain from the surface model by morphological opening:
    a min filter removes everything narrower than `open_m` (trees, hedges,
    the crop canopy), the max filter restores the ground shape, then a light
    Gaussian smooth. A 2.5D heightfield can only hold one height per cell,
    so meshing the DSM turns every tree edge into a vertical curtain; meshing
    the DTM gives a smooth ground that imagery drapes onto cleanly — trees
    live in the point cloud / splats / true-3D mesh instead."""
    import rasterio
    from scipy import ndimage

    with rasterio.open(dsm_path) as src:
        dsm = src.read(1)
        profile = src.profile
        gsd = abs(src.transform.a)
    valid = np.isfinite(dsm)
    filled = np.where(valid, dsm, np.nanmax(dsm))  # nodata never wins a min filter
    size = max(3, int(round(open_m / gsd)) | 1)
    ground = ndimage.maximum_filter(ndimage.minimum_filter(filled, size=size), size=size)
    ground = np.minimum(ground, filled)  # never above the surface
    sigma = max(0.5, smooth_m / gsd)
    sm = ndimage.gaussian_filter(np.where(valid, ground, 0.0), sigma)
    wt = ndimage.gaussian_filter(valid.astype(np.float32), sigma)
    dtm = np.where(wt > 0.05, sm / np.maximum(wt, 1e-6), np.nan).astype(np.float32)
    dtm[~valid] = np.nan
    with rasterio.open(out_tif, "w", **profile) as dst:
        dst.write(dtm, 1)
    log(f"dtm: opening {size} cells ({size * gsd:.0f} m), removed up to {np.nanmax(dsm - dtm):.1f} m of canopy -> {out_tif}")
    return out_tif


def build_mesh(dsm_path: Path, ortho_path: Path | None, meta, ground_y, out: Path, texture_px: int = 2048):
    """2.5D textured terrain: a regular grid over the DSM (vertices at cell
    centres, two triangles per cell where all four corners have data) with
    the RGB quick mosaic reprojected onto the same grid as a baseColor
    texture (unlit, so it reads like the orthophoto). Placed like the
    other tiles: ground plane on the ellipsoid, glTF frame (E, U, -N)."""
    import io

    import rasterio
    from rasterio.warp import Resampling, reproject
    from PIL import Image

    with rasterio.open(dsm_path) as src:
        dsm = src.read(1)
        tf = src.transform
        crs = src.crs
    H, W = dsm.shape
    gsd = abs(tf.a)
    valid = np.isfinite(dsm)

    # keep only cells the orthophoto actually covers — outside it the DSM is
    # tree tops and stray samples with nothing to texture them
    if ortho_path is not None and ortho_path.exists():
        with rasterio.open(ortho_path) as src:
            cov = np.zeros((H, W), np.uint8)
            reproject(rasterio.band(src, 1), cov, src_transform=src.transform, src_crs=src.crs,
                      dst_transform=tf, dst_crs=crs, src_nodata=0, dst_nodata=0, resampling=Resampling.nearest)
        valid &= cov > 0
        # and erode one cell so the border triangles don't stretch to nodata
        pad = np.pad(valid, 1)
        valid = pad[1:-1, 1:-1] & pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]

    # vertex grid (E, N relative to the UTM origin of the ENU frame)
    from rasterio.warp import transform as warp_transform

    ox, oy = warp_transform("EPSG:4326", crs, [meta["lon0"]], [meta["lat0"]])
    rows, cols = np.mgrid[0:H, 0:W]
    X = tf.c + (cols + 0.5) * tf.a - ox[0]
    Y = tf.f + (rows + 0.5) * tf.e - oy[0]
    Uy = np.where(valid, dsm - meta["h0"], ground_y)  # back to glTF y (about camera height)
    pos = np.stack([X, Uy, -Y], axis=-1).reshape(-1, 3).astype(np.float32)  # (E, U, -N)
    uv = np.stack([(cols + 0.5) / W, (rows + 0.5) / H], axis=-1).reshape(-1, 2).astype(np.float32)

    # faces: only cells whose 4 corners are valid
    idx = np.arange(H * W).reshape(H, W)
    q = valid[:-1, :-1] & valid[:-1, 1:] & valid[1:, :-1] & valid[1:, 1:]
    a, b, c, d = idx[:-1, :-1][q], idx[:-1, 1:][q], idx[1:, :-1][q], idx[1:, 1:][q]
    faces = np.concatenate([np.stack([a, c, b], -1), np.stack([b, c, d], -1)]).astype(np.uint32)  # CCW seen from +y
    if len(faces) == 0:
        log("mesh: no valid cells")
        return None

    # texture: orthomosaic reprojected to the DSM grid (finer for detail)
    tex = None
    if ortho_path is not None and ortho_path.exists():
        scale = max(1, int(round(texture_px / max(W, H))))
        tw, th = W * scale, H * scale
        ttf = rasterio.Affine(tf.a / scale, 0, tf.c, 0, tf.e / scale, tf.f)
        with rasterio.open(ortho_path) as src:
            rgb = np.zeros((3, th, tw), np.uint8)
            for i in range(3):
                reproject(rasterio.band(src, i + 1), rgb[i], src_transform=src.transform, src_crs=src.crs,
                          dst_transform=ttf, dst_crs=crs, src_nodata=0, dst_nodata=0, resampling=Resampling.bilinear)
        img = Image.fromarray(np.transpose(rgb, (1, 2, 0)))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=88)
        tex = buf.getvalue()

    center = ((pos.min(0) + pos.max(0)) / 2).astype(np.float32)
    out.mkdir(parents=True, exist_ok=True)
    write_textured_glb(out / "mesh.glb", pos - center, uv, faces.reshape(-1), tex)
    write_tileset(out, "mesh.glb", pos.min(0) - center, pos.max(0) - center, center, meta, ground_y)
    log(f"mesh: {len(pos)} vertices, {len(faces)} triangles, texture {'yes' if tex else 'no'} -> {out / 'tileset.json'} ({(out / 'mesh.glb').stat().st_size / 1e6:.1f} MB)")
    return len(faces)


def write_textured_glb(path: Path, pos, uv, indices, tex_jpeg: bytes | None):
    pos = pos.astype(np.float32)
    chunks = [pos.tobytes(), uv.astype(np.float32).tobytes(), indices.astype(np.uint32).tobytes()]
    if tex_jpeg:
        chunks.append(tex_jpeg)
    views, off = [], 0
    for c in chunks:
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(c)})
        off += len(c) + ((-len(c)) % 4)
    binc = b"".join(c + b"\0" * ((-len(c)) % 4) for c in chunks)
    prim = {"mode": 4, "attributes": {"POSITION": 0, "TEXCOORD_0": 1}, "indices": 2, "material": 0}
    material = {"pbrMetallicRoughness": {"metallicFactor": 0.0, "roughnessFactor": 1.0}, "doubleSided": True,
                "extensions": {"KHR_materials_unlit": {}}}
    gltf = {
        "asset": {"version": "2.0", "generator": "agrotwin build_dense.py"},
        "extensionsUsed": ["KHR_materials_unlit"],
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [prim]}],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": pos.min(0).tolist(), "max": pos.max(0).tolist()},
            {"bufferView": 1, "componentType": 5126, "count": len(uv), "type": "VEC2"},
            {"bufferView": 2, "componentType": 5125, "count": len(indices), "type": "SCALAR"},
        ],
        "bufferViews": views, "buffers": [{"byteLength": len(binc)}], "materials": [material],
    }
    if tex_jpeg:
        gltf["images"] = [{"bufferView": 3, "mimeType": "image/jpeg"}]
        gltf["samplers"] = [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}]
        gltf["textures"] = [{"sampler": 0, "source": 0}]
        material["pbrMetallicRoughness"]["baseColorTexture"] = {"index": 0}
    else:
        material["pbrMetallicRoughness"]["baseColorFactor"] = [0.55, 0.6, 0.45, 1.0]
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binc)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(binc), 0x004E4942)); f.write(binc)


def register_assets(survey_id: str, dsm_path: Path, points_dir: Path, mesh_dir: Path | None, epsg: int,
                    dtm_path: Path | None = None):
    """Registers the outputs as SurveyAssets (source='photogrammetry')."""
    sys.path.insert(0, str(AGROTWIN / "backend"))
    con = sqlite3.connect(DB_PATH)
    con.execute("DELETE FROM survey_assets WHERE survey_id=? AND source='photogrammetry'", (survey_id,))
    import uuid
    from datetime import datetime, timezone

    rows = [("dsm", str(dsm_path), "tif"), ("pointcloud", str(points_dir / "tileset.json"), "json")]
    if dtm_path is not None:
        rows.append(("dtm", str(dtm_path), "tif"))
    if mesh_dir is not None:
        rows.append(("model3d", str(mesh_dir / "tileset.json"), "json"))
    for asset_type, path, fmt in rows:
        bounds = None
        if fmt == "tif":
            import rasterio
            from rasterio.warp import transform_bounds

            with rasterio.open(path) as src:
                w, s, e, n = transform_bounds(src.crs, "EPSG:4326", *src.bounds)
            bounds = json.dumps({"type": "Polygon", "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]})
        con.execute(
            "INSERT INTO survey_assets (id, survey_id, asset_type, file_path, format, bounds_geojson, source, created_at) VALUES (?,?,?,?,?,?,?,?)",
            (uuid.uuid4().hex[:12], survey_id, asset_type, path, fmt, bounds, "photogrammetry", datetime.now(timezone.utc).isoformat(sep=" ")),
        )
    con.commit()
    con.close()
    log("registered dsm / pointcloud / model3d assets")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--survey", required=True)
    ap.add_argument("--source", choices=["splats", "mvs"], default="splats")
    ap.add_argument("--max-image-size", type=int, default=1200)
    ap.add_argument("--voxel", type=float, default=0.10, help="point-cloud thinning (m)")
    ap.add_argument("--dsm-gsd", type=float, default=0.5)
    ap.add_argument("--skip-mesh", action="store_true")
    ap.add_argument("--dtm-open-m", type=float, default=40.0, help="opening window for the bare-earth DTM (m)")
    ap.add_argument("--texture-px", type=int, default=4096)
    args = ap.parse_args()

    proj = SPLATS_DIR / args.survey
    work = proj / "colmap-workspace" / "undistorted"
    geo = next(p for p in (proj / "geo.json", proj / "colmap-workspace" / "geo.json") if p.exists())
    meta = json.loads(geo.read_text())

    if args.source == "mvs":
        if not (work / "sparse" / "cameras.bin").exists():
            sys.exit("run build_splats.py first (needs the geo-aligned undistorted workspace)")
        fused = work / "fused.ply"
        run_mvs(work, args.max_image_size, fused)
        pos, col, nrm = read_fused(fused)
        ground_y = float(np.median(pos[:, 1]))
        keep = np.abs(pos[:, 1] - ground_y) < 25
        pos, col, nrm = pos[keep], col[keep], (nrm[keep] if nrm is not None else None)
    else:
        ply = proj / "exports" / "splat.ply"
        if not ply.exists():
            sys.exit("run build_splats.py first (needs exports/splat.ply)")
        pos, col, nrm = read_splats(ply)
        ground_y = float(np.median(pos[:, 1]))
    log(f"dense cloud: {len(pos)} points, ground plane y≈{ground_y:.1f} m")

    points_dir = PUBLIC_MODELS / args.survey / "points"
    build_points(pos, col, meta, ground_y, points_dir, args.voxel)
    dsm_path = AGROTWIN / "data" / "surveys" / args.survey / "outputs" / "dsm.tif"
    epsg = build_dsm(pos, meta, dsm_path, args.dsm_gsd)
    dtm_path = build_dtm(dsm_path, dsm_path.with_name("dtm.tif"), args.dtm_open_m)
    mesh_dir = None
    if not args.skip_mesh:
        mesh_dir = PUBLIC_MODELS / args.survey / "mesh"
        ortho = AGROTWIN / "data" / "surveys" / args.survey / "outputs" / "orthomosaic_quick.tif"
        # terrain is meshed from the bare-earth DTM: no tree curtains/spikes
        if build_mesh(dtm_path, ortho, meta, ground_y, mesh_dir, texture_px=args.texture_px) is None:
            mesh_dir = None
    register_assets(args.survey, dsm_path, points_dir, mesh_dir, epsg, dtm_path)
    log("done")


if __name__ == "__main__":
    main()
