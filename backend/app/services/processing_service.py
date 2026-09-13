"""Processing job state machine.

Kept deliberately simple (synchronous, in-process) for the local MVP. The
step list and status values are designed to map directly onto a future
Celery/Redis task queue: each STEPS entry becomes a task, ProcessingJob
becomes the row a worker updates, and PENDING/PROCESSING/COMPLETED/FAILED
stay the same vocabulary the frontend already renders.
"""

import json

from sqlalchemy.orm import Session

from app import models

STEPS = [
    "images_uploaded",
    "metadata_extracted",
    "processing_field",
    "generating_orthomosaic",
    "ai_analysis",
    "digital_twin_ready",
]

STEP_LABELS = {
    "images_uploaded": "Images Uploaded",
    "metadata_extracted": "Metadata Extracted",
    "processing_field": "Processing Field",
    "generating_orthomosaic": "Generating Orthomosaic",
    "ai_analysis": "AI Analysis",
    "digital_twin_ready": "Digital Twin Ready",
}

# The step currently in progress maps to one of §21's named states.
# generating_orthomosaic is the direct-georeferencing quick mosaic
# (mosaic_service) — a real step, not photogrammetry.
STEP_STATUS = {
    "images_uploaded": "UPLOADING",
    "metadata_extracted": "PROCESSING",
    "processing_field": "PROCESSING",
    "generating_orthomosaic": "GENERATING_ORTHOMOSAIC",
    "ai_analysis": "GENERATING_ANALYSIS",
    "digital_twin_ready": "PROCESSING",
}


def create_job(db: Session, survey: models.Survey) -> models.ProcessingJob:
    steps = [{"key": s, "label": STEP_LABELS[s], "status": "pending"} for s in STEPS]
    job = models.ProcessingJob(
        survey_id=survey.id,
        status="PENDING",
        current_step=STEPS[0],
        steps_json=json.dumps(steps),
    )
    db.add(job)
    db.flush()
    return job


def mark_step_complete(db: Session, job: models.ProcessingJob, step_key: str) -> None:
    steps = json.loads(job.steps_json or "[]")
    for step in steps:
        if step["key"] == step_key:
            step["status"] = "complete"

    next_step = next((s["key"] for s in steps if s["status"] == "pending"), None)
    job.current_step = next_step
    job.status = "COMPLETED" if next_step is None else STEP_STATUS[next_step]
    job.steps_json = json.dumps(steps)
    db.flush()


def mark_failed(db: Session, job: models.ProcessingJob, error: str) -> None:
    job.status = "FAILED"
    job.error_message = error
    db.flush()


def job_to_dict(job: models.ProcessingJob) -> dict:
    return {
        "id": job.id,
        "survey_id": job.survey_id,
        "status": job.status,
        "current_step": job.current_step,
        "steps": json.loads(job.steps_json or "[]"),
    }
