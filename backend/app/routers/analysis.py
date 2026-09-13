import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services import analysis_service, llm_service

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/{survey_id}", response_model=schemas.AnalysisResultOut)
def get_analysis(survey_id: str, db: Session = Depends(get_db)):
    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")

    result = max(survey.analysis_results, key=lambda r: r.created_at, default=None)
    if not result:
        raise HTTPException(404, "No analysis available for this survey yet")

    detections = [
        schemas.DetectionZoneOut(
            id=d.id,
            type=d.type,
            severity=d.severity,
            confidence=d.confidence,
            geometry=json.loads(d.geometry_geojson),
            recommended_action=d.recommended_action,
        )
        for d in result.detections
    ]

    return schemas.AnalysisResultOut(
        survey_id=survey.id,
        analysis_summary={
            "healthy_area_percent": result.healthy_area_percent,
            "attention_area_percent": result.attention_area_percent,
            "problem_area_percent": result.problem_area_percent,
        },
        method=result.method,
        is_mock=result.is_mock,
        detections=detections,
    )


@router.post("/{survey_id}/recompute", response_model=schemas.AnalysisResultOut)
def recompute_analysis(survey_id: str, db: Session = Depends(get_db)):
    """(Re)computes vegetation analysis from the survey's real RGB images
    (Excess Green Index — see analysis_service.py). No mock/demo data."""
    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")

    result = analysis_service.analyze_survey(db, survey, survey.field)
    if not result:
        raise HTTPException(422, "Not enough geotagged RGB images to compute analysis")
    db.commit()
    return get_analysis(survey_id, db)


class AskRequest(BaseModel):
    question: str


@router.post("/{survey_id}/ask")
def ask_assistant(survey_id: str, payload: AskRequest, db: Session = Depends(get_db)):
    """Farmer-friendly Q&A grounded in this survey's real structured analysis.
    See llm_service.py — no LLM call is made yet, but the context-assembly
    interface here is exactly what a real LLM integration would plug into."""
    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")

    result = max(survey.analysis_results, key=lambda r: r.created_at, default=None)
    context = llm_service.build_field_context(survey, survey.field, result)
    answer = llm_service.answer_question(payload.question, context)
    return {"question": payload.question, "answer": answer, "context_used": context}
