# Phase status

Roadmap phases per the original spec, and what's actually done.

- [x] Phase 1 — Project setup (Next.js + FastAPI, connected, CORS'd). Windows
      (`run.ps1`) and Linux (`run.sh`/`setup.sh`) launchers; the backend runs
      from `backend/.venv-gpu` (Python 3.11 + CUDA torch) when present.
- [x] Phase 2 — Dashboard UI, wired to real API data: field cards, Recent
      Surveys, Problem Areas (`app/dashboard/page.tsx`).
- [x] Phase 3 — Cesium Digital Twin viewer, split into CesiumViewer
      (lifecycle only) + CesiumScene (boundary/points/camera) +
      SurveyImageryLayer (raster drapes) + DetectionLayer (zones/click) +
      ModelLayer (3D Tiles meshes / point clouds) + VectorLayer (GeoJSON) +
      SplatLayer. Three modes; Advanced View adds NDVI/NDRE/GNDVI, elevation,
      point cloud and a live coordinate readout (WGS84 + terrain height).
- [x] Phase 4 — Survey management: create field/survey, batched resumable
      uploads (20 files per request, already-received files skipped, DJI
      band files paired into frames by sequence number + timestamp), image
      grid + lightbox (zoom/pan/fullscreen), EXIF/XMP metadata + GPS,
      availability checklist, delete survey/field (generated data only —
      in-place drone files are never removed).
- [x] Phase 5 — Real geospatial data + orthomosaics, end to end. Three
      sources of georeferenced rasters, all rendered in Cesium at their real
      bounds (tile pyramid when built, flat preview otherwise):
      (a) manual import of any GeoTIFF; (b) **quick mosaics built from the
      survey's own frames** (`mosaic_service.py`, direct georeferencing from
      RTK positions, gimbal yaw, AGL altitude, calibrated intrinsics and DJI
      DewarpData; GPU warp path with numpy fallback); (c) OpenDroneMap
      orthophotos via `scripts/import_odm.py`. Documented limits of (b):
      flat-ground assumption, AGL relative to takeoff, no colour balancing,
      no bundle adjustment — a "2D quick map", not photogrammetry.
- [x] Phase 6 — Multispectral, on real data (the Ditty Road M3M survey with
      Green/Red/RedEdge/NIR 16-bit TIFs + PPK/RTK sidecars). Band-aware
      ingestion, per-frame NDVI/NDRE/GNDVI from radiometrically calibrated
      (vignetting, black level, gain×exposure, sun sensor) and registered
      (CalibratedHMatrix) bands, colorized previews, map-space index mosaics.
      The survey currently loaded on this machine ("40 ft RGB Site") is
      RGB-only, so those layers are present in code but not in its data.
- [x] Phase 7 — Analysis measured from the survey's own imagery, method
      recorded on every result: `ndvi_map` / `exg_map` (5 m cells on the
      georeferenced NDVI mosaic / RGB orthomosaic — true area shares, no
      double-counting of overlapping photos), `ndvi` / `exg` (per frame, when
      no mosaic exists). Tiers compare each cell with the cover the field's
      own best ground reaches (p90): ≥80 % healthy, 50–80 % attention, <50 %
      problem — so a uniform field reads healthy and the shares are
      measured, not fixed by construction. Zones carry type (bare soil / low
      density / patchy), severity, confidence and a safe action. `is_mock`
      is `false` everywhere. Still NOT a trained model: cannot identify weed
      species or disease — a YOLO/SAM detector remains the upgrade path and
      needs labeled data this project doesn't have.
- [x] Phase 8 — Assistant: `llm_service.py` assembles structured field
      context (numbers, method, tier rule, previous survey) and answers via a
      local Ollama model when one is reachable, else via templates over the
      same real numbers. The API and UI report which responder answered, so
      the app never implies a model that isn't running. RAG is deliberately
      not built yet.
- [x] Phase 9 — Photorealistic (Gaussian splats) and dense 3D from the
      survey's frames: `scripts/build_splats.py` (CUDA COLMAP SfM with
      spatial pairing, Sim3 geo-alignment to the RTK camera positions,
      in-repo gsplat trainer `scripts/gsplat_train.py`), `tile_splats_spz.py`
      (SPZ-compressed KHR_gaussian_splatting 3D Tiles — the only form Cesium
      1.145 draws), `build_dense.py` (dense cloud, DSM, textured 2.5D terrain
      mesh). Proven end to end on the original 230-frame multispectral
      survey. For the 1,378-frame 40 ft survey (2026-09-14): SfM is done
      (1,378/1,378 frames registered, 770k points, 0.48 m median residual to
      the RTK positions), but the 3DGS training is **still in progress** —
      the first full runs drifted upward along the nadir-only view rays
      (median splat height ended ~5 m above the SfM ground; the cloud is a
      ~12 m thick smear), so the tileset currently under
      `frontend/public/splats/8dab5067ab14/` is NOT a usable reconstruction;
      a ground-band constraint is being added to the trainer. **3D Twin mode
      is real for this survey**: `build_dense.py --source sparse` (now the
      default) builds the dense products from the SfM's 760,597 triangulated
      points (≥3 views, 97.3 % within ±3 m of the ground plane) instead of
      the splats — a 509k-point cloud (10 cm voxels), a 0.5 m DSM
      (259–265 m ellipsoidal; the 5 m span is the tree line at the margins),
      a bare-earth DTM and a 108k-vertex terrain mesh textured with the quick
      mosaic, registered as `pointcloud` / `dsm` / `dtm` / `model3d` assets
      and served from `frontend/public/models/8dab5067ab14/`. Full
      measurements: `docs/STATUS_REPORT_2026-09-14.md`.
- [x] Mobile client — `mobile/` (Expo SDK 57 / React Native) farmer app
      against the same API and data: dashboard, field map (react-native-maps
      with boundary, zones, capture points and the `/tiles` pyramids), survey
      results, processing status, imports, AI assistant, and the Cesium
      Digital Twin in a WebView through the `agrotwin-bridge/1` host bridge
      (`frontend/lib/hostBridge.ts`). Zero backend changes. Verified with
      tsc, 36 jest tests and an Android bundle export; not yet run on a
      physical device from these sessions. See `mobile/README.md` and
      `MOBILE_INTEGRATION_PLAN.md` §7.
- [x] Processing architecture — jobs run on a background worker
      (`services/job_runner.py`): `POST …/process`, `…/mosaic`,
      `…/recompute` return 202 + a job, `GET /api/surveys/{id}/job` reports
      per-step progress, failures keep their message and can be retried,
      and jobs interrupted by an API restart are marked failed on startup.
      One in-process thread today; Celery/RQ replaces `submit()` later.
- [x] Manual import (§13 Mode B) — `services/import_service.py` accepts
      GeoTIFF rasters, GeoJSON, Cesium 3D Tiles (.zip) and LAS/LAZ point
      clouds (tiled by `pointcloud_service.py`). Everything is placed by the
      file's own georeference; unplaceable formats (bare glTF/OBJ, local-frame
      tilesets, CRS-less LAS, projected GeoJSON) are refused with a message
      saying what to export instead. Imports are served by the API from
      `data/surveys/<id>/imports/<asset>/`.

## Still open (honest gaps, not hidden)

- No PyTorch/YOLO/SAM inference — the analysis is classical CV on calibrated
  vegetation indices, not a trained deep-learning model. A real weed/disease
  detector needs labeled training data this project doesn't have.
- The generated 3D products are placed with their ground on the sampled
  global terrain (~10–30 m resolution), and the built-in mesh is a 2.5D
  heightfield — it cannot represent overhangs (tree canopies become spikes).
  An OpenDroneMap run (`import_odm.py`) or an imported 3D Tiles model gives
  true 3D.
- Thermal stays disabled — no thermal band in either dataset.
- PPK post-processing is not run (no base-station data); the drones flew with
  network RTK and positions are used as recorded, with fix quality shown.
- The 40 ft survey's Gaussian-splat model is pending a retrained model (see
  Phase 9); Photorealistic mode is the only viewer feature without usable
  data for this survey. The 3D Twin's terrain / elevation / point-cloud
  layers come from the SfM cloud and are real.
- The field's crop type was set to "soybean" at ingest as a placeholder —
  correct it with the pencil on the field page (`PATCH /api/fields/{id}`).
- The CUDA toolkit (4.1 GB) and the global uv cache (3.9 GB) still live on
  C:; moving them needs an admin reinstall — the user's call.
- Uploads go through the Next.js dev/prod proxy; a whole 1,378-frame flight
  is ~15 GB and is best registered in place with `scripts/ingest_40ft_rgb.py`
  (or the DJI mission-folder seeder) rather than pushed through a browser.
- Authentication is intentionally absent (single local user).

## Known simplifications (documented, not hidden)

- Field area/boundary use a flat local-projection approximation
  (`survey_service.py`), fine at field scale, not geodetically exact.
- SQLite (WAL) + plain GeoJSON-in-text columns, not PostGIS. Service layer
  is the seam for that migration later.
- Tier thresholds are relative to each survey's own p90 cover, so two
  surveys are only loosely comparable; the assistant and UI say so.
- Per-frame methods over-sample overlapping photos; the map-space methods
  fix that at the accuracy of the direct-georeferenced mosaic.
