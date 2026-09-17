"""Tiles the OpenDroneMap dense point cloud (LAZ, tens of millions of RGB
points) into a small coloured 3D Tileset for the viewer's Point Cloud layer
(frontend/public/models/<survey_id>/odm-points/). The tiling itself is
app.services.pointcloud_service, shared with manual LAS/LAZ imports.

Run (agrotwin venv, from backend/):
    python -m scripts.tile_points --survey <id> [--max-points 5000000]
"""

import argparse
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="  %(message)s")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import AGROTWIN_ROOT, settings  # noqa: E402
from app.services.pointcloud_service import load_las, tile_points  # noqa: E402
from scripts.tile_mesh import read_utm_offset  # noqa: E402

PUBLIC_MODELS = AGROTWIN_ROOT / "frontend" / "public" / "models"


def build(survey_id: str, max_points: int, ground_h: float | None):
    odm = settings.surveys_dir / survey_id / "odm"
    laz = odm / "odm_georeferencing" / "odm_georeferenced_model.laz"
    epsg, _, _ = read_utm_offset(odm / "odm_georeferencing" / "odm_georeferencing_model_geo.txt")
    xyz, rgb, n = load_las(laz, max_points)
    logging.info("points: kept %d of %d", len(xyz), n)
    tileset, _ = tile_points(xyz, rgb, f"EPSG:{epsg}", PUBLIC_MODELS / survey_id / "odm-points", ground_h)
    return tileset


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
