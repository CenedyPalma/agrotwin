"""Rewrites the absolute paths stored in the DB to wherever the project and
the raw survey folders live *now* (after moving the checkout to another
disk or machine). The API also re-roots stale paths on the fly
(storage_service.resolve_path), so this is housekeeping rather than a
requirement — but it keeps the DB honest and makes `file_path` readable.

Run (from backend/):  python -m scripts.relocate_paths [--dry-run]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import models  # noqa: E402
from app.database import SessionLocal, init_db  # noqa: E402
from app.services.storage_service import resolve_path  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    init_db()
    db = SessionLocal()
    changed = missing = 0
    try:
        for table in (models.SurveyImage, models.SurveyAsset):
            for row in db.query(table).all():
                new = resolve_path(row.file_path)
                if not new.exists():
                    missing += 1
                    continue
                if str(new) != row.file_path:
                    changed += 1
                    if not args.dry_run:
                        row.file_path = str(new)
        if not args.dry_run:
            db.commit()
    finally:
        db.close()
    print(f"{'would rewrite' if args.dry_run else 'rewrote'} {changed} paths; {missing} still missing")


if __name__ == "__main__":
    main()
