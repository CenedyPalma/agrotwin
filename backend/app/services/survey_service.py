"""Survey creation and image ingestion.

Boundary/area math uses a local equirectangular projection centered on the
image centroid. That's accurate enough for a single field (a few hundred
meters across) without pulling in pyproj/GDAL as a hard dependency. It is
approximate and should be replaced by a proper geodesic/UTM calculation
before this is trusted at larger scale.
"""

import json
import math
import re
from datetime import datetime
from pathlib import Path

from shapely.geometry import MultiPoint, mapping
from sqlalchemy.orm import Session

from app import models
from app.services.metadata_service import extract_image_metadata

EARTH_RADIUS_M = 6371000.0

# DJI Mavic 3 Multispectral naming: DJI_<YYYYMMDDhhmmss>_<seq>_<D|MS_G|MS_R|MS_RE|MS_NIR>.<JPG|TIF>
# The RGB JPG and the band TIFs of one shutter release can carry timestamps a
# second apart, so the frame key is <mission folder>:<seq>, not the timestamp.
DJI_FRAME_RE = re.compile(r"^DJI_\d{14}_(\d{4})_(D|MS_G|MS_R|MS_RE|MS_NIR)\.(jpe?g|tiff?)$", re.IGNORECASE)
DJI_BAND_BY_SUFFIX = {"D": "RGB", "MS_G": "GREEN", "MS_R": "RED", "MS_RE": "RED_EDGE", "MS_NIR": "NIR"}
DJI_STAMP_RE = re.compile(r"^DJI_(\d{14})_", re.IGNORECASE)
FRAME_PAIR_WINDOW_S = 3  # an M3M release's RGB JPG and band TIFs are stamped up to ~2 s apart

# Non-image files a DJI mission folder ships alongside the frames.
GNSS_ASSET_TYPES = {
    ".mrk": "gnss_timestamp_mrk",  # per-frame RTK positions + fix quality
    ".nav": "gnss_ppk_nav",  # RINEX navigation
    ".obs": "gnss_ppk_obs",  # RINEX observations
    ".bin": "gnss_ppk_raw",  # raw receiver log
}


def camera_fields(meta) -> dict:
    return {
        "gimbal_yaw_deg": meta.gimbal_yaw_deg,
        "gimbal_pitch_deg": meta.gimbal_pitch_deg,
        "rel_altitude_m": meta.rel_altitude_m,
        "focal_px": meta.focal_px,
        "cx_px": meta.cx_px,
        "cy_px": meta.cy_px,
        "rtk_fix": meta.rtk_fix,
        "rtk_std_m": meta.rtk_std_m,
    }


def backfill_camera_metadata(db: Session, survey: models.Survey) -> int:
    """Fills the XMP-derived columns on rows ingested before they existed."""
    n = 0
    for img in survey.images:
        if img.focal_px is not None:
            continue
        try:
            meta = extract_image_metadata(img.path)
        except OSError:
            continue
        for k, v in camera_fields(meta).items():
            setattr(img, k, v)
        if meta.lat is not None:
            img.lat, img.lon = meta.lat, meta.lon
        n += 1
    db.flush()
    return n


def classify_dji_file(path: Path) -> tuple[str | None, str]:
    """Returns (frame_key, band). Non-DJI names fall back to RGB for JPGs and
    GRAY for single-band TIFs, with no frame grouping."""
    m = DJI_FRAME_RE.match(path.name)
    if m:
        return f"{path.parent.name}:{m.group(1)}", DJI_BAND_BY_SUFFIX[m.group(2).upper()]
    return None, "RGB" if path.suffix.lower() in (".jpg", ".jpeg") else "GRAY"


def _dji_stamp(name: str) -> datetime | None:
    m = DJI_STAMP_RE.match(name)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1), "%Y%m%d%H%M%S")
    except ValueError:
        return None


def classify_uploaded_file(db: Session, survey: models.Survey, path: Path) -> tuple[str | None, str]:
    """classify_dji_file for browser uploads. Those all land in one folder, so
    the mission folder can't tell apart sequence numbers that restart with
    every mission (battery swap); a shutter release is instead the same
    sequence number within a few seconds."""
    m = DJI_FRAME_RE.match(path.name)
    if not m:
        return classify_dji_file(path)
    seq, band = m.group(1), DJI_BAND_BY_SUFFIX[m.group(2).upper()]
    stamp = _dji_stamp(path.name)
    if stamp is None:
        return None, band
    rows = (
        db.query(models.SurveyImage.filename, models.SurveyImage.frame_key)
        .filter(models.SurveyImage.survey_id == survey.id, models.SurveyImage.frame_key.like(f"upload:%:{seq}"))
        .all()
    )
    for filename, key in rows:
        other = _dji_stamp(filename)
        if other is not None and abs((other - stamp).total_seconds()) <= FRAME_PAIR_WINDOW_S:
            return key, band
    return f"upload:{stamp:%Y%m%d%H%M%S}:{seq}", band


def _project_flat(lat: float, lon: float, lat0: float, lon0: float) -> tuple[float, float]:
    x = math.radians(lon - lon0) * math.cos(math.radians(lat0)) * EARTH_RADIUS_M
    y = math.radians(lat - lat0) * EARTH_RADIUS_M
    return x, y


def compute_boundary_and_area(points: list[tuple[float, float]]) -> tuple[dict | None, float | None, float, float]:
    """points: list of (lon, lat). Returns (geojson_polygon, area_hectares, center_lat, center_lon)."""
    if len(points) < 3:
        lons = [p[0] for p in points]
        lats = [p[1] for p in points]
        center_lon = sum(lons) / len(lons) if lons else 0
        center_lat = sum(lats) / len(lats) if lats else 0
        return None, None, center_lat, center_lon

    lons = [p[0] for p in points]
    lats = [p[1] for p in points]
    center_lon = sum(lons) / len(lons)
    center_lat = sum(lats) / len(lats)

    hull = MultiPoint(points).convex_hull
    boundary_geojson = mapping(hull)

    flat_points = [_project_flat(lat, lon, center_lat, center_lon) for lon, lat in points]
    flat_hull = MultiPoint(flat_points).convex_hull
    area_m2 = flat_hull.area
    area_hectares = area_m2 / 10000

    return boundary_geojson, round(area_hectares, 3), center_lat, center_lon


def ingest_images_from_directory(db: Session, survey: models.Survey, directory: Path) -> list[models.SurveyImage]:
    """Registers every frame file in place (no copying). Band and frame
    grouping come from the DJI filename; GPS/time from each file's own EXIF."""
    image_paths = sorted(
        p for p in directory.rglob("*") if p.suffix.lower() in (".jpg", ".jpeg", ".tif", ".tiff")
    )

    created: list[models.SurveyImage] = []
    for path in image_paths:
        meta = extract_image_metadata(path)
        frame_key, band = classify_dji_file(path)
        img = models.SurveyImage(
            survey_id=survey.id,
            filename=path.name,
            file_path=str(path),
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

    db.flush()
    survey.image_count = db.query(models.SurveyImage).filter_by(survey_id=survey.id).count()
    db.flush()
    return created


def ingest_gnss_files_from_directory(db: Session, survey: models.Survey, directory: Path) -> list[models.SurveyAsset]:
    """Registers DJI PPK/RTK sidecar files (.MRK/.nav/.obs/.bin) as assets, in
    place. They're kept for a future PPK post-processing step — nothing here
    applies corrections, so image positions stay as the EXIF GPS reported."""
    created: list[models.SurveyAsset] = []
    for path in sorted(directory.iterdir()):
        asset_type = GNSS_ASSET_TYPES.get(path.suffix.lower())
        if not asset_type:
            continue
        asset = models.SurveyAsset(
            survey_id=survey.id,
            asset_type=asset_type,
            file_path=str(path),
            format=path.suffix.lower().lstrip("."),
            source="dji_mission",
        )
        db.add(asset)
        created.append(asset)
    db.flush()
    return created


def delete_survey_files(survey: models.Survey) -> None:
    """Removes what the API wrote for the survey: uploads, quick-mosaic
    outputs, manual imports and caches. Frames and sidecars registered in
    place (DJI mission folders on the user's drive) are never touched, and
    neither are the photogrammetry/splat pipeline outputs under data/splats/
    and frontend/public/{tiles,models,splats}/<survey_id>/ — those are
    managed by the scripts that build them."""
    import shutil

    from app.config import settings

    shutil.rmtree(settings.surveys_dir / survey.id, ignore_errors=True)
    for img in survey.images:
        (settings.thumbs_cache_dir / f"{img.id}.jpg").unlink(missing_ok=True)
        (settings.band_display_cache_dir / f"{img.id}.png").unlink(missing_ok=True)
    for asset in survey.assets:
        (settings.asset_previews_cache_dir / f"{asset.id}.png").unlink(missing_ok=True)
    for p in settings.index_preview_cache_dir.glob(f"{survey.id}_*.png"):
        p.unlink(missing_ok=True)


def update_field_boundary_from_images(db: Session, field: models.Field, images: list[models.SurveyImage]) -> None:
    points = [(img.lon, img.lat) for img in images if img.lat is not None and img.lon is not None]
    if not points:
        return

    boundary, area_ha, center_lat, center_lon = compute_boundary_and_area(points)
    field.boundary_geojson = json.dumps(boundary) if boundary else None
    field.area_hectares = area_ha
    field.center_lat = center_lat
    field.center_lon = center_lon
    db.flush()
