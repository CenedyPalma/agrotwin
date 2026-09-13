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


@router.get("/{field_id}/surveys", response_model=list[schemas.SurveyOut])
def list_field_surveys(field_id: str, db: Session = Depends(get_db)):
    field = db.get(models.Field, field_id)
    if not field:
        raise HTTPException(404, "Field not found")
    return field.surveys
