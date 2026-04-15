# MindPulse Mobile

<p align="center">
  <img src="https://img.shields.io/badge/Expo-SDK%2054-000000?style=for-the-badge&logo=expo&logoColor=white" alt="Expo SDK 54" />
  <img src="https://img.shields.io/badge/React%20Native-0.81-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native 0.81" />
  <img src="https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/HuggingFace-RF%20Inference-FFCC4D?style=for-the-badge&logo=huggingface&logoColor=000" alt="Hugging Face" />
</p>

MindPulse is a React Native (Expo) mobile app that connects to an ESP32 wearable prototype over BLE, buffers biometric data in 60-second windows, runs stress inference through a Supabase Edge Function + Hugging Face model, and shows insights/interventions in-app.

<p align="center">
  <img src="docs/ui-ux/mindpulse-uiux-showcase.png" alt="MindPulse UI showcase" width="100%" />
</p>

## Features

- BLE connection to ESP32 prototype (`react-native-ble-plx`)
- Live metrics on dashboard (heart rate, skin temperature, EDA proxy)
- 60-second stress detection workflow (RF model inference via Hugging Face)
- Supabase Auth + Postgres persistence for biometric windows and predictions
- Environmental context (location, weather, air quality)
- AI coaching via OpenRouter Edge Function
- Insights timeline/charts + intervention tracking

## Architecture (Current)

1. ESP32 sends BLE primary stream (CSV) + higher-rate PPG stream (binary characteristic).
2. App parses/normalizes readings, buffers a rolling 60s window.
3. App calls Supabase Edge Function `hf-stress-predict`.
4. Edge Function validates auth, forwards arrays to Hugging Face Space API.
5. Prediction is stored in Supabase (`biometric_windows`, `predictions_log`) and rendered in UI.

Architecture diagrams: [docs/architecture/README.md](docs/architecture/README.md)

## Repository Layout

```text
mindpulsemobile/
|-- src/
|   |-- screens/
|   |-- contexts/
|   |-- services/
|   |-- hooks/
|   `-- utils/
|-- hardware/
|   `-- mindpulse_esp32/
|       `-- mindpulse_esp32.ino
|-- huggingface/
|   `-- model-space/
|       |-- app.py
|       `-- requirements.txt
|-- supabase/
|   |-- schema.sql
|   `-- functions/
|       |-- hf-stress-predict/
|       `-- openrouter-insight/
`-- docs/
```

## Prerequisites

- Node.js 18+
- npm
- Expo tooling (`npx expo ...`)
- EAS CLI (`npm i -g eas-cli`) for APK/Dev Client builds
- Supabase project
- Hugging Face Space (Gradio API) for stress model inference
- ESP32 hardware + sensors

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure `.env`

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
EXPO_PUBLIC_SUPABASE_REDIRECT_URL=mindpulse://reset

# Optional BLE overrides
EXPO_PUBLIC_BLE_DEVICE_NAME=MindPulse_Watch
EXPO_PUBLIC_BLE_SERVICE_UUID=4fafc201-1fb5-459e-8fcc-c5c9c331914b
EXPO_PUBLIC_BLE_CHARACTERISTIC_UUID=beb5483e-36e1-4688-b7f5-ea07361b26a8
EXPO_PUBLIC_BLE_PPG_CHARACTERISTIC_UUID=d4f9b2d0-7d4a-4f8f-9c79-8b3e25f7c801

# Optional app-side prediction timeout (ms)
EXPO_PUBLIC_STRESS_REQUEST_TIMEOUT_MS=120000
```

### 3. Start app

```bash
npm run start
```

### 4. BLE note: Expo Go is not enough

Because this app uses native BLE modules, use a Development Client or APK:

```bash
eas build --profile development --platform android
```

For shareable test APK:

```bash
eas build --profile preview --platform android
```

## Supabase Setup

### 1. Run schema

Execute [supabase/schema.sql](supabase/schema.sql) in Supabase SQL Editor.

### 2. Deploy Edge Functions

```bash
supabase functions deploy hf-stress-predict
supabase functions deploy openrouter-insight
```

### 3. Set Edge Function secrets

#### `hf-stress-predict`

```bash
supabase secrets set HF_RF_SPACE_URL=https://YOUR_SPACE.hf.space
supabase secrets set HF_REQUEST_TIMEOUT_MS=120000
```

#### `openrouter-insight`

```bash
supabase secrets set OPENROUTER_API_KEY=YOUR_KEY
supabase secrets set OPENROUTER_MODEL=stepfun/step-3.5-flash:free
supabase secrets set OPENROUTER_FALLBACK_MODEL=openrouter/free
supabase secrets set OPENROUTER_REFERER=https://mindpulse.app/
supabase secrets set OPENROUTER_TITLE=MindPulse
supabase secrets set OPENROUTER_TIMEOUT_MS=30000
supabase secrets set OPENROUTER_RETRY_BASE_MS=800
supabase secrets set OPENROUTER_RETRY_COUNT=1
```

## ESP32 Firmware

Firmware path: [hardware/mindpulse_esp32/mindpulse_esp32.ino](hardware/mindpulse_esp32/mindpulse_esp32.ino)

Current BLE contract:

- Service UUID: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- Primary characteristic (CSV): `beb5483e-36e1-4688-b7f5-ea07361b26a8`
- PPG characteristic (binary): `d4f9b2d0-7d4a-4f8f-9c79-8b3e25f7c801`

Primary payload order:

`accX,accY,accZ,tempC,beatAvg,irValue,edaValue`

## Hugging Face Model Space

Model Space code is in [huggingface/model-space/app.py](huggingface/model-space/app.py).

The app enforces a strict RF feature contract (`mindpulse-rf-17f-v1`) so deployment fails fast if the uploaded model bundle has incompatible `feature_columns` order.

## Scripts

| Command | Description |
| --- | --- |
| `npm run start` | Start Expo dev server |
| `npm run android` | Run Android locally (`expo run:android`) |
| `npm run ios` | Run iOS locally (`expo run:ios`) |
| `npm run web` | Start web target |
| `npm run export:architecture` | Export architecture diagrams |
| `npm run export:uiux` | Export UI/UX showcase |

## Troubleshooting

### `BLE data format error: payload appears truncated...`

- Reconnect device (MTU negotiation happens on new connection).
- Restart Metro cache: `npx expo start -c`.
- Ensure ESP32 is sending full 7-field payload and app UUIDs match firmware.

### `Need at least 60s of BLE data before detection`

- Keep watch connected continuously for at least 60 seconds.
- Confirm live metrics update first (not `-`).

### Skin temperature shows `-` or `0`

- App now accepts only plausible skin-temp range (20-45 C).
- Invalid units/noisy values are normalized or discarded to avoid bad inference/storage.

### Stress prediction timeout

- Increase `EXPO_PUBLIC_STRESS_REQUEST_TIMEOUT_MS` and `HF_REQUEST_TIMEOUT_MS`.
- Check Hugging Face Space health and latency.

## Documentation

- [ARCHITECTURE_DIAGRAMS.md](ARCHITECTURE_DIAGRAMS.md)
- [DATABASE_README.md](DATABASE_README.md)
- [SCHEMA_GUIDE.md](SCHEMA_GUIDE.md)
- [IMPLEMENTATION.md](IMPLEMENTATION.md)
- [INTEGRATION_EXAMPLES.md](INTEGRATION_EXAMPLES.md)
- [UI_UX_DESIGN.md](UI_UX_DESIGN.md)

## Security Notes

- Do not commit real keys in `.env`.
- Keep provider secrets in Supabase Edge Function secrets only.
- If any keys were exposed, rotate them immediately.

## Disclaimer

MindPulse is a prototype/research project and not a medical device.
