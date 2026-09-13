"""Builds XYZ tile pyramids for a survey's rasters (orthomosaic, NDVI, NDRE,
GNDVI, DSM) into frontend/public/tiles/<survey_id>/<layer>/ and registers
them as format="xyz" assets. The viewer prefers these over the flat preview
PNG, so zooming in stays sharp down to the raster's native resolution.

Run (agrotwin venv):
    python -m scripts.build_tiles --survey <id> [--layers orthomosaic,ndvi] [--max-zoom 23]
"""

import argparse
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="  %(message)s")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import models  # noqa: E402
from app.database import SessionLocal, init_db  # noqa: E402
from app.services.tile_service import build_survey_tiles  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--survey", required=True)
    ap.add_argument("--layers", default="orthomosaic,ndvi,ndre,gndvi,dsm")
    ap.add_argument("--max-zoom", type=int, default=None, help="override the GSD-derived deepest level")
    args = ap.parse_args()

    init_db()
    db = SessionLocal()
    try:
        survey = db.get(models.Survey, args.survey)
        if survey is None:
            sys.exit(f"no survey {args.survey}")
        created = build_survey_tiles(db, survey, tuple(args.layers.split(",")), max_zoom=args.max_zoom)
        db.commit()
        for a in created:
            print(f"{a.asset_type}: {a.file_path}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
