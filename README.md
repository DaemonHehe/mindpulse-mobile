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
EXPO_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
EXPO_PUBLIC_SUPABASE_REDIRECT_URL=YOUR_PASSWORD_RESET_REDIRECT_URL
```

**Notes**
1. `EXPO_PUBLIC_*` variables are embedded in the client bundle. Use a server proxy for production secrets.
2. Location permission is required for environmental context.
3. Map tiles are fetched from OpenStreetMap (light) and CARTO (dark).

**Supabase Setup**
1. Create a Supabase project and copy the project URL + anon key into `.env`.
2. Run the SQL in `supabase/schema.sql` to create the `users`, `user_settings`, and related analytics tables with RLS policies.
3. For password reset in mobile, set `EXPO_PUBLIC_SUPABASE_REDIRECT_URL` to your app scheme (for example: `mindpulse://reset`) and add the matching scheme in `app.json`.
4. Deploy the Edge Function in `supabase/functions/openrouter-insight` and store the OpenRouter secret in Supabase, not in `EXPO_PUBLIC_*`.

**Edge Function Setup**
1. Set secrets for the function:
   `supabase secrets set OPENROUTER_API_KEY=YOUR_KEY OPENROUTER_MODEL=stepfun/step-3.5-flash:free OPENROUTER_REFERER=https://mindpulse.app/ OPENROUTER_TITLE=MindPulse OPENROUTER_TIMEOUT_MS=60000 OPENROUTER_RETRY_BASE_MS=800 OPENROUTER_RETRY_COUNT=2`
2. Deploy the function:
   `supabase functions deploy openrouter-insight`
3. For local function testing, copy `supabase/functions/.env.example` to `supabase/functions/.env` and run:
   `supabase functions serve openrouter-insight --env-file supabase/functions/.env`

**Project Structure**
1. `src/screens` — App screens
2. `src/components` — App-specific UI components
3. `components/ui` — Shared UI kit (BNA UI components)
4. `src/services` — API clients and environment/LLM logic
5. `src/constants` — Theme, layout, typography tokens
