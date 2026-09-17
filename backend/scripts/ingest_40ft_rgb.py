"""One-off ingestion of the 40 ft RGB-only survey supplied by the user.

Source: E:\\40 ft\\RGB Only\\Part 1, Part 2, Part 3 (1,378 DJI `_D.JPG` frames,
no multispectral bands, no GNSS/PPK sidecars). All three parts share one GPS
location and one afternoon (2026-06-03, 15:03-15:43) - one flight session
split by battery swaps, so it is registered as a single survey, matching the
"one flight is one survey" convention already used by scripts/seed_from_real_data.py.

Files are referenced in place (absolute paths), never copied.

Run: backend/.venv/Scripts/python.exe -m scripts.ingest_40ft_rgb
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

FIELD_NAME = "40 ft RGB Site"
SURVEY_NAME = "Survey — June 3, 2026 (40 ft, RGB only)"
DRONE = "DJI Mavic 3 Multispectral (M3M)"
SOURCE_DIRS = [
    Path(r"E:\40 ft\RGB Only\Part 1"),
    Path(r"E:\40 ft\RGB Only\Part 2"),
    Path(r"E:\40 ft\RGB Only\Part 3"),
]


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        farm = db.query(models.Farm).first()
        if not farm:
            farm = models.Farm(name="My Farm")
            db.add(farm)
            db.flush()

        field = db.query(models.Field).filter_by(name=FIELD_NAME).first()
        if not field:
            field = models.Field(farm_id=farm.id, name=FIELD_NAME, crop_type="soybean")
            db.add(field)
            db.flush()
            print(f"created field {field.id} ({FIELD_NAME})")
        else:
            print(f"reusing existing field {field.id} ({FIELD_NAME})")

        existing = db.query(models.Survey).filter_by(field_id=field.id, name=SURVEY_NAME).first()
        if existing:
            print(f"survey already exists: {existing.id} - nothing to do")
            return

        survey = models.Survey(field_id=field.id, name=SURVEY_NAME, drone_model=DRONE, status="PROCESSING")
        db.add(survey)
        db.flush()
        job = create_job(db, survey)
        mark_step_complete(db, job, "images_uploaded")

        images: list[models.SurveyImage] = []
        for d in SOURCE_DIRS:
            if not d.exists():
                print(f"  WARNING: missing, skipping: {d}")
                continue
            imgs = survey_service.ingest_images_from_directory(db, survey, d)
            images.extend(imgs)
            bands = sorted({i.band for i in imgs})
            print(f"  {d}: {len(imgs)} files, bands {bands}")

        captured = [i.captured_at for i in images if i.captured_at]
        if captured:
            survey.survey_date = min(captured)
        mark_step_complete(db, job, "metadata_extracted")

        survey_service.update_field_boundary_from_images(db, field, survey.images)
        mark_step_complete(db, job, "processing_field")

        print("  building quick mosaic (RGB only, direct georeferencing) ...")
        mosaics = build_quick_mosaics(db, survey)
        print(f"  -> {len(mosaics)} georeferenced raster(s)")
        mark_step_complete(db, job, "generating_orthomosaic")

        print(f"  analysing {survey.name} ...")
        result = analyze_survey(db, survey, field)
        mark_step_complete(db, job, "ai_analysis")
        mark_step_complete(db, job, "digital_twin_ready")
        survey.status = "COMPLETED"
        db.commit()

        if result:
            print(
                f"  -> method={result.method}: {result.healthy_area_percent}% healthy / "
                f"{result.attention_area_percent}% attention / {result.problem_area_percent}% problem, "
                f"{len(result.detections)} zone(s)"
            )
        else:
            print("  -> analysis could not be computed (no usable geotagged frames)")

        print(f"\nfield_id={field.id} survey_id={survey.id}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
