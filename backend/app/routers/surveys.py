import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services import multispectral_service, processing_service, storage_service
from app.services.metadata_service import extract_image_metadata
from app.services.survey_service import camera_fields, classify_dji_file

router = APIRouter(prefix="/api/surveys", tags=["surveys"])


@router.get("", response_model=list[schemas.SurveyOut])
def list_surveys(db: Session = Depends(get_db)):
    return db.query(models.Survey).all()


@router.post("", response_model=schemas.SurveyOut)
def create_survey(payload: schemas.SurveyCreate, db: Session = Depends(get_db)):
    field = db.get(models.Field, payload.field_id)
    if not field:
        raise HTTPException(404, "Field not found")

    survey = models.Survey(
        field_id=field.id,
        name=payload.name,
        drone_model=payload.drone_model,
        status="PENDING",
    )
    db.add(survey)
    db.flush()
    processing_service.create_job(db, survey)
    db.commit()
    db.refresh(survey)
    return survey


@router.post("/{survey_id}/images", response_model=list[schemas.SurveyImageOut])
async def upload_survey_images(survey_id: str, files: list[UploadFile], db: Session = Depends(get_db)):
    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")

    dest_dir = storage_service.survey_dir(survey.id) / "rgb"
    dest_dir.mkdir(parents=True, exist_ok=True)

    created: list[models.SurveyImage] = []
    for upload in files:
        dest_path = dest_dir / upload.filename
        with dest_path.open("wb") as f:
            shutil.copyfileobj(upload.file, f)

        meta = extract_image_metadata(dest_path)
        frame_key, band = classify_dji_file(dest_path)
        img = models.SurveyImage(
            survey_id=survey.id,
            filename=upload.filename,
            file_path=str(dest_path),
            band=band,
            frame_key=frame_key,
            lat=meta.lat,
            lon=meta.lon,
            altitude_m=meta.altitude_m,
            captured_at=meta.captured_at,
            width=meta.width,
            height=meta.height,
            **camera_fields(meta),
        )
        db.add(img)
        created.append(img)

    survey.image_count = len(survey.images) + len(created)
    if survey.survey_date is None and created and created[0].captured_at:
        survey.survey_date = created[0].captured_at
    survey.status = "PROCESSING"
    db.commit()
    for img in created:
        db.refresh(img)
    return created


@router.post("/{survey_id}/assets", response_model=schemas.SurveyAssetOut)
async def upload_survey_asset(
    survey_id: str, asset_type: str, file: UploadFile, db: Session = Depends(get_db)
):
    """Manual import of a processed dataset (orthomosaic/NDVI/NDRE GeoTIFF, GeoJSON, 3D model, etc.)."""
    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")

    dest_dir = storage_service.survey_dir(survey.id) / "assets"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / file.filename
    with dest_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    bounds_geojson = None
    fmt = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "").lower()
    if fmt in ("tif", "tiff"):
        try:
            from app.services.orthomosaic_service import extract_bounds_geojson

            bounds_geojson = json.dumps(extract_bounds_geojson(dest_path))
        except Exception:
            bounds_geojson = None

    asset = models.SurveyAsset(
        survey_id=survey.id,
        asset_type=asset_type,
        file_path=str(dest_path),
        format=fmt,
        bounds_geojson=bounds_geojson,
        source="manual_import",
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.post("/{survey_id}/process", response_model=schemas.ProcessingJobOut)
def trigger_processing(survey_id: str, db: Session = Depends(get_db)):
    """Advances the survey's processing job. Steps run synchronously for the
    local MVP; the same state machine maps onto a background task queue later."""
    from app.services.survey_service import update_field_boundary_from_images

    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")

    job = max(survey.jobs, key=lambda j: j.created_at, default=None)
    if not job:
        job = processing_service.create_job(db, survey)

    try:
        processing_service.mark_step_complete(db, job, "images_uploaded")
        processing_service.mark_step_complete(db, job, "metadata_extracted")

        update_field_boundary_from_images(db, survey.field, survey.images)
        processing_service.mark_step_complete(db, job, "processing_field")

        from app.services.analysis_service import analyze_survey
        from app.services.mosaic_service import build_quick_mosaics

        if not any(a.source == "direct_georeferencing" for a in survey.assets):
            build_quick_mosaics(db, survey)
        processing_service.mark_step_complete(db, job, "generating_orthomosaic")

        if not survey.analysis_results:
            analyze_survey(db, survey, survey.field)
        processing_service.mark_step_complete(db, job, "ai_analysis")
        processing_service.mark_step_complete(db, job, "digital_twin_ready")

        survey.status = "COMPLETED"
        survey.survey_date = survey.survey_date or datetime.now(timezone.utc)
        db.commit()
    except Exception as exc:
        db.rollback()
        processing_service.mark_failed(db, job, str(exc))
        survey.status = "FAILED"
        db.commit()
        raise HTTPException(500, f"Processing failed: {exc}") from exc

    db.refresh(job)
    return processing_service.job_to_dict(job)


@router.post("/{survey_id}/mosaic", response_model=list[schemas.SurveyAssetOut])
def rebuild_mosaic(survey_id: str, db: Session = Depends(get_db)):
    """(Re)builds the direct-georeferencing quick mosaics (RGB + NDVI/NDRE/GNDVI)
    from the survey's frames and re-runs the analysis on the NDVI map."""
    from app.services.analysis_service import analyze_survey
    from app.services.mosaic_service import build_quick_mosaics

    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")
    assets = build_quick_mosaics(db, survey)
    if not assets:
        raise HTTPException(422, "Not enough nadir RTK-tagged frames to build a mosaic")
    analyze_survey(db, survey, survey.field)
    db.commit()
    for a in assets:
        db.refresh(a)
    return assets


@router.get("/{survey_id}", response_model=schemas.SurveyOut)
def get_survey(survey_id: str, db: Session = Depends(get_db)):
    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")
    return survey


@router.get("/{survey_id}/images", response_model=list[schemas.SurveyImageOut])
def list_survey_images(survey_id: str, db: Session = Depends(get_db)):
    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")
    return survey.images


@router.get("/{survey_id}/images/{image_id}/thumbnail")
def get_image_thumbnail(survey_id: str, image_id: str, db: Session = Depends(get_db)):
    image = db.get(models.SurveyImage, image_id)
    if not image or image.survey_id != survey_id:
        raise HTTPException(404, "Image not found")
    if not storage_service.file_exists(image.file_path):
        raise HTTPException(404, "Source file missing on disk")
    try:
        thumb_path = storage_service.get_or_create_thumbnail(image.id, image.file_path)
    except OSError as exc:
        raise HTTPException(503, f"Source file unreadable (disk error?): {exc}") from exc
    return FileResponse(thumb_path, media_type="image/jpeg")


def _get_image(db: Session, survey_id: str, image_id: str) -> models.SurveyImage:
    image = db.get(models.SurveyImage, image_id)
    if not image or image.survey_id != survey_id:
        raise HTTPException(404, "Image not found")
    if not storage_service.file_exists(image.file_path):
        raise HTTPException(404, "Source file missing on disk")
    return image


@router.get("/{survey_id}/images/{image_id}/file")
def get_image_file(survey_id: str, image_id: str, db: Session = Depends(get_db)):
    """Original bytes (download). 16-bit band TIFs aren't browser-viewable — use /display."""
    image = _get_image(db, survey_id, image_id)
    is_tif = image.file_path.lower().endswith((".tif", ".tiff"))
    return FileResponse(str(image.path), media_type="image/tiff" if is_tif else "image/jpeg", filename=image.filename)


@router.get("/{survey_id}/images/{image_id}/display")
def get_image_display(survey_id: str, image_id: str, db: Session = Depends(get_db)):
    """Browser-viewable rendition: JPGs pass through; 16-bit band TIFs are
    percentile-stretched to 8-bit grayscale PNG (cached)."""
    image = _get_image(db, survey_id, image_id)
    if not image.file_path.lower().endswith((".tif", ".tiff")):
        return FileResponse(str(image.path), media_type="image/jpeg")

    from app.config import settings

    cache_path = settings.band_display_cache_dir / f"{image.id}.png"
    if not cache_path.exists():
        try:
            storage_service.write_atomic(cache_path, multispectral_service.render_band_display_png(image.path))
        except OSError as exc:
            raise HTTPException(503, f"Source file unreadable (disk error?): {exc}") from exc
    return FileResponse(cache_path, media_type="image/png")


@router.get("/{survey_id}/frames/{frame_key}/index/{index}")
def get_frame_index_preview(survey_id: str, frame_key: str, index: str, db: Session = Depends(get_db)):
    """Colorized NDVI/NDRE/GNDVI computed from the frame's real multispectral
    bands (see multispectral_service). 404 if the frame lacks the bands."""
    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")
    if index not in multispectral_service.INDEX_BANDS:
        raise HTTPException(400, f"Unknown index '{index}'")

    from app.config import settings

    # frame keys contain ':' (folder:sequence), which exFAT/NTFS drives reject in filenames
    cache_path = settings.index_preview_cache_dir / f"{survey_id}_{frame_key.replace(':', '_')}_{index}.png"
    if not cache_path.exists():
        bands = multispectral_service.frame_band_paths(survey.images, frame_key)
        try:
            storage_service.write_atomic(cache_path, multispectral_service.render_index_preview_png(bands, index))
        except multispectral_service.BandsUnavailableError as exc:
            raise HTTPException(404, str(exc)) from exc
        except OSError as exc:
            raise HTTPException(503, f"Band file unreadable (disk error?): {exc}") from exc
    return FileResponse(cache_path, media_type="image/png")


@router.get("/{survey_id}/assets", response_model=list[schemas.SurveyAssetOut])
def list_survey_assets(survey_id: str, db: Session = Depends(get_db)):
    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")
    return survey.assets


@router.get("/{survey_id}/assets/{asset_id}/preview")
def get_asset_preview(survey_id: str, asset_id: str, db: Session = Depends(get_db)):
    """Renders a GeoTIFF asset (orthomosaic/NDVI/NDRE/etc.) to a browser-friendly
    PNG covering the exact same bounds as the asset's bounds_geojson, cached on
    first request. Cesium places it with SingleTileImageryProvider + Rectangle."""
    asset = db.get(models.SurveyAsset, asset_id)
    if not asset or asset.survey_id != survey_id:
        raise HTTPException(404, "Asset not found")
    if asset.format not in ("tif", "tiff"):
        raise HTTPException(400, "Preview is only available for GeoTIFF assets")
    if not storage_service.file_exists(asset.file_path):
        raise HTTPException(404, "Source file missing on disk")

    from app.config import settings
    from app.services.orthomosaic_service import RasterioUnavailableError, generate_preview_png

    cache_path = settings.asset_previews_cache_dir / f"{asset.id}.png"
    if not cache_path.exists():
        try:
            png_bytes, _ = generate_preview_png(asset.path, asset.asset_type)
        except RasterioUnavailableError as exc:
            raise HTTPException(500, str(exc)) from exc
        storage_service.write_atomic(cache_path, png_bytes)
    return FileResponse(cache_path, media_type="image/png")


@router.delete("/{survey_id}/assets/{asset_id}")
def delete_survey_asset(survey_id: str, asset_id: str, db: Session = Depends(get_db)):
    asset = db.get(models.SurveyAsset, asset_id)
    if not asset or asset.survey_id != survey_id:
        raise HTTPException(404, "Asset not found")

    from app.config import settings

    # Only ever delete bytes we copied into our own data dir. Assets registered
    # in place (DJI mission folders, seeded imagery) point at the user's
    # original files — unregister them, never unlink them.
    path = asset.path.resolve()
    if path.is_relative_to(settings.surveys_dir.resolve()):
        path.unlink(missing_ok=True)
    (settings.asset_previews_cache_dir / f"{asset.id}.png").unlink(missing_ok=True)
    db.delete(asset)
    db.commit()
    return {"deleted": asset_id}


@router.get("/{survey_id}/availability", response_model=schemas.SurveyAssetsAvailability)
def get_survey_availability(survey_id: str, db: Session = Depends(get_db)):
    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")

    asset_types = {a.asset_type for a in survey.assets}
    bands = {img.band for img in survey.images}
    has_gps = any(img.lat is not None for img in survey.images)

    return schemas.SurveyAssetsAvailability(
        rgb_images=any(img.band == "RGB" for img in survey.images),
        gps_metadata=has_gps,
        multispectral=bool(bands & {"GREEN", "RED", "RED_EDGE", "NIR"}),
        nir="NIR" in bands,
        red_edge="RED_EDGE" in bands,
        thermal="THERMAL" in bands,
        orthomosaic="orthomosaic" in asset_types,
        model_3d="model3d" in asset_types,
        pointcloud="pointcloud" in asset_types,
        gnss_ppk=any(t.startswith("gnss_") for t in asset_types),
        dsm="dsm" in asset_types,
    )


@router.get("/{survey_id}/field-boundary")
def get_field_boundary(survey_id: str, db: Session = Depends(get_db)):
    """Convenience endpoint returning the parent field's boundary for this survey."""
    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")
    field = survey.field
    return {
        "field_id": field.id,
        "boundary": json.loads(field.boundary_geojson) if field.boundary_geojson else None,
        "center_lat": field.center_lat,
        "center_lon": field.center_lon,
        "area_hectares": field.area_hectares,
    }
