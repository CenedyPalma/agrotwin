#!/usr/bin/env python3
"""Photorealistic pipeline: survey RGB frames -> COLMAP SfM -> 3DGS -> 3D Tiles.

Runs with the GPU splat venv (NOT the agrotwin venv):
    ~/venvs/splat/bin/python -m scripts.build_splats --survey <id> [--steps 15000]

Stages (each resumable — existing outputs are reused):
  1. project dir  data/splats/<survey_id>/{images,colmap-workspace,exports}
                  images/ are symlinks to the survey's RGB JPGs (no copies)
  2. SfM          pycolmap: GPU SIFT (max 2000 px), *spatial* pair selection
                  from the frames' EXIF/RTK GPS (a drone grid has ~50 real
                  neighbours per frame; exhaustive matching of 230 frames
                  is 26k pairs for nothing), incremental mapping
  3. geo-align    Sim3 alignment of the reconstruction to the RTK camera
                  positions (ENU metres about the field centre) so the model
                  has true scale and orientation, then a fixed rotation so
                  that Cesium's glTF y-up->z-up conversion lands it back in
                  ENU (see _ENU_TO_GLTF below)
  4. train        CesiumSplatData/train.py (gsplat, RTX 3050 defaults)
  5. tile         CesiumSplatData/tile_splat.py -> frontend/public/splats/<survey_id>/

Everything here is derived from the real frames; nothing is synthesised.
"""

import argparse
import json
import math
import sqlite3
import subprocess
import sys
from pathlib import Path

import numpy as np

AGROTWIN = Path(__file__).resolve().parents[2]
DB_PATH = AGROTWIN / "data" / "agrotwin.db"
SPLATS_DIR = AGROTWIN / "data" / "splats"
PUBLIC_SPLATS = AGROTWIN / "frontend" / "public" / "splats"
SPLAT_TOOLS = next((d for d in (Path(__file__).resolve().parents[2].parent / "CesiumSplatData",
                                Path("/media/cdev/Personal1/Development/Agro/CesiumSplatData")) if d.exists()),
                   Path("/media/cdev/Personal1/Development/Agro/CesiumSplatData"))
SPLAT_ENV = SPLAT_TOOLS / "splat-env.sh"

# After geo-alignment the model is ENU (x=E, y=N, z=U). glTF is y-up and
# Cesium rotates glTF content +90° about X, (x, y, z) -> (x, -z, y). Storing
# (E, U, -N) therefore renders as (E, N, U).
_ENU_TO_GLTF = np.array([[1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, -1.0, 0.0]])

EARTH_A = 6378137.0
EARTH_E2 = 6.69437999014e-3


def geodetic_to_ecef(lat, lon, h):
    lat, lon = math.radians(lat), math.radians(lon)
    n = EARTH_A / math.sqrt(1 - EARTH_E2 * math.sin(lat) ** 2)
    return np.array(
        [
            (n + h) * math.cos(lat) * math.cos(lon),
            (n + h) * math.cos(lat) * math.sin(lon),
            (n * (1 - EARTH_E2) + h) * math.sin(lat),
        ]
    )


def enu_matrix(lat, lon):
    lat, lon = math.radians(lat), math.radians(lon)
    return np.array(
        [
            [-math.sin(lon), math.cos(lon), 0],
            [-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat)],
            [math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)],
        ]
    )


def enu_to_geodetic(e, n, u, lat0, lon0, h0):
    ecef = geodetic_to_ecef(lat0, lon0, h0) + enu_matrix(lat0, lon0).T @ np.array([e, n, u])
    x, y, z = ecef
    lon = math.atan2(y, x)
    p = math.hypot(x, y)
    lat = math.atan2(z, p * (1 - EARTH_E2))
    for _ in range(5):
        nn = EARTH_A / math.sqrt(1 - EARTH_E2 * math.sin(lat) ** 2)
        h = p / math.cos(lat) - nn
        lat = math.atan2(z, p * (1 - EARTH_E2 * nn / (nn + h)))
    return math.degrees(lat), math.degrees(lon), h


def load_frames(survey_id: str):
    con = sqlite3.connect(DB_PATH)
    rows = con.execute(
        "SELECT filename, file_path, lat, lon, altitude_m FROM survey_images "
        "WHERE survey_id=? AND band='RGB' AND lat IS NOT NULL ORDER BY filename",
        (survey_id,),
    ).fetchall()
    con.close()
    if not rows:
        sys.exit(f"no geotagged RGB frames for survey {survey_id}")
    return rows


def stage_project(survey_id: str, rows):
    proj = SPLATS_DIR / survey_id
    img_dir = proj / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    (proj / "colmap-workspace").mkdir(exist_ok=True)
    (proj / "exports").mkdir(exist_ok=True)
    for name, path, *_ in rows:
        link = img_dir / name
        if not link.exists():
            link.symlink_to(path)
    return proj


def run_sfm(proj: Path, rows, max_image_size: int):
    import pycolmap

    work = proj / "colmap-workspace"
    db = work / "database.db"
    sparse = work / "sparse"
    if (sparse / "0" / "cameras.bin").exists():
        print("SfM: existing sparse model found, skipping")
        return sparse / "0"

    device = pycolmap.Device.auto
    if not db.exists():
        print(f"SfM 1/3: SIFT features (max {max_image_size}px, GPU) for {len(rows)} frames")
        opts = pycolmap.FeatureExtractionOptions()
        opts.max_image_size = max_image_size
        pycolmap.extract_features(
            str(db), str(proj / "images"), camera_mode=pycolmap.CameraMode.SINGLE,
            extraction_options=opts, device=device,
        )
        print("SfM 2/3: spatial matching (GPS neighbours)")
        pairing = pycolmap.SpatialPairingOptions()
        pairing.max_num_neighbors = 40
        pairing.max_distance = 80  # metres; ~2 frame footprints at 30 m AGL
        pairing.ignore_z = True
        pycolmap.match_spatial(str(db), pairing_options=pairing, device=device)

    print("SfM 3/3: incremental mapping")
    sparse.mkdir(exist_ok=True)
    maps = pycolmap.incremental_mapping(str(db), str(proj / "images"), str(sparse))
    if not maps:
        sys.exit("SfM failed: no model")
    best_id = max(maps, key=lambda k: maps[k].num_reg_images())
    best = maps[best_id]
    print(f"SfM: {best.num_reg_images()}/{len(rows)} frames registered, {best.num_points3D()} points")
    model_dir = sparse / str(best_id)
    if best_id != 0:
        # train.py picks the biggest model itself, but keep the canonical path simple
        (sparse / "0").mkdir(exist_ok=True)
        best.write(str(sparse / "0"))
        model_dir = sparse / "0"
    return model_dir


def geo_align(model_dir: Path, rows):
    import pycolmap

    rec = pycolmap.Reconstruction(str(model_dir))
    lat0 = float(np.mean([r[2] for r in rows]))
    lon0 = float(np.mean([r[3] for r in rows]))
    h0 = float(np.mean([r[4] or 0.0 for r in rows]))
    R = enu_matrix(lat0, lon0)
    origin = geodetic_to_ecef(lat0, lon0, h0)

    names, locs = [], []
    for name, _, lat, lon, alt in rows:
        names.append(name)
        locs.append(R @ (geodetic_to_ecef(lat, lon, alt or h0) - origin))
    locs = np.array(locs)

    print("Geo-align: Sim3 to RTK camera positions (ENU metres)")
    sim3 = pycolmap.align_reconstruction_to_locations(rec, names, locs, 3, pycolmap.RANSACOptions())
    if sim3 is None:
        sys.exit("geo-alignment failed")
    rec.transform(sim3)

    # residual check — how far are the reconstructed cameras from the RTK positions?
    res = []
    for img in rec.images.values():
        if img.name in names and img.has_pose:
            i = names.index(img.name)
            res.append(np.linalg.norm(img.projection_center() - locs[i]))
    print(f"Geo-align: median camera residual {np.median(res):.2f} m over {len(res)} frames (scale {sim3.scale:.4f})")

    rec.transform(pycolmap.Sim3d(1.0, pycolmap.Rotation3d(_ENU_TO_GLTF), np.zeros(3)))
    rec.write(str(model_dir))
    meta = {"lat0": lat0, "lon0": lon0, "h0": h0, "median_residual_m": float(np.median(res)), "registered": len(res)}
    (model_dir.parent.parent / "geo.json").write_text(json.dumps(meta, indent=2))
    return meta


def run_train(proj: Path, steps: int, downscale: int):
    ply = proj / "exports" / "splat.ply"
    if ply.exists():
        print("Train: splat.ply exists, skipping")
        return ply
    # Regularised recipe (see train.py): SSIM, scale/opacity/anisotropy penalties,
    # MCMC densification with a hard cap, anti-aliased rasterisation. This is
    # what keeps a nadir-only capture from turning into needles and streaks.
    cmd = (
        f"source {SPLAT_ENV} && {sys.executable} {SPLAT_TOOLS / 'train.py'} "
        f"--root {SPLATS_DIR} --project {proj.name} --steps {steps} --downscale {downscale} "
        f"--strategy mcmc --cap-max 1000000 --ssim-weight 0.2 --scale-reg 0.01 --opacity-reg 0.01 "
        f"--aniso-max 5 --aniso-weight 0.02 --antialiased --scene-scale-lr --save-every 4000"
    )
    print("Train:", cmd)
    subprocess.run(["bash", "-c", cmd], check=True)
    return ply


def run_tile(proj: Path, ply: Path, meta: dict):
    out = PUBLIC_SPLATS / proj.name
    cmd = (
        f"{sys.executable} {Path(__file__).parent / 'tile_splats_spz.py'} --ply {ply} --out-dir {out} "
        f"--lon0 {meta['lon0']:.8f} --lat0 {meta['lat0']:.8f} --h0 {meta['h0']:.2f} --yaw-deg 0 "
        f"--min-opacity 0.12 --max-scale 1.5 --max-radius 100"
    )
    print("Tile:", cmd)
    subprocess.run(["bash", "-c", cmd], check=True)
    print(f"Tileset ready: {out / 'tileset.json'}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--survey", required=True)
    ap.add_argument("--steps", type=int, default=24000)
    ap.add_argument("--downscale", type=int, default=2, help="2 = 2.6k px images, ~2.2 GB VRAM, ~2.2 h on an RTX 3050")
    ap.add_argument("--max-image-size", type=int, default=2000)
    ap.add_argument("--stop-after", choices=["sfm", "align", "train"], default=None)
    args = ap.parse_args()

    rows = load_frames(args.survey)
    proj = stage_project(args.survey, rows)
    model_dir = run_sfm(proj, rows, args.max_image_size)
    if args.stop_after == "sfm":
        return
    geo_path = proj / "geo.json"
    meta = json.loads(geo_path.read_text()) if geo_path.exists() else geo_align(model_dir, rows)
    if args.stop_after == "align":
        return
    ply = run_train(proj, args.steps, args.downscale)
    if args.stop_after == "train":
        return
    run_tile(proj, ply, meta)


if __name__ == "__main__":
    main()
