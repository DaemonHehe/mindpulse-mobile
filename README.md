# MindPulse Mobile

**Overview**  
MindPulse is a minimalist Expo React Native app focused on stress awareness and recovery. It blends wearable-style metrics, environmental context, and a lightweight LLM insight to deliver clear, calm guidance in a Nothing-inspired UI.

**Key Features**
1. Dashboard with live stress state, metrics, and a Siri-style LLM insight bubble.
2. Insights page with weekly chart, event history, and environment context.
3. Environmental context from Open‑Meteo weather and CAMS air quality.
4. Map view (Leaflet inside WebView) with theme-aware tiles.
5. Box breathing intervention flow.
6. Theme system with System, Light, and Dark modes.

**Tech Stack**
1. Expo SDK 54 (React Native 0.81.x)
2. React Navigation
3. React Native Reanimated
4. Leaflet in WebView
5. OpenRouter (LLM) + Open‑Meteo / CAMS (environment)

**Getting Started**
1. Install dependencies  
   `npm install`
2. Start the app  
   `npx expo start`
3. Scan the QR with Expo Go (SDK 54 compatible)

**Environment Variables**
Create `.env` in the project root (already in `.gitignore`):
```
EXPO_PUBLIC_OPENROUTER_API_KEY=YOUR_KEY
EXPO_PUBLIC_OPENROUTER_MODEL=openrouter/free
EXPO_PUBLIC_OPENROUTER_REFERER=https://mindpulse.app
EXPO_PUBLIC_OPENROUTER_TITLE=MindPulse
```

**Notes**
1. `EXPO_PUBLIC_*` variables are embedded in the client bundle. Use a server proxy for production secrets.
2. Location permission is required for environmental context.
3. Map tiles are fetched from OpenStreetMap (light) and CARTO (dark).

**Project Structure**
1. `src/screens` — App screens
2. `src/components` — App-specific UI components
3. `components/ui` — Shared UI kit (BNA UI components)
4. `src/services` — API clients and environment/LLM logic
5. `src/constants` — Theme, layout, typography tokens
