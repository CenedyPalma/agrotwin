# Dev environment notes

## Windows machine (E:\Test1\agrotwin, since 2026-09-13)

- Everything project-related stays on E:\ — temp files, package caches
  (uv/pip), compiled CUDA kernels and logs live under `.cache/` and `logs/`.
  `run.ps1` (servers) and `run_gpu.ps1` (pipeline scripts) set TEMP/TMP,
  UV_CACHE_DIR, PIP_CACHE_DIR and TORCH_EXTENSIONS_DIR accordingly; do the
  same for anything started by hand.
- The backend venv is `backend/.venv-gpu` (Python 3.11, torch cu130, gsplat,
  pycolmap, all backend requirements). Install new packages there:
  `uv pip install --python backend\.venv-gpu\Scripts\python.exe <pkg>`.
  `backend/.venv` (Python 3.14, CPU only) still works for the API alone.
  The venv lives on an HDD: a cold `import torch` can take minutes after the
  OS cache evicts it — that's slow, not hung.
- The GPU is an RTX 4060 Ti 16 GB; CUDA COLMAP 4.2 is unpacked under
  `tools/colmap/` (build_splats.py finds it automatically).
- Raw frames of the current survey are referenced in place under
  `E:\40 ft\RGB Only\Part 1..3` (1,378 DJI `_D.JPG`, RGB only, no bands).

## exFAT drive can't hold symlinks

The source imagery lives on `/media/cdev/Personal1/...` which is exFAT.
`node_modules` and Python venvs rely on symlinks and will fail there
(`EPERM: operation not permitted, symlink`). That's why this project's code
lives at `~/Development/agrotwin` (ext4) instead of under
`/media/cdev/Personal1/Development/Agro/`. Raw drone images stay on the
external drive and are referenced by absolute path — nothing is duplicated.

This matches the precedent already set by the `CesiumSplatData` project
(same machine, same issue, documented in its own README).

## GPU

RTX 3050 6GB laptop GPU is available (confirmed via `nvidia-smi`). Not
needed for the current phases (dashboard, Cesium field map, metadata
extraction all run fine on CPU). It matters starting at:

- Phase 7 (AI analysis) — YOLO/segmentation model inference
- Phase 9 (advanced 3D) — Gaussian splat training, same GPU already used
  successfully by the `CesiumSplatData` project (`gsplat` + CUDA toolchain
  at `~/venvs/splat`, `~/cuda-apt/toolchain`)

No need to route AgroTwin's own venv through that CUDA toolchain until CV
work actually starts.

## Cesium: no Ion token

`components/cesium/CesiumViewer.tsx` intentionally uses no
`Cesium.Ion.defaultAccessToken`. Basemap is Esri World Imagery (aerial,
free, no key) via `UrlTemplateImageryProvider`; terrain is
`EllipsoidTerrainProvider` (flat). This mirrors the working pattern already
proven in the `Cesium tech` reference project on this machine — reuse that
pattern rather than reaching for Ion-gated features (World Terrain, OSM
Buildings, Google 3D Tiles) unless a token is explicitly provisioned later.

## The external drive has bad sectors (found 2026-09-12)

While seeding the multispectral survey, three band TIFs in
`DJI_202606031442_013_DittyRoadSoybeanfield/` were unreadable at the
hardware level — `dmesg` reported `critical medium error, dev sda` and even
`md5sum` returned `Input/output error`:

- `DJI_20260603144600_0025_MS_NIR.TIF`
- `DJI_20260603144620_0029_MS_G.TIF`
- `DJI_20260603144630_0031_MS_R.TIF`

Their sizes are correct (the copy "succeeded"), the sectors just don't read
back. PIL memory-maps uncompressed TIFFs, so a failed page-in was a SIGBUS
that killed the whole seed process with no traceback. Every image open now
goes through `multispectral_service.open_image_safely` (a plain `read()`
into memory), which turns that into a catchable `OSError`; the analysis
skips such frames and logs them, and the image endpoints return 503.

Action for the user: back up the drive and check it (`smartctl`, or at
minimum re-copy those three files from the drone's SD card). The three
frames are still registered; they just have no NDVI stats and their
band/index previews can't be rendered until the files are readable.
