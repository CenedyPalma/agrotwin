# AgroTwin Mobile

Farmer-facing Expo / React Native client for AgroTwin. It talks to the **same
FastAPI backend and Next.js web app** as the browser UI — no separate mobile
backend, no processing on the phone. The app shows fields, surveys, measured
crop-health analysis, attention zones, a field map, the drone image gallery,
the assistant, small uploads, and the existing CesiumJS Digital Twin (inside a
WebView).

```
mobile/
├── app/                 Expo Router screens (file = route)
│   ├── (tabs)/          Home · Fields · Surveys · Profile
│   ├── field/[id]       survey/[id]   analysis/[surveyId]   gallery/[surveyId]
│   ├── map/[surveyId]   twin/[surveyId]   ai/chat   upload/   settings/
├── components/          ui/ fields/ surveys/ analysis/ processing/ map/ digitalTwin/ gallery/ ai/ upload/
├── features/            TanStack Query hooks per domain (+ queryKeys.ts, zones.ts, upload flow)
├── services/            apiClient.ts + one service per backend router (fields, surveys, assets, analysis, processing, ai)
├── stores/              Zustand: settings (server URL, theme), map layers, chat thread, UI context, auth (future)
├── hooks/ utils/ constants/ types/ providers/ tests/
├── app.config.ts        Expo config (reads GOOGLE_MAPS_ANDROID_API_KEY from env for builds)
└── .env.example         copy to .env
```

Data flow is strictly `screen → feature hook → service → apiClient → FastAPI`.
No component calls `fetch` directly; TypeScript types in `types/api.ts` mirror
`backend/app/schemas.py`.

## 1. Requirements

| Tool | Version |
|------|---------|
| Node.js | 20 LTS or newer (developed with 24.11) |
| npm | 10+ |
| Expo SDK | 57 (React Native 0.86, React 19.2) — installed by `npm install` |
| Android | **Expo Go** from the Play Store on a phone, **or** Android Studio with an emulator (API 33+) |
| Backend | the existing AgroTwin backend + web app running on your computer |

No iPhone or macOS is needed for development. The same code runs on iOS:
install **Expo Go** on an iPhone and scan the same QR code (same Wi-Fi, same
LAN IP in `.env`). The map uses Apple Maps on iOS and Google Maps on Android,
so no map key is required in Expo Go on either platform. Producing an
installable iOS binary needs macOS/Xcode or EAS Build, and a release iOS build
that talks to a plain-`http` LAN server needs an App Transport Security
exception (`ios.infoPlist.NSAppTransportSecurity`) or https.

## 2. Install

```powershell
cd mobile
npm install
```

(The repo rule "everything stays on E:" applies: set `npm_config_cache` /
`TEMP` to folders under `E:\Test1\agrotwin\.cache` before running npm — the
`run.ps1` launchers already do this for the backend and web app.)

## 3. Configure `.env`

```powershell
copy .env.example .env
```

Edit `mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://<address>:8000          # FastAPI
EXPO_PUBLIC_WEB_VIEWER_URL=http://<address>:3000   # Next.js (Cesium viewer + tile pyramids)
```

Which `<address>`:

| Where the app runs | `<address>` | Why |
|--------------------|-------------|-----|
| Android **Emulator** | `10.0.2.2` | the emulator's alias for the host computer |
| **Physical phone** (Expo Go or a dev build) | your laptop's **LAN IP**, e.g. `192.168.1.100` | phones cannot reach the laptop's `localhost` |
| Web (`expo start --web`) on the laptop | `localhost` | same machine |

Find the LAN IP with `ipconfig` (Windows, "IPv4 Address" of the Wi-Fi adapter)
or `ip addr` (Linux). **Never put `localhost`/`127.0.0.1` in `.env` for a phone.**
`EXPO_PUBLIC_*` values are baked in at bundle time — restart `expo start` after
changing them. The server address can also be changed at runtime in
**Settings** inside the app (stored securely on the device), which is handy
when the laptop's IP changes.

## 4. Start the backend so a phone can reach it

By default `run.ps1` binds both servers to `127.0.0.1`, which is only
reachable from the laptop itself. For mobile testing start them on all
interfaces with the `-Lan` switch (it also prints the LAN URLs to use below):

```powershell
# from E:\Test1\agrotwin
.\run.ps1 -Lan          # or: .\run.ps1 dev -Lan
```

Or by hand (the project's `.cache`/`logs` conventions still apply):

```powershell
# backend — from E:\Test1\agrotwin\backend (use .venv-gpu when present)
.\.venv-gpu\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# web app — from E:\Test1\agrotwin\frontend
npm run dev -- -H 0.0.0.0 -p 3000
```

Then allow inbound TCP 8000 and 3000 through Windows Firewall (Private
network) once:

```powershell
New-NetFirewallRule -DisplayName "AgroTwin API 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Profile Private -Action Allow
New-NetFirewallRule -DisplayName "AgroTwin Web 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Profile Private -Action Allow
```

Check from the phone's browser: `http://<LAN IP>:8000/api/health` should show
`{"status":"ok"}` and `http://<LAN IP>:3000` the web app. CORS is not involved
for the native app (CORS is a browser policy); the WebView loads the web app
as a normal page, so the existing CORS allow-list does not need changes.

## 5. Run the app

```powershell
npm start               # Metro + QR code (LAN mode)
npm run android         # same, and opens the Android emulator / connected phone
npm run tunnel          # if phone and laptop are on different networks (slower)
```

- **Expo Go (phone):** install Expo Go, scan the QR code printed by `npm start`.
  Phone and laptop must be on the same Wi-Fi. Everything in this app runs in
  Expo Go (maps, WebView, pickers, location, secure store).
- **Android Emulator:** start an AVD in Android Studio, then `npm run android`.
  Use `10.0.2.2` in `.env`.
- **Development build** (only needed later for a store build or custom native
  code): `npx expo prebuild --platform android && npx expo run:android`.
  Set `GOOGLE_MAPS_ANDROID_API_KEY` in the environment first — `react-native-maps`
  needs a Google Maps key outside Expo Go (`app.config.ts` reads it). Release
  builds also need https or the `expo-build-properties` plugin with
  `android.usesCleartextTraffic` for plain-http LAN access.

## 6. Verify

```powershell
npm run typecheck        # tsc --noEmit (strict)
npm test                 # jest-expo: services, utils, bridge, UI components
npm run export:android   # bundles the Android JS with Metro (proves the app builds)
npx expo-doctor          # dependency / config sanity
```

Manual checklist (with the backend running and the "40 ft RGB Site" survey loaded):

1. Home shows the field, 66 / 32.2 / 1.7 % health, the latest survey and the top attention zones.
2. Fields → field → "View analysis" lists 23 zones sorted by priority; "View on map" focuses one.
3. Map: field outline, coloured zones, photo map tiles (`/tiles/<survey>/orthomosaic/{z}/{x}/{y}.webp` from the web app), layer panel, fit-to-field, my location.
4. Survey → "View drone images": grid of thumbnails, fullscreen with pinch zoom, metadata, "View on map".
5. Survey → Digital Twin: the Cesium viewer loads in the WebView; mode chips switch Field Map / 3D Twin / Photorealistic; tapping a zone in Cesium shows it below.
6. Ask AI: a question returns an answer labelled with its responder (local Ollama model or template summary).
7. Upload: create field/survey, pick a few JPGs, upload, watch processing steps on the survey page.
8. Stop the backend → screens show "Cannot connect to AgroTwin" with Retry and a link to Settings.
9. Settings → change the server address → Test connection.

## 7. Troubleshooting the LAN connection

| Symptom | Fix |
|---------|-----|
| "Cannot connect to AgroTwin" on the phone, works in the laptop browser | backend bound to 127.0.0.1 → start uvicorn with `--host 0.0.0.0`; check the firewall rule; confirm same Wi-Fi (guest networks often isolate clients) |
| Works on emulator, not on phone | `.env` still says `10.0.2.2` or `localhost` → use the LAN IP, restart `expo start` |
| Map shows no photo map | tile pyramid not built for that survey (`backend/scripts/build_tiles.py`) or `EXPO_PUBLIC_WEB_VIEWER_URL` wrong — tiles are served by the Next.js app on :3000 |
| Digital Twin stays on "Loading…" | web app not reachable on :3000 from the phone; open `http://<LAN IP>:3000` in the phone browser to check |
| Digital Twin closes with a memory message | Android killed the WebView's renderer (large splats); retry with fewer layers |
| Thumbnails never load | thumbnails come from :8000 (`/api/surveys/{id}/images/{img}/thumbnail`) — same fix as the first row |
| Expo Go can't connect to Metro | laptop firewall blocking 8081, or use `npm run tunnel` |

## 8. What runs where

| Concern | Runs on |
|---------|---------|
| Orthomosaics, NDVI/ExG analysis, detection zones, COLMAP/Gaussian splats, tiling | **backend (Python, GPU)** — unchanged |
| Cesium 3D Digital Twin | **web app**, shown in the mobile WebView |
| Field map (react-native-maps), farmer UI, uploads of small batches | **phone** |

The phone never computes indices, never trains models, never downloads a
GeoTIFF: rasters arrive as XYZ tiles built by `build_tiles.py`, images as
backend-rendered thumbnails.
