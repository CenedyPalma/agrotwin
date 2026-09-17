import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services import job_runner, llm_service, processing_service

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


@router.post("/{survey_id}/recompute", response_model=schemas.ProcessingJobOut, status_code=202)
def recompute_analysis(survey_id: str, db: Session = Depends(get_db)):
    """Queues a fresh vegetation analysis from the survey's own imagery (see
    analysis_service). Poll GET /api/surveys/{id}/job for progress."""
    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")
    try:
        job = job_runner.enqueue(db, survey, processing_service.ANALYSIS_STEPS, processing_service.run_analysis_job)
    except job_runner.JobAlreadyRunning as exc:
        raise HTTPException(409, "This survey is being processed — wait for the current job to finish") from exc
    return processing_service.job_to_dict(job)


class AskRequest(BaseModel):
    question: str


@router.post("/{survey_id}/ask")
def ask_assistant(survey_id: str, payload: AskRequest, db: Session = Depends(get_db)):
    """Farmer-friendly Q&A grounded in this survey's structured analysis. The
    response names its responder: the local Ollama model when reachable, the
    template responder otherwise (see llm_service)."""
    survey = db.get(models.Survey, survey_id)
    if not survey:
        raise HTTPException(404, "Survey not found")

    result = max(survey.analysis_results, key=lambda r: r.created_at, default=None)
    context = llm_service.build_field_context(survey, survey.field, result)
    answer, responder = llm_service.answer_question(payload.question, context)
    return {"question": payload.question, "answer": answer, "responder": responder, "context_used": context}
