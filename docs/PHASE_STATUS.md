# Phase status

Roadmap phases per the original spec, and what's actually done.

- [x] Phase 1 — Project setup (Next.js + FastAPI, connected, CORS'd)
- [x] Phase 2 — Dashboard UI, wired to real API data: field cards, Recent
      Surveys, Problem Areas (`app/dashboard/page.tsx`)
- [x] Phase 3 — Cesium Digital Twin viewer, split into CesiumViewer
      (lifecycle only) + CesiumScene (boundary/points/camera) +
      SurveyImageryLayer (raster overlays) + DetectionLayer (zones/click).
      Field Map mode is fully real. 3D Twin mode reuses the same layers with
      a pitched camera — no real terrain/mesh yet (EllipsoidTerrainProvider
      only, no Ion token used anywhere). Photorealistic mode is a UI stub
      that honestly reports no splat reconstruction exists for this field.
- [x] Phase 4 — Survey management: create field/survey, upload images, view
      images + EXIF metadata + GPS, availability checklist, processing
      progress UI (`ProcessingProgress.tsx`) with real PENDING → UPLOADING →
      PROCESSING → GENERATING_ANALYSIS → COMPLETED/FAILED states.
- [x] Phase 5 — Real geospatial data + orthomosaics, end to end. Two
      sources of georeferenced rasters, both rendered in Cesium via
      SingleTileImageryProvider + Rectangle at their real bounds:
      (a) manual import of any GeoTIFF (`POST /api/surveys/{id}/assets`);
      (b) **quick mosaics built from the survey's own frames**
      (`mosaic_service.py`, direct georeferencing): RTK-fixed positions
      (σ≈2 cm on 229/230 frames), gimbal yaw, AGL altitude and the
      calibrated intrinsics from DJI XMP, frames undistorted with DJI's
      DewarpData (the RGB lens has ≈−11 % radial distortion — >1 m at the
      corners), centre-weighted blending. Outputs: RGB orthomosaic
      (10 cm/px) + NDVI/NDRE/GNDVI maps (15 cm/px) in UTM 16N. Built as the
      real `GENERATING_ORTHOMOSAIC` processing step and on demand
      (`POST /api/surveys/{id}/mosaic`, "Rebuild Quick Mosaic" button).
      Documented limits: flat-ground assumption, AGL relative to takeoff,
      no colour balancing, no bundle adjustment — a "2D quick map", not
      photogrammetry.
- [x] Phase 6 — Multispectral, on real data. The DJI mission folders
      (`DJI_202606031411_012_…` / `…1442_013_…`) carry Green/Red/RedEdge/NIR
      16-bit TIFs for all 230 frames plus PPK/RTK sidecars. Ingestion is
      band-aware (`survey_service.classify_dji_file`), frames are grouped by
      `frame_key`, and `multispectral_service` computes real per-frame
      NDVI/NDRE/GNDVI from the raw bands: stats persisted on each frame,
      colorized previews served by `/frames/{key}/index/{ndvi|ndre|gndvi}`,
      band TIFs viewable via `/display`. Bands are radiometrically
      calibrated from DJI's XMP (vignetting polynomial, black level,
      gain × exposure, sun-sensor irradiance) and registered with DJI's
      CalibratedHMatrix (measured: NIR↔RedEdge gradient correlation
      0.21 → 0.59). The map-space NDVI/NDRE/GNDVI come from the quick
      mosaic (Phase 5).
- [x] Phase 7 — Analysis measured from the survey's own imagery, method
      recorded on every result: `method="ndvi_map"` (5 m cells on the
      georeferenced NDVI mosaic — true area percentages, no double-counting
      of overlapping photos; the seeded survey), `method="ndvi"` (per-frame,
      multispectral without a mosaic), `method="exg"` (RGB-only Excess Green
      Index). Never mixed within one analysis; the UI and assistant label the
      method everywhere and warn when comparing across methods.
      `is_mock` is `false`. Per-frame scores drive the "Crop Density" layer.
      Still NOT a trained model: cannot identify weed species or disease —
      a real YOLO/SAM detector remains the upgrade path (needs labeled data;
      a hand-rolled row-alignment weed heuristic was deliberately not shipped
      because an unreliable heuristic dressed as a finding is fake data).
- [x] Phase 8 (architecture + template responder, no LLM API) —
      `llm_service.py` assembles structured field context and answers the
      question categories from the spec (status, problem areas, weeds,
      comparison — now a real survey-to-survey comparison with a caveat
      when the two surveys used different methods) via templates over real
      numbers — no API key is
      configured in this environment, so there's no live LLM call. The
      interface is exactly what a real LLM integration would plug into.
      `/ask-ai` is wired to it, not a static stub.
- [x] Phase 9 — Photorealistic (Gaussian splats) from the survey's frames:
      `scripts/build_splats.py` (GPU venv) runs pycolmap SfM with spatial
      pairing on the RTK positions (230/230 frames registered, 286k points),
      Sim3 geo-alignment to the RTK camera positions (0.22 m median
      residual → true scale/orientation), gsplat training (15k steps,
      ~90 min on the RTX 3050, 598k splats), then `scripts/tile_splats_spz.py`
      writes an SPZ-compressed KHR_gaussian_splatting 3D Tiles set
      (8.3 MB after pruning 176k floaters) into
      `frontend/public/splats/<survey_id>/` — the only form CesiumJS 1.145
      renders (verified: the SPZ path draws, the uncompressed path fails
      in Cesium's point pipeline). Photorealistic mode (`SplatLayer.tsx`)
      loads it and reports honestly when a survey has none. Because the
      viewer has no terrain, the cloud's ground plane is placed on the
      ellipsoid (`--ground-at-ellipsoid`) so it coincides with the imagery
      and zones instead of floating at its true ~263 m height. Known look:
      nadir-only captures give "needle" splats at grazing angles; the
      default camera is a steep view for that reason.
      **3D Twin mode now has real terrain**: `scripts/build_dense.py` turns
      the GPU-trained reconstruction into a dense point cloud (169k points,
      10 cm), a digital surface model (0.5 m GeoTIFF, "Elevation" layer) and
      a 2.5D terrain mesh textured with the RGB quick mosaic (3D Tiles,
      "3D Terrain" layer). Dense geometry comes from the 3DGS centres
      (each Gaussian is a surface sample with colour and a normal) because
      the PyPI `pycolmap` wheel is built without CUDA and refuses to run
      PatchMatch stereo; `--source mvs` is wired for a CUDA build. Known
      look: the DSM is an upper envelope, so the tree line at the field
      margins renders as spiky relief.

## Still open (honest gaps, not hidden)

- No PyTorch/YOLO/SAM — the analysis is classical CV on calibrated
  vegetation indices, not a trained deep-learning model. A real weed/disease
  detector needs labeled training data this project doesn't have.
- The 3D products are placed with their ground on the ellipsoid (the
  viewer has no global terrain), and the mesh is a 2.5D heightfield — it
  cannot represent overhangs (tree canopies become spikes/columns).
- Thermal stays disabled — no thermal band in this dataset.
- PPK post-processing is not run (no base-station data). It isn't needed
  here: the drone flew with network RTK (NTRIP) and 229/230 frames are
  RTK-FIXED at ≈2 cm — the app surfaces the fix quality per frame and uses
  those positions directly.
- shadcn/ui is used for the primitives (Button, Card, Badge, Checkbox,
  Input, Select, Tooltip, Separator) with the AgroTwin palette mapped onto
  its tokens; some layout chrome (sidebar, topbar) is still hand-written.

## Known simplifications (documented, not hidden)

- Field area/boundary use a flat local-projection approximation
  (`survey_service.py`), fine at field scale, not geodetically exact.
- SQLite + plain GeoJSON-in-text columns, not PostGIS. Service layer is the
  seam for that migration later.
- Processing job steps run synchronously in the request — no task queue yet
  (Celery/Redis is the intended next step per the original architecture).
- Vegetation analysis is per-image, not a stitched orthomosaic — overlapping
  photos aren't deduplicated, so it over-samples covered ground. Real
  photogrammetry (ODM/WebODM) would fix this; nothing here fakes that step.
