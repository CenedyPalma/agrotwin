"""Tiles the OpenDroneMap dense point cloud (LAZ, tens of millions of RGB
points) into a small coloured 3D Tileset for the viewer's Point Cloud layer.

Quadtree with two levels: a root subsample the whole field can show at
once, then leaves holding the rest split by quadrant, so a laptop streams
a few million points rather than all sixty. Same local frame and
placement.json convention as tile_mesh.py (absolute ODM heights, viewer
lifts onto its terrain).

Run (agrotwin venv, from backend/):
    python -m scripts.tile_points --survey <id> [--max-points 5000000]
"""

import argparse
import json
import logging
import struct
import sys
from pathlib import Path

import numpy as np

logging.basicConfig(level=logging.INFO, format="  %(message)s")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import AGROTWIN_ROOT, settings  # noqa: E402
from scripts.tile_mesh import box_volume, enu_matrix, geodetic_to_ecef, local_crs, read_utm_offset  # noqa: E402

PUBLIC_MODELS = AGROTWIN_ROOT / "frontend" / "public" / "models"


def write_points_glb(path: Path, pos: np.ndarray, rgb: np.ndarray) -> None:
    pos = pos.astype(np.float32)
    rgba = np.concatenate([rgb.astype(np.uint8), np.full((len(rgb), 1), 255, np.uint8)], 1)
    pb, cb = pos.tobytes(), rgba.tobytes()
    cb += b"\x00" * ((-len(cb)) % 4)
    gltf = {
        "asset": {"version": "2.0", "generator": "agrotwin tile_points"},
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


def build(survey_id: str, max_points: int, ground_h: float | None):
    import laspy
    from rasterio.warp import transform

    odm = settings.surveys_dir / survey_id / "odm"
    laz = odm / "odm_georeferencing" / "odm_georeferenced_model.laz"
    out_dir = PUBLIC_MODELS / survey_id / "odm-points"
    epsg, _, _ = read_utm_offset(odm / "odm_georeferencing" / "odm_georeferencing_model_geo.txt")

    with laspy.open(laz) as f:
        n = f.header.point_count
        step = max(1, n // max_points)
        keep_xyz, keep_rgb = [], []
        for chunk in f.chunk_iterator(4_000_000):
            sel = np.arange(0, len(chunk), step)
            keep_xyz.append(np.column_stack([chunk.x[sel], chunk.y[sel], chunk.z[sel]]))
            if "red" in chunk.point_format.dimension_names:
                r, g, b = chunk.red[sel], chunk.green[sel], chunk.blue[sel]
                scale = 256 if max(int(r.max()), int(g.max()), int(b.max())) > 255 else 1
                keep_rgb.append(np.column_stack([r // scale, g // scale, b // scale]))
            else:
                keep_rgb.append(np.full((len(sel), 3), 160, np.uint8))
    xyz = np.concatenate(keep_xyz)
    rgb = np.concatenate(keep_rgb).astype(np.uint8)
    logging.info("points: kept %d of %d (every %d-th)", len(xyz), n, step)

    lon, lat = transform(f"EPSG:{epsg}", "EPSG:4326", xyz[:, 0].tolist(), xyz[:, 1].tolist())
    lon0, lat0 = float(np.mean(lon)), float(np.mean(lat))
    ex, ny = transform(f"EPSG:{epsg}", local_crs(lon0, lat0), xyz[:, 0].tolist(), xyz[:, 1].tolist())
    enu = np.column_stack([ex, ny, xyz[:, 2]])
    z_ground = float(np.median(enu[:, 2]))
    sane = np.abs(enu[:, 2] - z_ground) < 40  # stray points far above/below
    enu, rgb = enu[sane], rgb[sane]

    if out_dir.exists():
        import shutil
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    def gltf_pos(p):
        return np.column_stack([p[:, 0], p[:, 2], -p[:, 1]])  # (E, U, -N)

    rng = np.random.default_rng(0)
    order = rng.permutation(len(enu))
    root_n = min(len(enu), max(200_000, len(enu) // 4))
    root_idx, rest = order[:root_n], order[root_n:]
    write_points_glb(out_dir / "root.glb", gltf_pos(enu[root_idx]), rgb[root_idx])
    root = {"boundingVolume": box_volume(enu), "geometricError": 3.0, "refine": "ADD",
            "content": {"uri": "root.glb"}, "children": []}
    cx, cy = np.median(enu[:, 0]), np.median(enu[:, 1])
    for name, sel in (("sw", (enu[rest, 0] < cx) & (enu[rest, 1] < cy)), ("se", (enu[rest, 0] >= cx) & (enu[rest, 1] < cy)),
                      ("nw", (enu[rest, 0] < cx) & (enu[rest, 1] >= cy)), ("ne", (enu[rest, 0] >= cx) & (enu[rest, 1] >= cy))):
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
    total = sum(f.stat().st_size for f in out_dir.glob("*.glb")) / 1e6
    logging.info("wrote %s (%d points, %.0f MB)", out_dir / "tileset.json", len(enu), total)
    return out_dir / "tileset.json"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--survey", required=True)
    ap.add_argument("--max-points", type=int, default=5_000_000)
    args = ap.parse_args()
    ground_h = None
    dtm = settings.surveys_dir / args.survey / "outputs" / "dtm_odm.tif"
    if dtm.exists():
        from app import models
        from app.database import SessionLocal
        from scripts.import_odm import _ground_h

        db = SessionLocal()
        try:
            survey = db.get(models.Survey, args.survey)
            ground_h = _ground_h(dtm, survey.field) if survey else None
        finally:
            db.close()
    build(args.survey, args.max_points, ground_h)


if __name__ == "__main__":
    main()
