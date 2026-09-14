# AgroTwin — Technical Status Report (2026-09-14)

Purpose of this document: a complete, self-contained account of the AgroTwin project's state, the work done on 2026-09-13/14 to port it to a Windows GPU workstation and process a new survey, every measurement taken, every bug found, and the open questions. It is written for an AI assistant (or engineer) with no prior context, to support further analysis and planning. All numbers below are measured unless marked *estimated*.

---

## 1. What AgroTwin is

An agricultural "digital twin" web application for drone surveys of crop fields.

- **Backend**: Python / FastAPI / SQLAlchemy, SQLite database, a service layer for ingestion, georeferencing, orthomosaics, vegetation-index analysis, and 3D reconstruction scripts.
- **Frontend**: Next.js 16 (Turbopack), React, Tailwind v4, shadcn/ui, **CesiumJS 1.145** viewer with three modes: *Field Map* (2D rasters draped on an Esri basemap), *3D Twin* (terrain mesh / DSM), *Photorealistic* (3D Gaussian splats via `KHR_gaussian_splatting` + SPZ compression).
- **Project phases** (from `docs/PHASE_STATUS.md`): 9 phases, all previously completed on the original Linux dev machine for a different survey (230-frame multispectral flight at ~30 m AGL). No trained ML detector exists; "analysis" is classical vegetation indices (NDVI on multispectral, ExG on RGB-only).

Repository: `E:\Test1\agrotwin` (git, single "Initial commit" from the original machine; all current work is uncommitted by user instruction).

## 2. Hardware / environment

| Item | Value |
|---|---|
| OS | Windows 11 Pro (build 26200) |
| CPU | Intel i5-13600K, 14 cores / 20 threads |
| RAM | 31.8 GB |
| GPU | **NVIDIA RTX 4060 Ti, 16 GB VRAM**, compute capability 8.9, driver 616.92 (CUDA 13.1 capable) |
| Disks | **E:** 8 TB SATA **HDD** (project + data live here), C: 1 TB NVMe SSD (OS, system tools) |
| Python | 3.11.16 (uv-managed) for the project; 3.14.1 system (no PyTorch build exists for 3.14) |
| CUDA toolkit | 13.0 (`C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.0`) |
| Compiler | Visual Studio 2026 Build Tools, MSVC 14.44 |
| Node | 24.11.1 |

**User constraint: everything project-related must stay on E:.** Implemented via `run_gpu.ps1`, which sets `TEMP/TMP`, `UV_CACHE_DIR`, `PIP_CACHE_DIR`, `TORCH_EXTENSIONS_DIR`, `PYTHONUTF8=1` to `E:\Test1\agrotwin\.cache\...` before launching anything. Logs go to `E:\Test1\agrotwin\logs\`. Two system-level items remain on C: pending the user's decision: the CUDA toolkit (4.1 GB) and the global `uv` package cache (3.9 GB, mostly torch wheels downloaded for this project).

**Note on the HDD**: the Python venv is on the spinning E: drive. A cold `import torch` (~2 GB of CUDA DLLs) can take several minutes after the OS file cache is evicted; warm imports take <1 s. This is a startup cost, not a runtime cost.

### Environment layout

```
E:\Test1\agrotwin\
  backend\.venv-gpu\      Python 3.11: FastAPI + torch 2.14.0+cu130 + torchvision 0.29 + gsplat 1.5.3
                          + pycolmap 4.2.0 (CPU-only wheel) + rasterio 1.4.4 + scipy + opencv + shapely + ...
                          (the FastAPI app now runs from this venv, so the API can do CUDA work in-process)
  backend\.venv\          old Python 3.14 venv, no longer used by the running server
  tools\colmap\           COLMAP 4.2.0 official Windows CUDA build (GPU SIFT + GPU matching)
  .cache\{tmp,uv,pip,torch_extensions}\   all caches; torch_extensions holds gsplat's compiled CUDA kernels
  logs\                   all job logs (see §9)
  data\agrotwin.db        SQLite
  data\surveys\<id>\outputs\orthomosaic_quick.tif
  data\splats\<id>\       COLMAP workspace, undistorted images, training exports
  frontend\public\tiles\<id>\orthomosaic\   XYZ tile pyramid
  frontend\public\splats\<id>\              SPZ 3D Tiles (tileset.json + splat.glb)
  run.ps1                 starts backend :8000 + frontend :3000 (added by a parallel session)
  run_gpu.ps1             runs a python command in .venv-gpu with CUDA/MSVC on PATH and E:-only caches
```

## 3. The survey being processed

- Source: `E:\40 ft\RGB Only\Part {1,2,3}\` — **1,378 DJI Mavic 3 Multispectral (M3M) RGB JPEGs** (`DJI_<ts>_<seq>_D.JPG`, 5280×3956), three flight legs on 2026-06-03 (15:03, 15:14, 15:42 local). RGB only — no multispectral bands, no GNSS sidecar files.
- Files are **referenced in place** (absolute paths in `survey_images.file_path`); nothing copied. All 1,378 resolve.
- Per-frame XMP metadata (read via PIL + `defusedxml`): RTK fix = FIXED, σ ≈ 2 cm; gimbal pitch −90° (nadir); relative altitude ≈ 12.3 m (**"40 ft"**); calibrated focal 3725 px; principal point (2640, 1978); DJI DewarpData (Brown distortion) present.
- Location: ~36.0968° N, 85.5830° W (UTM zone 16N, EPSG:32616). Camera extent radius 79.4 m; field ≈ 2.5 ha.
- Database: 1 farm, 1 field "40 ft RGB Site" (crop_type defaulted to "soybean" — **unverified**), 1 survey (id `8dab5067ab14`), 1,378 `survey_images`, 2 `survey_assets`, 3 `analysis_results`, 48 `detection_zones`.

## 4. Pipeline stages and measurements

### 4.1 Ingestion
`backend/scripts/ingest_40ft_rgb.py` (new): registers the three folders as one survey, extracts EXIF/XMP, computes the field boundary (convex hull of frame positions), runs analysis. ~15 min (metadata extraction is single-threaded PIL).

### 4.2 Orthomosaic (2D, "quick map" by direct georeferencing)
`app/services/mosaic_service.py`. Each nadir frame is undistorted with DJI DewarpData, then affine-warped pixel→ground using RTK position, gimbal yaw, AGL and focal length; centre-weighted blend (inner 70%, cubic falloff). Flat-ground assumption; no bundle adjustment; no colour balancing.

- Output: `orthomosaic_quick.tif`, **8992 × 8812 px at 0.02 m/px**, EPSG:32616, 93 MB. 1,340 of 1,378 frames used (38 failed the nadir filter).
- **GPU port** (new): undistortion via `torch.nn.functional.grid_sample`; warp + weighted accumulation via one `grid_sample` for RGB + weight. Verified against the PIL/numpy path: identity transform exact; on realistic imagery max |Δ| = 0.067 / 255, 97% of pixels bit-identical after uint8 rounding. **5.1× faster** per frame (32.9 ms vs 168.1 ms). Automatic numpy fallback without CUDA.
- Wall time for the full mosaic: 14.9 min (JPEG decode on CPU is the remaining bottleneck; measured nvJPEG ≈ PIL on this GeForce card, so GPU decode gains nothing).
- Tile pyramid (`scripts/build_tiles.py`, existing): 3,639 WebP tiles, zoom 14–23, registered as an `xyz` asset; the viewer uses `UrlTemplateImageryProvider` for it.

### 4.3 Analysis
`app/services/analysis_service.py` (modified by a parallel session): `exg_map` — Excess Green Index computed on the orthomosaic in map space (true area percentages, no double-counting of overlapping photos). Latest result: **66.0% healthy / 32.2% needs attention / 1.7% problem, 23 zones**. Method is labelled on the result. Earlier per-frame `exg` result (50/30/20, 12 zones) is superseded.

### 4.4 Structure-from-Motion (COLMAP)
`backend/scripts/build_splats.py` (heavily modified). Stages are resumable.

| Stage | Tool | Device | Measured |
|---|---|---|---|
| SIFT extraction (max 2400 px) | COLMAP 4.2 CLI `feature_extractor --FeatureExtraction.use_gpu 1` | **GPU** | 4.5 min for 1,378 frames (CPU pycolmap: ~1 s/frame, ~23 min) |
| Spatial matching (40 GPS neighbours, 80 m) | `spatial_matcher --FeatureMatching.use_gpu 1` | **GPU** (95% util) | 3.4 min |
| Mapping | `global_mapper` (rotation averaging + global positioning + 3 BA iterations) | CPU | **72 min → 1,378/1,378 registered, 769,984 points**, one model |
| (alternative) incremental `mapper` | ran in parallel as a race | CPU | reached 1,020/1,378 in ~100 min, still in global BA when stopped — global mapper won decisively |
| Geo-alignment | `pycolmap.align_reconstruction_to_locations` (Sim3 to RTK camera positions, then ENU→glTF rotation) | CPU (seconds) | **median camera residual 0.48 m**, Sim3 scale 12.97 |
| Undistortion to PINHOLE @ 2400 px | new GPU implementation (`undistort_gpu`: grid through `pycolmap.Camera.img_from_cam`, `grid_sample`, antialiased resize, nvJPEG encode) | **GPU** | ~9.5 frames/s (COLMAP CPU undistorter: 2.2 s/frame); verified vs COLMAP output: mean 0.58 grey levels, 99.6% within 3 |

Important: **bundle adjustment is CPU in this COLMAP build.** COLMAP exposes `--Mapper.ba_use_gpu 1`, but the log shows `Ceres was compiled without CUDA support` / `without cuDSS support` — the shipped Windows binary's solver library lacks GPU. GPU BA would require building COLMAP + Ceres + cuDSS from source. The PyPI `pycolmap` wheel is CPU-only (`pycolmap.has_cuda == False`); `pycolmap-cuda12` exists on PyPI but only as manylinux wheels (no Windows).

Camera model chosen by COLMAP: SIMPLE_RADIAL (single camera for all frames).

### 4.5 3D Gaussian Splatting training
`backend/scripts/gsplat_train.py` (**new, 439 lines**) — replaces an external `CesiumSplatData/train.py` that lived only on the original machine. Built on gsplat 1.5.3's public API: `rasterization`, `DefaultStrategy` / `MCMCStrategy`, `export_splats`.

Design (current):
- Loads the undistorted COLMAP model (poses = `cam_from_world`, K = `calibration_matrix`, init points + colours from `points3D`).
- **Scene normalisation**: cameras centred on their centroid and scaled so the farthest is at radius 1 (scale factor 79.4 m). Poses and points transformed; exports and checkpoints map back to the geo-aligned metric frame (`means·s + origin`, `log_scales + log s`).
- Init: SfM points; scales = log(mean distance to 3 nearest neighbours) (KNN chunked at 256 rows — a 4096-row chunk was a 12.6 GB matrix); opacity 0.1; SH degree 3 (unlocked one degree per 1,000 steps).
- Optimiser: per-parameter Adam, reference learning rates (`means` 1.6e-4 × 1.1, `scales` 5e-3, `quats` 1e-3, `opacities` 5e-2, `sh0` 2.5e-3, `shN` 1.25e-4), exponential decay of `means` lr to 1% over the run.
- Loss: 0.8·L1 + 0.2·(1 − SSIM) (own 11×11 Gaussian-window SSIM). Opacity/scale regularisers default **0.0** (gsplat reference defaults).
- Rasterization: `packed=True`, `rasterize_mode="antialiased"`, `absgrad=True`.
- **Densification: `DefaultStrategy(absgrad=True, refine_stop_iter=15000)`** — classic gradient-driven clone/split, prune below opacity 0.005, opacity reset every 3,000 steps. Hard cap enforced by pruning the faintest splats when N exceeds `--cap-max` (skipped on reset steps).
- **Scale clamp**: each Gaussian's longest axis ≤ 1.0 m (in normalised log-space) after every optimiser step.
- Data loading: 8-thread PIL decode prefetcher, pinned memory, JPEG bytes cached in RAM (≤8 GB) after first read from the HDD.
- Checkpoints (`exports/checkpoint.pt`: step, all params, optimiser states) + `splat.ply` + a geometry sanity line every 2,000 steps; resume re-derives the lr schedule for the current run length.
- Output: standard 3DGS PLY (`x y z, f_dc_*, f_rest_*, opacity(logit), scale_*(log), rot_*(wxyz)`), consumed by `tile_splats_spz.py` and `build_dense.py`.

#### Training attempts (all on the same 1,378-frame workspace, 2400 px)

| # | Config | Outcome | Diagnosis |
|---|---|---|---|
| 1 | metric coords (no normalisation), MCMC cap 3M, opacity/scale reg 0.01 | killed by a **PC reboot** at step 9,100; model already diverged | Splat median height −321 m, p1/p99 −6,018 / +5,118 m, 99% of Gaussians km away. MCMC's position noise is calibrated for a unit-scale scene; in metres the effective noise was ~70× too large. |
| 2 | normalised, MCMC cap 3M, reg 0.01 | **CUDA OOM at step 4,500** (`isect_tiles` tried 11.45 GiB) | Memory 3.8 GB @1.6M → 19.2 GB @2.6M (spilled to system RAM, 8× slowdown). Bloated low-opacity Gaussians covering hundreds of tiles each. |
| 3 | normalised, MCMC cap 2M, reg 0.01, scale clamp 1 m | completed 30k steps (198 min), memory flat 3.2 GB — **but unusable** | Only 38,007 / 2M splats had opacity > 0.12; Σopacity = 27k; render = blurry blobs with a hole. Log: **1.4–1.65M of 2M splats relocated every 100 steps** (73–82%); L1 never improved after step ~3,000 (0.12–0.30 noise for 27k steps). Root cause: MCMC's random jitter + nadir-only, near-planar capture — a splat can slide along its view ray unpunished in its own view, renders wrongly in neighbours, dies, is respawned. Vertical spread grew 4.6 m → 12 m. |
| 4 (probe) | normalised, **DefaultStrategy**, reg 0, cap 2M, clamp 1 m, 3,000 steps | **correct behaviour** (15.3 min) | 0 splats pruned by the strategy; strategy requests +300–670k splats per refine (capped); 89% opacity > 0.12; geometry p1/median/p99 = −12.9 / −11.3 / −7.9 m (ground truth from SfM: −11.6 m; cameras at 0). Render vs photo: L1 0.109 (vs 0.180 for #3); all structure present (soil strip, rows, no holes), ~10 cm blob resolution at 3k steps. Tiled: 1,773,842 splats, 28.9 MB SPZ — **currently live in the viewer**. |
| **5 (running)** | resumed from #4 at step 3,000, cap raised to **3M**, 30,000 steps | in progress: step 8,000 at 04:26, memory 4.8 GB, 100% opacity > 0.12, 100% within 15 m of ground, ~2.9 steps/s, **ETA ≈ 06:30** | Tiles to Cesium automatically on completion. |

Reference for the "bad" run #3 vs probe #4, same frame `DJI_20260603150410_0026_D.JPG`: render L1 0.180 → 0.109.

### 4.6 3D Tiles export
`backend/scripts/tile_splats_spz.py` (existing, modified to remove the external dependency): prunes floaters (±15 m of ground plane, opacity > 0.12, longest axis < 1.5 m, radius < 100 m, vertical needles), recentres on the AABB midpoint, encodes **SPZ v2** (Niantic) inside a glTF with `KHR_gaussian_splatting` + `KHR_gaussian_splatting_compression_spz_2` — the only splat format CesiumJS 1.145 draws. Places the cloud's ground plane on the ellipsoid (the viewer renders no terrain). The frontend probes `/splats/<survey_id>/tileset.json` with a HEAD request; no restart needed when it changes.

### 4.7 Dense products (not yet run for this survey)
`backend/scripts/build_dense.py`: from the trained splats → voxel-thinned point cloud (3D Tiles POINTS), DSM GeoTIFF (upper envelope, 0.5 m), bare-earth DTM (morphological opening), 2.5D terrain mesh textured with the orthomosaic (3D Tiles) → registered as `dsm`/`dtm`/`pointcloud`/`model3d` assets for **3D Twin** mode. External-project dependency removed; **has not been executed on this survey yet** — it runs after training completes. MVS (`--source mvs`) is unavailable because pycolmap lacks CUDA.

## 5. Bugs found in the original code (all fixed)

1. **`defusedxml` missing from `requirements.txt`** — PIL needs it to parse XMP; without it every DJI field (gimbal, AGL, RTK fix, focal length) was silently `None`, so the mosaic produced 0 rasters. Latent on the original machine (installed transitively there).
2. **PIL `draft("RGB", (2640, 2640))` on 4:3 frames never reduced** (PIL requires the result ≥ the request in *both* dimensions), so every frame decoded at full 21 MP: 4× memory/time, and an `_ArrayMemoryError` on this machine. Fixed with an aspect-preserving target.
3. **`geo.json` path mismatch** — written to `colmap-workspace/`, resume looked in the project root.
4. **Three scripts depended on a sibling project (`CesiumSplatData`) that exists only on the original PC** — `build_splats.py` (train + tile), `tile_splats_spz.py`, `build_dense.py`. Replaced with in-repo code (two WGS84 helper functions were all the tiler actually needed).
5. **gsplat on Windows**: `_backend.py` passes `-O3 -Wno-attributes` to MSVC `cl.exe`, which rejects them. Patched in the venv's site-packages (Windows-guarded; not in the repo).
6. **COLMAP 4.x renamed CLI options** (`SiftExtraction.*` → `FeatureExtraction.*`, `SiftMatching.*` → `FeatureMatching.*`).
7. **`.gitignore`**: bare `lib/` ignored `frontend/lib/` (real source, never committed originally). Fixed by a parallel session; `.cache/`, `logs/`, `tools/`, `.venv-gpu/` added.
8. **Next.js 16 proxy truncated uploads at 10 MB** (`proxyClientMaxBodySize`). Fixed by a parallel session.
9. **Windows `cp1252` console** broke the tiler's `≈` character under a piped subprocess → `PYTHONUTF8=1` in the launcher.
10. Symlinks for image staging need admin on Windows → symlink → hardlink → copy fallback.

## 6. GPU vs CPU — final honest map

| Stage | Device | Note |
|---|---|---|
| SIFT extraction | GPU | CUDA COLMAP |
| Feature matching | GPU | CUDA COLMAP |
| Bundle adjustment / global positioning | **CPU** | shipped Ceres has no CUDA/cuDSS; source build required |
| SfM registration loop | **CPU** | inherently sequential |
| Undistortion | GPU | own implementation |
| Mosaic undistort + warp | GPU | own implementation, numpy fallback |
| JPEG decode | CPU | measured nvJPEG = PIL speed on GeForce (Huffman stage is CPU); parallel CPU decode feeds the GPU |
| 3DGS training | GPU | 4.8 GB at 3M splats |
| NDVI/ExG analysis, DSM, mesh | CPU | numpy/scipy; portable but not the bottleneck |

## 7. Parallel work by other sessions (same repo, coordinated)

Async job runner (`app/services/job_runner.py`, `/process`, `/mosaic`, `/recompute` return 202 + `GET /surveys/{id}/job`), `DELETE /api/surveys/{id}` and `/api/fields/{id}` (cleans only `data/surveys/<id>/`), `import_service.py`, `pointcloud_service.py`, `geodesy.py`, `run.ps1`, WAL + 30 s busy timeout on SQLite, `exg_map` tiering, frontend pages/hooks, docs (README, PHASE_STATUS, DEV_NOTES). None of these touch the GPU pipeline files.

## 8. Open items

1. Training run #5 completing (~06:30) and its tileset replacing the probe's.
2. `build_dense.py` for 3D Twin mode (DSM / DTM / point cloud / textured mesh) — script fixed, not yet run.
3. `docs/PHASE_STATUS.md` Phase 9 line should reference this 40 ft survey's products once they exist.
4. User decision: relocate the CUDA toolkit off C: (reinstall to E:, needs a UAC prompt) and/or clear the global uv cache.
5. Crop type of the field is a placeholder ("soybean") — no update endpoint existed at ingestion time.
6. **No weed/disease detector exists** — analysis is a vegetation index. A trained model needs labelled data.
7. Nothing is committed; 61 changed/untracked paths in `git status`. The user has not asked for a commit.

## 9. Files of record

- Logs: `logs/splats_train.log` (current run), `logs/splats_train_mcmc_failed.log` (attempt #3), `logs/splats_train_oom_3M.log` (#2), `logs/splats_train_prereboot.log` (#1), `logs/splats_probe_default.log` (#4), `logs/validate_train.log`, `logs/global_mapper.log`, `logs/mosaic_gpu.log`, `logs/tiles.log`.
- Failed-run artefacts kept for comparison: `data/splats/8dab5067ab14/failed_mcmc/{checkpoint.pt,splat.ply}`.
- Render comparison script: `.cache/tmp/render_check.py` (renders two training views from `exports/splat.ply` next to the source photos).
- Reference used for the trainer: gsplat `examples/simple_trainer.py` (saved at `logs/simple_trainer.py`).

## 10. Questions worth analysing

1. Is a **3M-splat cap** (~1 per 10 cm over 2.5 ha) the right ceiling for a 16 GB card at 2400 px, or would more steps at 2M / fewer at 4M give a better visual result? Memory headroom exists (4.8 GB used).
2. Would **stronger multi-view constraints** (e.g. a depth/planarity prior, or adding the 3D Twin's DSM as supervision) improve a nadir-only capture where 3DGS has weak depth cues?
3. Is building **COLMAP + Ceres + cuDSS** from source worth it for GPU bundle adjustment here (mapping was 72 min of the ~4 h pipeline)?
4. `DefaultStrategy` keeps requesting +300–670k splats per refine against the cap — is the `grow_grad2d` threshold (0.0002) too low for 2400 px imagery with fine residue texture, i.e. would a higher threshold converge to a better-allocated model?
5. The MCMC failure mode (relocation storm on near-planar, nadir-only data) may be worth documenting as a known limitation for this class of survey.
