from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/api/fields", tags=["fields"])


def _to_summary(field: models.Field) -> schemas.FieldSummary:
    latest_survey = max(field.surveys, key=lambda s: s.created_at, default=None)
    healthy = attention = problem = None
    is_mock = None
    method = None
    if latest_survey and latest_survey.analysis_results:
        latest_result = max(latest_survey.analysis_results, key=lambda r: r.created_at)
        healthy = latest_result.healthy_area_percent
        attention = latest_result.attention_area_percent
        problem = latest_result.problem_area_percent
        is_mock = latest_result.is_mock
        method = latest_result.method

    return schemas.FieldSummary(
        id=field.id,
        farm_id=field.farm_id,
        name=field.name,
        crop_type=field.crop_type,
        boundary_geojson=field.boundary_geojson,
        area_hectares=field.area_hectares,
        center_lat=field.center_lat,
        center_lon=field.center_lon,
        created_at=field.created_at,
        latest_survey_id=latest_survey.id if latest_survey else None,
        latest_survey_status=latest_survey.status if latest_survey else None,
        healthy_area_percent=healthy,
        attention_area_percent=attention,
        problem_area_percent=problem,
        analysis_method=method,
        analysis_is_mock=is_mock,
    )


@router.get("", response_model=list[schemas.FieldSummary])
def list_fields(db: Session = Depends(get_db)):
    fields = db.query(models.Field).all()
    return [_to_summary(f) for f in fields]


@router.get("/{field_id}", response_model=schemas.FieldSummary)
def get_field(field_id: str, db: Session = Depends(get_db)):
    field = db.get(models.Field, field_id)
    if not field:
        raise HTTPException(404, "Field not found")
    return _to_summary(field)


@router.post("", response_model=schemas.FieldOut)
def create_field(payload: schemas.FieldCreate, db: Session = Depends(get_db)):
    farm_id = payload.farm_id
    if not farm_id:
        farm = db.query(models.Farm).first()
        if not farm:
            farm = models.Farm(name="My Farm")
            db.add(farm)
            db.flush()
        farm_id = farm.id

    field = models.Field(farm_id=farm_id, name=payload.name, crop_type=payload.crop_type)
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@router.patch("/{field_id}", response_model=schemas.FieldSummary)
def update_field(field_id: str, payload: schemas.FieldUpdate, db: Session = Depends(get_db)):
    """Renames the field and/or sets its crop type (ingested surveys default to 'soybean')."""
    field = db.get(models.Field, field_id)
    if not field:
        raise HTTPException(404, "Field not found")
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(422, "Field name cannot be empty")
        field.name = name
    if payload.crop_type is not None:
        crop = payload.crop_type.strip().lower()
        if not crop:
            raise HTTPException(422, "Crop type cannot be empty")
        field.crop_type = crop
    db.commit()
    db.refresh(field)
    return _to_summary(field)


@router.get("/{field_id}/surveys", response_model=list[schemas.SurveyOut])
def list_field_surveys(field_id: str, db: Session = Depends(get_db)):
    field = db.get(models.Field, field_id)
    if not field:
        raise HTTPException(404, "Field not found")
    return field.surveys


@router.delete("/{field_id}")
def delete_field(field_id: str, db: Session = Depends(get_db)):
    """Deletes the field and all of its surveys (see delete_survey for what is removed from disk)."""
    from app.services import processing_service
    from app.services.survey_service import delete_survey_files

    field = db.get(models.Field, field_id)
    if not field:
        raise HTTPException(404, "Field not found")
    if any(processing_service.is_running(processing_service.latest_job(s)) for s in field.surveys):
        raise HTTPException(409, "A survey of this field is being processed — wait for it to finish")
    for survey in field.surveys:
        delete_survey_files(survey)
    db.delete(field)
    db.commit()
    return {"deleted": field_id}
