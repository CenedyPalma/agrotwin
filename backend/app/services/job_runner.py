"""Background execution of processing jobs.

One worker thread inside the API process: the heavy steps are GPU/CPU bound
and SQLite has a single writer anyway, so running jobs one after another is
both the simplest and the fastest option on a laptop. `submit` is the seam a
Celery/RQ queue replaces — callers only create a ProcessingJob row and hand
over its id.
"""

import logging
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy.orm import Session

from app import models
from app.database import SessionLocal
from app.services import processing_service

log = logging.getLogger(__name__)

Pipeline = Callable[[Session, models.ProcessingJob], None]

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="agrotwin-job")


class JobAlreadyRunning(Exception):
    pass


def enqueue(
    db: Session,
    survey: models.Survey,
    steps: list[str],
    pipeline: Pipeline,
    job: models.ProcessingJob | None = None,
) -> models.ProcessingJob:
    """Queues `pipeline` for the survey (on `job` when an unstarted one should be reused)."""
    if processing_service.is_running(processing_service.latest_job(survey)):
        raise JobAlreadyRunning(survey.id)
    job = job or processing_service.create_job(db, survey, steps)
    processing_service.queue(db, job)
    db.commit()
    submit(job.id, pipeline)
    return job


def submit(job_id: str, pipeline: Pipeline) -> None:
    _executor.submit(_run, job_id, pipeline)


def _run(job_id: str, pipeline: Pipeline) -> None:
    db = SessionLocal()
    try:
        job = db.get(models.ProcessingJob, job_id)
        if job is None:
            return
        processing_service.start(db, job)
        pipeline(db, job)
        db.commit()
    except Exception as exc:
        log.exception("processing job %s failed", job_id)
        db.rollback()
        job = db.get(models.ProcessingJob, job_id)
        if job is not None:
            processing_service.mark_failed(db, job, str(exc) or type(exc).__name__)
            if processing_service.is_full_pipeline(job):
                job.survey.status = "FAILED"
            db.commit()
    finally:
        db.close()


def recover_interrupted_jobs() -> int:
    """Marks jobs a previous API process was running as failed, so the UI stops
    waiting on them and offers to start again."""
    db = SessionLocal()
    try:
        stale = (
            db.query(models.ProcessingJob)
            .filter(models.ProcessingJob.status.in_(processing_service.WORKER_STATUSES))
            .all()
        )
        for job in stale:
            processing_service.mark_failed(db, job, "Interrupted: the API restarted while this job was running.")
            if processing_service.is_full_pipeline(job) and job.survey.status == "PROCESSING":
                job.survey.status = "FAILED"
        if stale:
            db.commit()
        return len(stale)
    finally:
        db.close()
