"""Agricultural analysis generation — computed from the survey's own imagery.

Three real measurement paths, chosen per survey by what actually exists:

- method="ndvi_map": a georeferenced NDVI quick mosaic exists
  (mosaic_service). The field is gridded into 5 m cells; each cell's
  vegetation coverage (share of pixels with NDVI above the live-vegetation
  threshold) is measured in MAP space — one measurement per patch of
  ground, so overlapping photos no longer over-sample anything, and the
  healthy/attention/problem numbers are true area percentages.
- method="ndvi": multispectral frames but no mosaic. Per-frame NDVI from the
  raw bands (calibrated, registered); one sample per frame.
- method="exg": RGB-only. Per-image Excess Green Index (vision_service).

Per-frame stats are persisted on the frames in every case (they drive the
Crop Density point layer).

Nothing here is randomly generated. If there isn't enough real data,
`analyze_survey` returns None and writes nothing.

Documented limits:
- "ndvi"/"exg" are per-frame: overlapping photos aren't deduplicated, so
  they over-sample covered ground. "ndvi_map" fixes that, at the accuracy
  of the direct-georeferencing mosaic (see mosaic_service).
- Neither index identifies weed species, disease, or pest damage. Zones
  are labeled only by measurable characteristics (low vegetation density /
  bare soil / patchy vegetation), never by diagnosis.
- Healthy/attention/problem tiers are percentiles of this survey's own
  distribution, not hardcoded absolutes, so a different field or lighting
  re-baselines automatically. The two methods are therefore NOT directly
  comparable across surveys — the method is recorded on every result so
  the UI and assistant can say so.
"""

import json
import logging
from collections import defaultdict
from pathlib import Path

import numpy as np
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import unary_union
from sqlalchemy.orm import Session

from app import models
from app.services import multispectral_service
from app.services.vision_service import analyze_image_vegetation

# ~5m square footprint per sample point (degrees at mid-latitude). Photos on
# the same flight line overlap heavily, so neighbouring flagged frames merge
# into one contiguous zone instead of a scatter of separate dots.
ZONE_BUFFER_DEG = 0.00004

SAFE_ACTIONS = {
    "bare_soil": "Inspect area for emergence issues",
    "low_crop_density": "Ground inspection recommended",
    "patchy_vegetation": "Uneven vegetation detected — compare with previous survey",
}

log = logging.getLogger(__name__)

Sample = tuple[models.SurveyImage, float]  # (anchor image with GPS, vegetation_fraction)


def _classify_zone_type(vegetation_fraction: float) -> str:
    if vegetation_fraction < 0.15:
        return "bare_soil"
    if vegetation_fraction < 0.35:
        return "low_crop_density"
    return "patchy_vegetation"


def _group_frames(survey: models.Survey) -> dict[str, list[models.SurveyImage]]:
    frames: dict[str, list[models.SurveyImage]] = defaultdict(list)
    for img in survey.images:
        frames[img.frame_key or img.id].append(img)
    return frames


def _anchor(rows: list[models.SurveyImage]) -> models.SurveyImage | None:
    """The row whose GPS anchors the frame on the map: RGB if present."""
    with_gps = [r for r in rows if r.lat is not None and r.lon is not None]
    if not with_gps:
        return None
    return next((r for r in with_gps if r.band == "RGB"), with_gps[0])


def _measure_frames(frames: dict[str, list[models.SurveyImage]]) -> tuple[list[Sample], str]:
    """Returns (samples, method). Uses NDVI for every frame when the survey
    has multispectral bands; never mixes the two indices in one analysis."""
    has_ms = any({"NIR", "RED"} <= {r.band for r in rows} for rows in frames.values())
    samples: list[Sample] = []

    for n, rows in enumerate(frames.values(), 1):
        if n % 25 == 0:
            log.info("measured %d/%d frames", n, len(frames))
        anchor = _anchor(rows)
        if anchor is None:
            continue
        bands = {r.band: r.path for r in rows}

        if has_ms:
            if not {"NIR", "RED"} <= bands.keys():
                continue
            try:
                stats = multispectral_service.compute_frame_stats(bands)
            except (OSError, ValueError, multispectral_service.BandsUnavailableError) as exc:
                log.warning("skipping frame %s — unreadable band file: %s", anchor.frame_key, exc)
                continue
            if stats.vegetation_fraction is None:
                continue
            for r in rows:
                r.vegetation_fraction = stats.vegetation_fraction
                r.ndvi_mean = stats.ndvi_mean
                r.ndre_mean = stats.ndre_mean
                r.gndvi_mean = stats.gndvi_mean
            samples.append((anchor, stats.vegetation_fraction))
        else:
            if "RGB" not in bands:
                continue
            try:
                exg = analyze_image_vegetation(bands["RGB"])
            except (ValueError, OSError) as exc:
                log.warning("skipping frame %s — unreadable image: %s", anchor.frame_key, exc)
                continue
            for r in rows:
                r.vegetation_fraction = exg.vegetation_fraction
            samples.append((anchor, exg.vegetation_fraction))

    return samples, ("ndvi" if has_ms else "exg")


def analyze_survey(db: Session, survey: models.Survey, field: models.Field) -> models.AnalysisResult | None:
    samples, method = _measure_frames(_group_frames(survey))

    ndvi_mosaic = next(
        (a for a in survey.assets if a.asset_type == "ndvi" and a.source == "direct_georeferencing"), None
    )
    if ndvi_mosaic is not None and ndvi_mosaic.path.exists():
        result = analyze_from_mosaic(db, survey, field, ndvi_mosaic.path)
        if result is not None:
            return result

    if not samples:
        return None

    fractions = np.array([f for _, f in samples])
    p20 = float(np.percentile(fractions, 20))
    p50 = float(np.percentile(fractions, 50))
    spread = max(float(np.std(fractions)), 1e-6)

    healthy = int((fractions > p50).sum())
    attention = int(((fractions > p20) & (fractions <= p50)).sum())
    total = len(samples)
    problem = total - healthy - attention

    result = models.AnalysisResult(
        survey_id=survey.id,
        healthy_area_percent=round(100 * healthy / total, 1),
        attention_area_percent=round(100 * attention / total, 1),
        problem_area_percent=round(100 * problem / total, 1),
        method=method,
        is_mock=False,
    )
    db.add(result)
    db.flush()

    flagged = [(img, f) for img, f in samples if f <= p20]
    _create_clustered_zones(db, result, flagged, p20, spread)

    db.flush()
    return result


def _create_clustered_zones(
    db: Session, result: models.AnalysisResult, flagged: list[Sample], p20: float, spread: float
) -> None:
    if not flagged:
        return

    buffers = [Point(img.lon, img.lat).buffer(ZONE_BUFFER_DEG, cap_style=3) for img, _ in flagged]
    merged = unary_union(buffers)
    clusters = list(merged.geoms) if hasattr(merged, "geoms") else [merged]

    for cluster_poly in clusters:
        members = [(img, f) for img, f in flagged if cluster_poly.intersects(Point(img.lon, img.lat))]
        if not members:
            continue

        member_fractions = [f for _, f in members]
        worst = min(member_fractions)
        avg_z = float(np.mean([(p20 - f) / spread for f in member_fractions]))
        confidence = round(min(0.95, 0.55 + min(max(avg_z, 0), 3) * 0.1 + min(len(members), 5) * 0.02), 2)

        severity = "high" if worst < p20 * 0.5 else "medium" if worst < p20 * 0.85 else "low"
        zone_type = _classify_zone_type(worst)

        db.add(
            models.DetectionZone(
                analysis_result_id=result.id,
                type=zone_type,
                severity=severity,
                confidence=confidence,
                geometry_geojson=json.dumps(mapping(cluster_poly)),
                recommended_action=SAFE_ACTIONS[zone_type],
            )
        )


# ---------------------------------------------------------------------------
# Map-space analysis on the NDVI quick mosaic
# ---------------------------------------------------------------------------

CELL_M = 5.0  # analysis cell size (metres)
MIN_VALID_FRACTION = 0.5  # a cell needs this much mosaic coverage to count


def analyze_from_mosaic(db: Session, survey: models.Survey, field: models.Field, ndvi_path: Path) -> models.AnalysisResult | None:
    import rasterio
    from rasterio.warp import transform as warp_transform

    from app.services.multispectral_service import NDVI_VEGETATION_THRESHOLD

    with rasterio.open(ndvi_path) as src:
        ndvi = src.read(1)
        tf = src.transform
        crs = src.crs
    gsd = abs(tf.a)
    cell_px = max(2, int(round(CELL_M / gsd)))
    H, W = ndvi.shape
    rows, cols = H // cell_px, W // cell_px
    if rows == 0 or cols == 0:
        return None

    boundary = shape(json.loads(field.boundary_geojson)) if field.boundary_geojson else None

    cells = []  # (r, c, veg_fraction, mean_ndvi)
    for r in range(rows):
        for c in range(cols):
            block = ndvi[r * cell_px:(r + 1) * cell_px, c * cell_px:(c + 1) * cell_px]
            valid = ~np.isnan(block)
            if valid.mean() < MIN_VALID_FRACTION:
                continue
            vals = block[valid]
            cells.append((r, c, float((vals > NDVI_VEGETATION_THRESHOLD).mean()), float(vals.mean())))
    if len(cells) < 10:
        return None

    # cell centres -> lon/lat, keep those inside the field boundary
    xs = [tf.c + (c + 0.5) * cell_px * tf.a for _, c, _, _ in cells]
    ys = [tf.f + (r + 0.5) * cell_px * tf.e for r, _, _, _ in cells]
    lons, lats = warp_transform(crs, "EPSG:4326", xs, ys)
    if boundary is not None:
        field_area = boundary.buffer(0.00007)  # camera-position hull + ~8 m: half a frame footprint beyond the outermost cameras
        keep = [i for i, (lo, la) in enumerate(zip(lons, lats)) if field_area.contains(Point(lo, la))]
        if len(keep) >= 10:
            cells = [cells[i] for i in keep]

    fractions = np.array([f for _, _, f, _ in cells])
    p20 = float(np.percentile(fractions, 20))
    p50 = float(np.percentile(fractions, 50))
    spread = max(float(np.std(fractions)), 1e-6)
    healthy = int((fractions > p50).sum())
    attention = int(((fractions > p20) & (fractions <= p50)).sum())
    total = len(cells)
    problem = total - healthy - attention

    result = models.AnalysisResult(
        survey_id=survey.id,
        healthy_area_percent=round(100 * healthy / total, 1),
        attention_area_percent=round(100 * attention / total, 1),
        problem_area_percent=round(100 * problem / total, 1),
        method="ndvi_map",
        is_mock=False,
    )
    db.add(result)
    db.flush()

    # zones: union of bottom-tier cells, as real ground polygons
    flagged = [(r, c, f) for r, c, f, _ in cells if f <= p20]
    polys = []
    for r, c, f in flagged:
        x0, y1 = tf.c + c * cell_px * tf.a, tf.f + r * cell_px * tf.e
        x1, y0 = x0 + cell_px * tf.a, y1 + cell_px * tf.e
        corner_lons, corner_lats = warp_transform(crs, "EPSG:4326", [x0, x1], [y0, y1])
        polys.append((box(corner_lons[0], corner_lats[0], corner_lons[1], corner_lats[1]), f))
    if polys:
        # dilate a little so diagonally-adjacent cells merge into one zone
        eps = abs(polys[0][0].bounds[2] - polys[0][0].bounds[0]) * 0.15
        merged = unary_union([p.buffer(eps, join_style=2) for p, _ in polys]).buffer(-eps, join_style=2)
        clusters = list(merged.geoms) if hasattr(merged, "geoms") else [merged]
        for cluster in clusters:
            members = [f for p, f in polys if cluster.intersects(p.centroid)]
            if not members:
                continue
            worst = min(members)
            avg_z = float(np.mean([(p20 - f) / spread for f in members]))
            confidence = round(min(0.95, 0.55 + min(max(avg_z, 0), 3) * 0.1 + min(len(members), 5) * 0.02), 2)
            severity = "high" if worst < p20 * 0.5 else "medium" if worst < p20 * 0.85 else "low"
            zone_type = _classify_zone_type(worst)
            db.add(
                models.DetectionZone(
                    analysis_result_id=result.id,
                    type=zone_type,
                    severity=severity,
                    confidence=confidence,
                    geometry_geojson=json.dumps(mapping(cluster.simplify(0.000005))),
                    recommended_action=SAFE_ACTIONS[zone_type],
                )
            )
    db.flush()
    log.info("map-space analysis: %d cells of %.0f m, %d flagged", total, CELL_M, len(flagged))
    return result
