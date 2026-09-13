"""Seeds the local DB from the real DJI Mavic 3M surveys on disk.

Field: "Ditty Road Soybean Field" (name taken from the DJI mission folders).
One survey flown 2026-06-03 across two DJI mission folders (012: 38 frames,
013: 192 frames — a battery swap splits a DJI mission). Every frame has the
RGB JPG plus Green/Red/RedEdge/NIR 16-bit TIFs; the folders' PPK/RTK sidecar
files (.MRK/.nav/.obs/.bin) are registered as assets. Analysis uses real NDVI.

"100 ft only RGB" (parts 1+2) is the RGB subset of this same flight — the
identical 230 `_D.JPG` files — so it is deliberately NOT registered as a
second survey; one flight is one survey.

All files are referenced in place (absolute paths), never copied.

Run: python -m scripts.seed_from_real_data
"""

import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="  %(message)s")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal, init_db  # noqa: E402
from app import models  # noqa: E402
from app.services import survey_service  # noqa: E402
from app.services.analysis_service import analyze_survey  # noqa: E402
from app.services.mosaic_service import build_quick_mosaics  # noqa: E402
from app.services.processing_service import create_job, mark_step_complete  # noqa: E402

from app.config import settings  # noqa: E402

AGRO_ROOT = settings.raw_data_root
FIELD_NAME = "Ditty Road Soybean Field"
DRONE = "DJI Mavic 3 Multispectral (M3M)"

SURVEYS = [
    {
        "name": "Survey — June 3, 2026 (100 ft, multispectral)",
        "dirs": [
            AGRO_ROOT / "DJI_202606031411_012_DittyRoadSoybeanfield",
            AGRO_ROOT / "DJI_202606031442_013_DittyRoadSoybeanfield",
        ],
    },
]


def seed_survey(db, field: models.Field, spec: dict) -> models.Survey:
    survey = models.Survey(field_id=field.id, name=spec["name"], drone_model=DRONE, status="PROCESSING")
    db.add(survey)
    db.flush()
    job = create_job(db, survey)
    mark_step_complete(db, job, "images_uploaded")

    images: list[models.SurveyImage] = []
    for d in spec["dirs"]:
        if not d.exists():
            print(f"  WARNING: missing, skipping: {d}")
            continue
        imgs = survey_service.ingest_images_from_directory(db, survey, d)
        gnss = survey_service.ingest_gnss_files_from_directory(db, survey, d)
        images.extend(imgs)
        bands = sorted({i.band for i in imgs})
        print(f"  {d.name}: {len(imgs)} files, bands {bands}, {len(gnss)} GNSS/PPK file(s)")

    captured = [i.captured_at for i in images if i.captured_at]
    if captured:
        survey.survey_date = min(captured)
    mark_step_complete(db, job, "metadata_extracted")

    survey_service.update_field_boundary_from_images(db, field, [i for i in field_images(db, field)])
    mark_step_complete(db, job, "processing_field")

    print("  building quick mosaics (RGB + NDVI/NDRE/GNDVI, direct georeferencing) …")
    mosaics = build_quick_mosaics(db, survey)
    print(f"  -> {len(mosaics)} georeferenced raster(s)")
    mark_step_complete(db, job, "generating_orthomosaic")

    print(f"  analysing {survey.name} …")
    result = analyze_survey(db, survey, field)
    mark_step_complete(db, job, "ai_analysis")
    mark_step_complete(db, job, "digital_twin_ready")
    survey.status = "COMPLETED"
    db.flush()

    if result:
        print(
            f"  -> method={result.method}: {result.healthy_area_percent}% healthy / "
            f"{result.attention_area_percent}% attention / {result.problem_area_percent}% problem, "
            f"{len(result.detections)} zone(s)"
        )
    else:
        print("  -> analysis could not be computed (no usable geotagged frames)")
    return survey


def field_images(db, field: models.Field):
    return (
        db.query(models.SurveyImage)
        .join(models.Survey)
        .filter(models.Survey.field_id == field.id, models.SurveyImage.band == "RGB")
        .all()
    )


def main():
    init_db()
    db = SessionLocal()
    try:
        if db.query(models.Field).filter(models.Field.name == FIELD_NAME).first():
            print(f'Already seeded: field "{FIELD_NAME}". Delete data/agrotwin.db to reseed.')
            return

        farm = db.query(models.Farm).filter(models.Farm.name == "My Farm").first()
        if not farm:
            farm = models.Farm(name="My Farm", location_name="Tennessee, USA")
            db.add(farm)
            db.flush()

        field = models.Field(farm_id=farm.id, name=FIELD_NAME, crop_type="soybean")
        db.add(field)
        db.flush()

        for spec in SURVEYS:
            print(f"\nSurvey: {spec['name']}")
            seed_survey(db, field, spec)

        db.commit()
        print(f"\nSeeded field={field.id} ({field.area_hectares} ha, center {field.center_lat:.6f}, {field.center_lon:.6f})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
