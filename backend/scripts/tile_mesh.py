"""Tiles the OpenDroneMap textured mesh into a Cesium 3D Tileset that a
laptop can actually stream.

Why not ODM's own --3d-tiles (Obj2Tiles)? It keeps the full-resolution
texture atlases at every level of detail: a coarse tile with 6k triangles
still carries ~70 Mpx of texture, so the coarsest level alone needs ~14 GB
of GPU memory. It also treats UTM as a local ENU frame (0.85° off here).

This tiler:
  - quadtree over the mesh footprint (depth 3 -> 64 leaf tiles), faces
    assigned by centroid; every level carries full geometry (a million
    triangles is cheap; textures are what has to scale)
  - per-tile textures baked from the 1 cm orthophoto by planar projection,
    capped at --tex px per tile, so resolution follows tile size:
    ~10 cm/px at the root, ~1.2 cm/px at the leaves (native)
  - UTM -> lon/lat -> ENU about the field centre; glTF y-up (E, U, -N)
    under an ENU->ECEF root transform, absolute ODM heights kept and
    declared in placement.json so the viewer can lift onto its terrain
  - Draco compression (KHR_draco_mesh_compression) for positions/UVs
  - drops the Poisson floor and faces outside the orthophoto coverage

Run (agrotwin venv, from backend/):
    python -m scripts.tile_mesh --survey <id> [--depth 3] [--tex 2048]
"""

import argparse
import io
import json
import logging
import math
import struct
import sys
from pathlib import Path

import numpy as np

logging.basicConfig(level=logging.INFO, format="  %(message)s")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import AGROTWIN_ROOT, settings  # noqa: E402

PUBLIC_MODELS = AGROTWIN_ROOT / "frontend" / "public" / "models"
A, F = 6378137.0, 1 / 298.257223563
E2 = F * (2 - F)


# ----------------------------------------------------------------- geodesy
def geodetic_to_ecef(lon, lat, h):
    lon, lat = np.radians(lon), np.radians(lat)
    n = A / np.sqrt(1 - E2 * np.sin(lat) ** 2)
    return np.stack([(n + h) * np.cos(lat) * np.cos(lon), (n + h) * np.cos(lat) * np.sin(lon),
                     (n * (1 - E2) + h) * np.sin(lat)], -1)


def enu_matrix(lon0, lat0):
    lo, la = math.radians(lon0), math.radians(lat0)
    e = [-math.sin(lo), math.cos(lo), 0.0]
    n = [-math.sin(la) * math.cos(lo), -math.sin(la) * math.sin(lo), math.cos(la)]
    u = [math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)]
    return np.array([e, n, u]).T  # columns = ENU axes in ECEF


# --------------------------------------------------------------------- obj
def read_obj(path: Path):
    """Vertices and triangle faces (vertex indices only; the ODM atlases are
    replaced by ortho-projected textures, so vt/vn are not needed)."""
    verts, faces = [], []
    with open(path, "r") as f:
        for line in f:
            if line.startswith("v "):
                verts.append(line[2:].split())
            elif line.startswith("f "):
                parts = line[2:].split()
                idx = [int(p.split("/")[0]) - 1 for p in parts]
                for k in range(1, len(idx) - 1):  # fan-triangulate polygons
                    faces.append((idx[0], idx[k], idx[k + 1]))
    return np.array(verts, dtype=np.float64), np.array(faces, dtype=np.int64)


def read_utm_offset(path: Path):
    lines = path.read_text().split("\n")
    zone = lines[0].split()[2]  # e.g. "16N"
    epsg = (32600 if zone.endswith("N") else 32700) + int(zone[:-1])
    ox, oy = (float(v) for v in lines[1].split())
    return epsg, ox, oy


# ------------------------------------------------------------------- glTF
def _pad4(b: bytes, fill=b"\x00") -> bytes:
    return b + fill * ((-len(b)) % 4)


def write_glb(path: Path, pos: np.ndarray, uv: np.ndarray, indices: np.ndarray, tex_jpeg: bytes, draco: bool) -> None:
    pos = pos.astype(np.float32)
    uv = uv.astype(np.float32)
    lo, hi = pos.min(0).tolist(), pos.max(0).tolist()
    buffers_bin = []
    views, accessors = [], []
    ext_used, ext_req = ["KHR_materials_unlit"], []
    prim: dict = {"attributes": {"POSITION": 0, "TEXCOORD_0": 1}, "indices": 2, "material": 0}
    off = 0

    def add_view(data: bytes, target=None):
        nonlocal off
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target:
            v["target"] = target
        views.append(v)
        buffers_bin.append(_pad4(data))
        off += len(buffers_bin[-1])
        return len(views) - 1

    accessors.append({"componentType": 5126, "count": len(pos), "type": "VEC3", "min": lo, "max": hi})
    accessors.append({"componentType": 5126, "count": len(uv), "type": "VEC2"})
    accessors.append({"componentType": 5125, "count": len(indices), "type": "SCALAR"})
    if draco:
        import DracoPy

        enc = DracoPy.encode(pos, faces=indices.reshape(-1, 3).astype(np.uint32), tex_coord=uv.astype(np.float64),
                             quantization_bits=14, compression_level=7)
        bv = add_view(bytes(enc))
        prim["extensions"] = {"KHR_draco_mesh_compression": {"bufferView": bv, "attributes": {"POSITION": 0, "TEXCOORD_0": 1}}}
        ext_used.append("KHR_draco_mesh_compression")
        ext_req.append("KHR_draco_mesh_compression")
    else:
        accessors[0]["bufferView"] = add_view(pos.tobytes(), 34962)
        accessors[1]["bufferView"] = add_view(uv.tobytes(), 34962)
        accessors[2]["bufferView"] = add_view(indices.astype(np.uint32).tobytes(), 34963)
    img_view = add_view(tex_jpeg)

    gltf = {
        "asset": {"version": "2.0", "generator": "agrotwin tile_mesh"},
        "extensionsUsed": ext_used, "extensionsRequired": ext_req,
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [prim]}],
        "materials": [{"pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 1},
                       "extensions": {"KHR_materials_unlit": {}}, "doubleSided": True}],
        "textures": [{"source": 0, "sampler": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": img_view, "mimeType": "image/jpeg"}],
        "bufferViews": views, "accessors": accessors, "buffers": [{"byteLength": off}],
    }
    js = _pad4(json.dumps(gltf, separators=(",", ":")).encode(), b" ")
    bin_chunk = b"".join(buffers_bin)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_chunk)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack("<II", len(bin_chunk), 0x004E4942))
        f.write(bin_chunk)


# ------------------------------------------------------------------ tiling
def local_crs(lon0: float, lat0: float) -> str:
    """Transverse Mercator centred on the field: x/y equal ENU east/north to
    within a millimetre over a few hundred metres, and it is a real CRS, so
    rasterio can warp the orthophoto straight into tile texture space."""
    return f"+proj=tmerc +lat_0={lat0} +lon_0={lon0} +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"


class OrthoBaker:
    """Bakes per-tile textures by warping the orthophoto into the tile's ENU footprint."""

    def __init__(self, ortho_path: Path, lon0: float, lat0: float):
        import rasterio

        self.src = rasterio.open(ortho_path)
        self.crs = local_crs(lon0, lat0)

    def coverage(self, enu_xy: np.ndarray) -> np.ndarray:
        """Alpha > 0 at these ENU points (sampled from a coarse overview)."""
        from rasterio.enums import Resampling
        from rasterio.warp import transform

        scale = 16
        h, w = self.src.height // scale, self.src.width // scale
        alpha = self.src.read(self.src.count, out_shape=(h, w), resampling=Resampling.nearest)
        px, py = transform(self.crs, self.src.crs, enu_xy[:, 0].tolist(), enu_xy[:, 1].tolist())
        inv = ~self.src.transform
        cols, rows = inv * (np.asarray(px), np.asarray(py))
        rows, cols = np.floor(rows).astype(int) // scale, np.floor(cols).astype(int) // scale
        ok = (rows >= 0) & (rows < h) & (cols >= 0) & (cols < w)
        out = np.zeros(len(enu_xy), bool)
        out[ok] = alpha[rows[ok], cols[ok]] > 0
        return out

    def bake(self, x0, y0, x1, y1, size_px: int) -> bytes:
        """JPEG of the orthophoto over the ENU box [x0,x1]x[y0,y1] (north up)."""
        import rasterio
        from PIL import Image
        from rasterio.enums import Resampling
        from rasterio.transform import from_origin
        from rasterio.warp import reproject

        aspect = (y1 - y0) / max(x1 - x0, 1e-6)
        w = size_px if aspect <= 1 else max(16, int(round(size_px / aspect)))
        h = size_px if aspect >= 1 else max(16, int(round(size_px * aspect)))
        dst = np.zeros((self.src.count, h, w), np.uint8)
        reproject(rasterio.band(self.src, list(range(1, self.src.count + 1))), dst,
                  dst_transform=from_origin(x0, y1, (x1 - x0) / w, (y1 - y0) / h), dst_crs=self.crs,
                  resampling=Resampling.bilinear, dst_nodata=0)
        rgb = np.transpose(dst[:3], (1, 2, 0)).astype(np.float32)
        if self.src.count >= 4:  # neutral fill outside coverage, no black fringe
            a = dst[3][..., None] / 255.0
            rgb = rgb * a + np.array([120, 110, 90]) * (1 - a)
        buf = io.BytesIO()
        Image.fromarray(rgb.astype(np.uint8)).save(buf, "JPEG", quality=86, subsampling=0)
        return buf.getvalue()


def box_volume(pos_enu: np.ndarray):
    """3D Tiles oriented box in the tile frame (x=E, y=N, z=U)."""
    lo, hi = pos_enu.min(0), pos_enu.max(0)
    c, half = (lo + hi) / 2, (hi - lo) / 2 + 0.5
    return {"box": [*c.tolist(), half[0], 0, 0, 0, half[1], 0, 0, 0, half[2]]}


def build(survey_id: str, depth: int, tex_px: int, draco: bool, ground_h: float | None = None):
    odm = settings.surveys_dir / survey_id / "odm"
    out_dir = PUBLIC_MODELS / survey_id / "odm-model"
    epsg, ox, oy = read_utm_offset(odm / "odm_georeferencing" / "odm_georeferencing_model_geo.txt")
    verts, faces = read_obj(odm / "odm_texturing" / "odm_textured_model_geo.obj")
    logging.info("mesh: %d vertices, %d faces (UTM %d, offset %.0f %.0f)", len(verts), len(faces), epsg, ox, oy)

    from rasterio.warp import transform

    lon, lat = transform(f"EPSG:{epsg}", "EPSG:4326", (verts[:, 0] + ox).tolist(), (verts[:, 1] + oy).tolist())
    lon0, lat0 = float(np.mean(lon)), float(np.mean(lat))
    ex, ny = transform(f"EPSG:{epsg}", local_crs(lon0, lat0), (verts[:, 0] + ox).tolist(), (verts[:, 1] + oy).tolist())
    enu = np.column_stack([ex, ny, verts[:, 2]])

    # drop the Poisson floor (flat sheet far below ground) and faces off the orthophoto
    z_ground = np.median(enu[:, 2])
    fz = enu[faces, 2]
    keep = fz.max(1) > z_ground - 15
    ortho = OrthoBaker(settings.surveys_dir / survey_id / "outputs" / "orthomosaic_odm.tif", lon0, lat0)
    cen = enu[faces[:, :], :2].mean(1)
    keep &= ortho.coverage(cen)
    faces, cen = faces[keep], cen[keep]
    logging.info("kept %d faces after floor/coverage filter (ground z≈%.1f)", len(faces), z_ground)

    used = np.unique(faces)
    xy_lo, xy_hi = enu[used, :2].min(0), enu[used, :2].max(0)
    if out_dir.exists():
        import shutil
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    def make_tile(level: int, ix: int, iy: int, x0, y0, x1, y1, face_ids: np.ndarray):
        """Writes one tile and returns its tileset node (recursing into children)."""
        if len(face_ids) == 0:
            return None
        tri = faces[face_ids]
        vids, inv = np.unique(tri, return_inverse=True)
        p = enu[vids]
        bx0, by0 = p[:, :2].min(0)
        bx1, by1 = p[:, :2].max(0)
        size = min(tex_px, max(64, int(2 ** math.ceil(math.log2(max(bx1 - bx0, by1 - by0) / 0.01)))))  # ≤ native 1 cm
        jpeg = ortho.bake(bx0, by0, bx1, by1, size)
        uv = np.column_stack([(p[:, 0] - bx0) / max(bx1 - bx0, 1e-6), 1 - (p[:, 1] - by0) / max(by1 - by0, 1e-6)])
        gltf_pos = np.column_stack([p[:, 0], p[:, 2], -p[:, 1]])  # (E, U, -N): glTF y-up
        name = f"L{level}_{ix}_{iy}.glb"
        write_glb(out_dir / name, gltf_pos, uv, inv.reshape(-1).astype(np.uint32), jpeg, draco)
        node = {
            "boundingVolume": box_volume(p),
            "geometricError": 0.0 if level == depth else 12.0 / (2 ** level),
            "refine": "REPLACE",
            "content": {"uri": name},
        }
        if level < depth:
            xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
            c = cen[face_ids]
            children = []
            for jx, (cx0, cx1) in enumerate(((x0, xm), (xm, x1))):
                for jy, (cy0, cy1) in enumerate(((y0, ym), (ym, y1))):
                    sel = (c[:, 0] >= cx0) & (c[:, 0] < cx1) & (c[:, 1] >= cy0) & (c[:, 1] < cy1)
                    child = make_tile(level + 1, ix * 2 + jx, iy * 2 + jy, cx0, cy0, cx1, cy1, face_ids[sel])
                    if child:
                        children.append(child)
            if children:
                node["children"] = children
        logging.info("tile L%d (%d,%d): %d tris, %d px texture", level, ix, iy, len(face_ids), size)
        return node

    # square root cell so children stay square
    span = float(max(xy_hi - xy_lo)) + 1.0
    cx, cy = (xy_lo + xy_hi) / 2
    root = make_tile(0, 0, 0, cx - span / 2, cy - span / 2, cx + span / 2, cy + span / 2, np.arange(len(faces)))

    origin = geodetic_to_ecef(np.array([lon0]), np.array([lat0]), np.array([0.0]))[0]
    R = enu_matrix(lon0, lat0)
    T = np.eye(4)
    T[:3, :3], T[:3, 3] = R, origin
    root["transform"] = T.T.flatten().tolist()  # column-major
    tileset = {"asset": {"version": "1.1", "generator": "agrotwin tile_mesh"}, "geometricError": 200.0, "root": root}
    (out_dir / "tileset.json").write_text(json.dumps(tileset))

    # ground height in the mesh's own datum (viewer lifts the tileset onto its terrain by the difference)
    (out_dir / "placement.json").write_text(json.dumps({"ground_h": float(ground_h if ground_h is not None else z_ground),
                                                       "lon0": lon0, "lat0": lat0}))
    total = sum(f.stat().st_size for f in out_dir.glob("*.glb")) / 1e6
    logging.info("wrote %s (%d tiles, %.0f MB)", out_dir / "tileset.json", len(list(out_dir.glob("*.glb"))), total)
    return out_dir / "tileset.json"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--survey", required=True)
    ap.add_argument("--depth", type=int, default=3)
    ap.add_argument("--tex", type=int, default=2048, help="max texture size per tile (px)")
    ap.add_argument("--draco", action="store_true", help="KHR_draco_mesh_compression (Cesium 1.145 failed to render these tiles; off by default)")
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
    build(args.survey, args.depth, args.tex, args.draco, ground_h)


if __name__ == "__main__":
    main()
