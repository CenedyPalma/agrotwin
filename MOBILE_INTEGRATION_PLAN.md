# AgroTwin Mobile Integration Plan (Phase M1)

Status: analysis complete, no code changed. This document is the output of
Phase M1 only. Nothing below has been implemented yet.

## 1. What already exists (do not touch)

```
agrotwin/
├── backend/        FastAPI, SQLite (SQLAlchemy), local-first
│   └── app/
│       ├── main.py            CORS + router registration, startup job recovery
│       ├── config.py          Settings (paths, CORS origins, Ollama config)
│       ├── models.py          Farm → Field → Survey → SurveyImage/SurveyAsset/
│       │                      ProcessingJob/AnalysisResult/DetectionZone
│       ├── routers/
│       │   ├── fields.py      /api/fields
│       │   ├── surveys.py     /api/surveys  (images, assets, tiles, previews)
│       │   ├── analysis.py    /api/analysis (+ /ask, the LLM Q&A endpoint)
│       │   └── health.py
│       └── services/          job_runner, processing_service, analysis_service,
│                               orthomosaic_service, multispectral_service,
│                               pointcloud_service, tile_service, llm_service, …
│   └── scripts/                COLMAP/ODM import, gsplat_train, tiling — GPU pipeline
│                               (owned by a peer session; not touched here)
├── frontend/        Next.js (App Router), CesiumJS Digital Twin viewer
│   ├── app/dashboard, fields, fields/[id], fields/[id]/digital-twin,
│   │        surveys, surveys/[id], analysis, ask-ai, upload, settings
│   ├── components/cesium/     CesiumViewer + layers (Detection, Model, Splat,
│   │                          SurveyImagery, Vector) — reused as-is
│   └── lib/api.ts             typed fetch wrapper, calls relative /api/* paths
├── data/            uploads, surveys, orthomosaics, tiles, analysis, cache
└── run.ps1          starts backend :8000 (127.0.0.1) and frontend :3000 (127.0.0.1)
```

Key findings:

- **API base path is `/api/*`, unversioned.** The Next.js app never calls the
  backend directly — `next.config.ts` rewrites `/api/:path*` to
  `AGROTWIN_API_URL ?? http://127.0.0.1:8000`, so the web app's `lib/api.ts`
  uses relative paths. The mobile app has no such proxy and **must** call the
  FastAPI backend's absolute URL directly.
- **Response shapes are flat objects/arrays**, not the `{data, meta}` envelope
  described in the generic spec. E.g. `GET /api/fields` → `FieldSummary[]`
  directly, `GET /api/analysis/{surveyId}` → `AnalysisResultOut` directly.
  The mobile client will match the *actual* contract, not invent an envelope.
- **A dedicated Digital Twin route already exists**:
  `frontend/app/fields/[id]/digital-twin/page.tsx`, reachable at
  `/fields/{fieldId}/digital-twin?survey={surveyId}`. This is exactly the
  standalone URL a WebView needs — no new web route required for viewing.
  It has no postMessage bridge to a host app yet (see §5).
- **Survey detail page supports deep links** via query params already
  (`/surveys/{id}?frame=<key>&view=ndvi`), showing the existing convention
  the mobile app should follow rather than inventing its own.
- **The farmer-facing AI endpoint already exists and already matches the
  spec's architecture**: `POST /api/analysis/{surveyId}/ask` takes
  `{question}`, builds structured context server-side
  (`llm_service.build_field_context`) from the survey/field/analysis, and
  returns `{question, answer, responder, context_used}`. `responder` names
  whether Ollama (`llama3.2:3b` at `127.0.0.1:11435`) or the template
  fallback answered — this satisfies the "name the AI responder" requirement
  without any backend change.
- **Crop type already defaults to `"soybean"`** but is a free field on
  `Field`, so the multi-season/multi-crop model the spec asks for is already
  supported by the schema (a `Field` just needs more than one `Survey` across
  dates; there is no rigid "season" entity yet — acceptable for MVP).
- **`ProcessingJobOut.steps`** is a `list[dict]` (stage name + status), which
  is exactly what the mobile processing-progress UI needs.
- **Backend binds to `127.0.0.1`**, not `0.0.0.0` (`run.ps1` line 38, 45/54).
  A physical Android device cannot reach `127.0.0.1` on the laptop — this is
  a **real blocker**, addressed as a doc/run-flag issue, not a code rewrite
  (see §6, Risk 1).
- **CORS origins are a fixed allowlist** (`localhost:3000`, two production
  domains). This does not affect the mobile app's own `fetch()` calls (CORS
  is a browser-enforced policy; React Native's networking layer does not
  enforce it), but it **does** matter for the WebView, which is a real
  browser context loading `http://LAN_IP:3000` — that's same-origin page
  navigation, not a cross-origin XHR, so CORS is not triggered there either.
  No CORS change is needed for the mobile MVP.
- **No authentication exists anywhere** (`User` model exists but unused, no
  login flow) — matches the spec's "don't block on auth" guidance exactly.

## 2. API reuse plan (no backend changes needed for M2–M8)

| Mobile need                          | Existing endpoint                                   |
|---------------------------------------|-----------------------------------------------------|
| Fields list + health summary          | `GET /api/fields`                                   |
| Field detail                          | `GET /api/fields/{id}`                               |
| Field's surveys                       | `GET /api/fields/{id}/surveys`                       |
| Field boundary (for map)              | `GET /api/surveys/{surveyId}/field-boundary`         |
| Create field                          | `POST /api/fields`                                   |
| Delete field                          | `DELETE /api/fields/{id}`                            |
| Surveys list                          | `GET /api/surveys`                                   |
| Survey detail                         | `GET /api/surveys/{id}`                               |
| Survey asset availability             | `GET /api/surveys/{id}/availability`                 |
| Survey assets list                    | `GET /api/surveys/{id}/assets`                       |
| Asset preview PNG (map layer)         | `GET /api/surveys/{id}/assets/{assetId}/preview`     |
| Asset raw files (3D Tiles/GeoJSON)    | `GET /api/surveys/{id}/assets/{assetId}/files/{path}`|
| Processing job / progress             | `GET /api/surveys/{id}/job` (poll)                   |
| Trigger full pipeline                 | `POST /api/surveys/{id}/process`                     |
| Analysis result + detection zones     | `GET /api/analysis/{surveyId}`                       |
| Recompute analysis                    | `POST /api/analysis/{surveyId}/recompute`            |
| AI assistant (structured, farmer-safe)| `POST /api/analysis/{surveyId}/ask`                  |
| Drone image list                      | `GET /api/surveys/{id}/images`                       |
| Image thumbnail                       | `GET /api/surveys/{id}/images/{imageId}/thumbnail`   |
| Image full/display                    | `GET /api/surveys/{id}/images/{imageId}/file|display`|
| Upload drone images (small batches)   | `POST /api/surveys/{id}/images` (multipart)          |
| Import a processed asset              | `POST /api/surveys/{id}/assets`                      |
| Create survey                         | `POST /api/surveys`                                  |

All of this is reused as-is. **No new backend endpoint is required for the
mobile MVP through Phase M8 (map) and M9 (Digital Twin WebView).**

### Possible additive endpoint (Phase M7/M10, optional, not urgent)

The `/ask` endpoint's `context_used` payload is exactly the structured JSON
the spec wants surfaced to a chat UI, and it's already returned. If later the
mobile chat wants field-level (not just survey-level) context or a list of
"suggested questions" server-driven, that would be a **new additive**
endpoint, e.g. `GET /api/v1/fields/{id}/ai-context` — not a modification of
anything the web app uses. Deferred until M10; not needed to start.

### No versioned prefix needed yet

Since the mobile app consumes the exact same `/api/*` contract as the web
app (not a modified one), there is no need to stand up `/api/v1/*` for the
initial phases. If a mobile-only additive endpoint is added later (per
above), *that* endpoint will be versioned (`/api/v1/...`) per the project
rules, without touching any existing `/api/*` route.

## 3. Mobile map strategy

The web app already renders orthomosaic/NDVI/NDRE layers as plain PNGs via
`GET /api/surveys/{id}/assets/{assetId}/preview`, georeferenced by
`bounds_geojson`, and placed with Cesium's `SingleTileImageryProvider` +
`Rectangle`. This is a **raster-over-bounds** pattern, not an XYZ tile
pyramid consumed by the map for the primary farmer view (tile pyramids under
`data/tiles` are served as static files by Next.js for the Cesium imagery
layer specifically, at `/tiles/<survey>/<layer>/{z}/{x}/{y}`, and are
web-app-only static assets today, not exposed through a generic backend API
path mobile can hit directly without the Next.js static server).

Decision for the mobile Field Map screen (Phase M8):

- Use **`react-native-maps`** (Expo-compatible, no custom dev client needed
  for basic usage, matches "simplest stable solution") as the base map.
- Render the **field boundary** as a `Polygon` from
  `GET /api/surveys/{id}/field-boundary`.
- Render **detection zones** as `Polygon`/`Marker` overlays from
  `GET /api/analysis/{surveyId}` (`detections[].geometry`), colored by
  severity using the shared status token (`healthy`/`attention`/`problem`).
  This is the "Health" and "Problem Areas" default layer set.
- Render the **orthomosaic/NDVI/NDRE "Advanced Layers"** as an
  `Overlay`/`ImageOverlay`-style bounds-image using the same
  `/assets/{assetId}/preview` PNG endpoint the web app uses (react-native-maps
  supports a ground overlay via `<Overlay image=... bounds=...>` on Android
  through `react-native-maps`' `Overlay` component, or a bordered `Image`
  positioned by `MapView.Polygon`/`Marker` inset). If ground-overlay behavior
  proves unreliable on Android in Expo Go, fall back to opening that same
  bounds-PNG inside a small in-app image viewer keyed off the map, rather
  than forcing a heavier map engine into the MVP.
- **No new geospatial processing pipeline.** All raster generation stays in
  `orthomosaic_service` / `multispectral_service`; mobile only ever requests
  already-rendered PNGs and already-computed vector geometry.
- The XYZ tile pyramid under `/tiles/...` remains a **web-only, Next.js
  static-served concern** for the Cesium viewer; the mobile native map does
  not attempt to consume it, avoiding any need to duplicate a tile server.

Component split (per the spec's `components/map/` abstraction) maps cleanly:
`MapViewer` (react-native-maps wrapper) → `FieldBoundaryLayer` (Polygon) →
`DetectionZoneLayer` (Polygon/Marker + tap handler) → `OrthomosaicLayer`
(bounds overlay from `/preview`) → `SurveyImageLayer` (image-location
markers from `GET /api/surveys/{id}/images`, using `lat`/`lon`) →
`MapControls` (layer toggle chips, fit-to-field button).

## 4. Digital Twin WebView strategy

- Mobile screen `/twin/[surveyId]` opens a `DigitalTwinWebView` pointed at
  `${EXPO_PUBLIC_WEB_VIEWER_URL}/fields/${fieldId}/digital-twin?survey=${surveyId}`.
  `fieldId` is resolved first via `GET /api/surveys/{surveyId}` →
  `field_id`, since the existing web route is keyed by field, not survey.
- **No Cesium rewrite.** The exact same `frontend/app/fields/[id]/digital-twin`
  page and `components/cesium/*` are loaded inside the WebView unmodified.
- **Bridge (small, additive frontend change only):** the digital-twin page
  currently has no `postMessage` bridge to a host app. Add a *thin, optional*
  listener in that page (guarded so it's a no-op outside a WebView) that:
  - Posts `{"type": "VIEWER_READY"}` to `window.ReactNativeWebView` once
    Cesium has loaded, and `{"type": "ZONE_SELECTED", "zoneId": ...}` when
    `DetectionPanel` selection changes.
  - Listens for `window.addEventListener("message", ...)` (Android) /
    `document` (iOS WebView quirk) for `{"type": "SET_LAYER"|"FOCUS_ZONE"}`
    and forwards to the existing `useDigitalTwinStore` Zustand actions that
    already drive layer visibility and camera focus — reusing state the page
    already has, not inventing new control paths.
  This is additive: the page works exactly as before in a normal browser tab
  where no bridge exists to talk to.
- Mobile-side abstraction: `services/digitalTwinBridge.ts` owns all
  `postMessage`/`onMessage` (de)serialization; `DigitalTwinWebView.tsx` only
  calls `bridge.send(...)` and subscribes to `bridge.on(type, handler)` —
  screens never touch `WebView.postMessage` or `onMessage` directly.
- States handled by `DigitalTwinWebView`: loading (native spinner until
  `VIEWER_READY`), error (network/backend-offline message + Retry, using
  `onError`/`onHttpError`), fullscreen with safe-area-respecting back button.
- Gaussian Splats: the existing `SplatLayer.tsx` / `useDigitalTwinStore`
  already carries an availability/processing state (mirrors
  `SurveyAssetsAvailability`); the mobile Twin screen reads
  `GET /api/surveys/{id}/availability` (`model_3d`, `pointcloud`) beforehand
  to show "Available / Processing / Not Available" *before* even opening the
  WebView, so farmers aren't dropped into a broken viewer.

## 5. Local network connectivity plan

- `mobile/.env.example`:
  ```
  EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
  EXPO_PUBLIC_WEB_VIEWER_URL=http://192.168.1.100:3000
  ```
- `apiClient.ts` reads `process.env.EXPO_PUBLIC_API_URL` with no
  `localhost` fallback baked into request code — only the `.env.example`
  documents the placeholder LAN IP; `mobile/README.md` documents Android
  Emulator's `10.0.2.2` alias vs. a physical device's need for the laptop's
  real LAN IP.
- **Backend bind address is a real blocker for physical-device testing** and
  is called out explicitly rather than silently patched (see Risk 1 below).

## 6. Risks / compatibility issues

1. **Backend and frontend bind to `127.0.0.1` (`run.ps1`), unreachable from a
   phone on the same Wi-Fi.** Fix is additive and reversible: either (a)
   document running `uvicorn app.main:app --host 0.0.0.0 --port 8000` and
   `next dev -H 0.0.0.0` manually during mobile testing instead of
   `run.ps1`, or (b) add an opt-in `-Lan` switch to `run.ps1` that binds
   `0.0.0.0` only when passed. **This plan recommends (a) first** (zero risk
   to the existing script) and defers (b) to when/if the user wants it,
   since `run.ps1` is shared infra the peer GPU-pipeline session may also
   depend on — no change to it without asking, per the project's standing
   rule about not touching files that session owns without checking first.
2. **Response shape mismatch with the generic spec's `{data, meta}`
   envelope.** The mobile TypeScript types will model the *real* FastAPI
   Pydantic response shapes (`FieldSummary[]`, `AnalysisResultOut`, etc.),
   not the generic envelope from the prompt — matching reality takes
   priority over the abstract template.
3. **Digital Twin route is field-scoped, not survey-scoped** — mobile must
   do one extra `GET /api/surveys/{id}` lookup to get `field_id` before
   opening the WebView. Cheap, no backend change needed.
4. **Large multipart uploads**: `surveys.py` already batches at the
   frontend (`UPLOAD_BATCH_SIZE = 20`) and Next's proxy raises
   `proxyClientMaxBodySize` to 1&nbsp;GB — but the *mobile* client talks to
   FastAPI directly (no Next proxy in between), so that Next-specific limit
   is irrelevant to mobile; Starlette/Uvicorn itself has no default body-size
   cap, so small-batch upload from mobile works unchanged. Still, mobile
   upload UI will default to guiding large-survey users to the web app, per
   spec, purely as a UX choice — not a backend constraint.
5. **GPU pipeline / COLMAP / Gaussian Splat scripts under `backend/scripts/`
   and the `.venv-gpu` are owned by a peer session** (per prior project
   notes). This plan touches none of them, and no mobile phase requires
   running them — mobile only ever reads already-produced assets.
6. **No OpenAPI type generation set up yet.** For MVP, mobile TypeScript
   types will be hand-written to mirror `backend/app/schemas.py` exactly,
   with a comment pointing at the source file, rather than introducing a
   codegen step now.

## 7. Implementation status (2026-09-14)

Phases M2–M12 were implemented in one pass after this plan; `mobile/` is the
result. What was built, against the plan above:

| Plan item | Outcome |
|-----------|---------|
| Expo scaffold (SDK 57, Router, TanStack Query, Zustand, RHF + Zod, SecureStore, expo-image, pickers, location, gesture-handler, reanimated, react-native-maps, react-native-webview, lucide) | done — `mobile/package.json`; no NativeWind (plain StyleSheet + tokens from `DESIGN.md`) |
| API reuse (§2) | every endpoint in the table is consumed as-is; **zero backend changes** |
| Types mirror `schemas.py` | `mobile/types/api.ts` |
| Service layer / hooks | `mobile/services/*`, `mobile/features/*/hooks.ts`; no `fetch` in screens |
| Farmer map (§3) | `react-native-maps` (Google provider) — boundary polygon, zones by priority, flight path + capture points, orthomosaic/NDVI via **XYZ tiles from the web app's `/tiles`** (`UrlTile`), flat preview PNG only as fallback |
| Digital Twin (§4) | `DigitalTwinWebView` loads `/fields/{fieldId}/digital-twin?survey=…&embed=1`; bridge protocol `agrotwin-bridge/1` in `mobile/components/digitalTwin/digitalTwinBridge.ts` + **new** `frontend/lib/hostBridge.ts`; the page sends `VIEWER_READY / ZONE_SELECTED / MODE_CHANGED / SPLAT_STATUS / LAYER_ERROR` and accepts `SET_MODE / SET_LAYER / FOCUS_ZONE / SET_ADVANCED`; `?zone=` deep link added; site chrome hidden when embedded. Additive: the page is unchanged in a normal browser |
| Gaussian splats | viewed only; availability checked with a HEAD on `/splats/<survey>/tileset.json` (same as the web `SplatLayer`) |
| AI | `POST /api/analysis/{id}/ask` as-is; responder label shown on every answer; suggested questions; voice left as a documented extension point in `ChatComposer` |
| Upload | small batches (10 files/request) with progress, processed-asset import, create field/survey, optional processing trigger, large-survey guidance |
| Processing status | polls `GET /api/surveys/{id}/job` every 2 s while active, mirrors the web `useProcessingJob` invalidation |
| Docs | `mobile/README.md` (LAN / emulator / firewall / troubleshooting), root `README.md` "Mobile application" section |
| Tests | jest-expo: utils, API client error normalisation, analysis 404→null, bridge protocol, UI components |

Frontend files touched (additive only): `frontend/lib/hostBridge.ts` (new),
`frontend/app/fields/[id]/digital-twin/page.tsx` (bridge wiring, `?zone=`,
hide back-link when embedded). Backend: none. Database: none.

Open items carried forward (see the final report / mobile README):
`run.ps1` still binds `127.0.0.1` (start servers with `0.0.0.0` for phones —
a `-Lan` switch is being added by the peer session); the web app on :3000
runs `next dev`, so the bridge changes are live without a rebuild; a
server-side paginated image endpoint would be the first `/api/v1/*` addition
if image lists grow far beyond ~1,400 frames.
