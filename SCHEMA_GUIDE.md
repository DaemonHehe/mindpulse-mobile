/**
 * MINDPULSE DATABASE INTEGRATION GUIDE
 * 
 * This document covers:
 * 1. Complete schema overview and data flow
 * 2. TypeScript type definitions
 * 3. Database service functions
 * 4. Supabase integration with auth
 * 5. Best practices and validation
 */

// ============================================
// 1. DATA FLOW ARCHITECTURE
// ============================================

/*
COMPLETE DATA FLOW (End-to-End Process):

1. USER REGISTRATION
   ├─ React Native UI: User enters email/password
   ├─ Calls: authService.signUp(email, password)
   ├─ Supabase Creates: Auth user record (Supabase managed)
   ├─ DB Creates: users table row + user_settings row
   └─ App Ready: User can now stream biometric data

2. BIOMETRIC COLLECTION (Watch ↔ Phone)
   ├─ Watch: Streams raw 64Hz Bluetooth data (accelerometer, HR, temp, EDA)
   ├─ React Native: Aggregates into 1-minute windows
   │  └─ Features extracted:
   │     ├─ hr_mean: Average heart rate (bpm)
   │     ├─ hrv_sdnn: Heart rate variability (ms)
   │     ├─ temp_mean: Average skin temp (°C)
   │     └─ eda_peaks: Sweat gland response count
   ├─ Calls: db.insertBiometricWindow(biometricData)
   └─ Supabase Stores: biometric_windows row

3. ML INFERENCE & PREDICTIONS
   ├─ Backend (Python): Polls latest biometric_windows
   ├─ ML Engine: Runs dual models
   │  ├─ Random Forest: Outputs rf_confidence (0-1)
   │  └─ LSTM: Outputs lstm_confidence (0-1)
   ├─ Fusion: Combine scores → fused_score
   ├─ Classification: Fused score → "Stressed" or "Relaxed"
   ├─ DB Stores: predictions_log row
   ├─ IF stressed→ Sends: TRIGGER_UI command to React Native
   └─ Result: Stress Insights chart updated on dashboard

4. INTERVENTION TRIGGER & LOGGING
   ├─ AUTOMATIC: Backend detects stress, sends TRIGGER_UI
   │  ├─ React Native: Shows Box Breathing UI
   │  └─ User: Completes breathing exercise
   │
   ├─ MANUAL: User presses "Start Breathing" button
   │  ├─ React Native: Shows Box Breathing UI
   │  └─ User: Completes breathing exercise
   │
   ├─ On Completion: React Native sends intervention payload
   ├─ Calls: db.insertIntervention({
   │    user_id,
   │    prediction_id,        // null if manual
   │    started_at,
   │    completed_secs,
   │    trigger_type,         // "Automatic" or "Manual"
   │    user_feedback: null   // Will be set later
   │  })
   │
   └─ Post-Exercise: User rates feedback
      ├─ Options: "Better", "Same", "Worse"
      ├─ Calls: db.updateIntervention(interventionId, { user_feedback })
      └─ Analytics: Tracks effectiveness of interventions

5. DASHBOARD ANALYTICS
   ├─ Queries:
   │  ├─ db.getStressStats(userId, days=7)
   │  ├─ db.getInterventionStats(userId, days=7)
   │  ├─ db.getPredictionsInRange(userId, startTime, endTime)
   │  └─ db.getRecentInterventions(userId, limit=10)
   │
   └─ Renders:
      ├─ Stress Insights Chart (7-day trend)
      ├─ Intervention Count Card
      ├─ Avg Intervention Duration
      └─ Feedback Summary


// ============================================
// 2. DATABASE SCHEMA VALIDATION
// ============================================

USERS TABLE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Purpose: Core identity and personalization baselines
PK: id (UUID, auto-generated)
Unique: email
Row-Level Security: Users can only see their own data

Columns:
├─ id: UUID (PK)
│  └─ Default: uuid_generate_v4()
│
├─ email: VARCHAR(255) (UNIQUE, NOT NULL)
│  └─ Indexed by Supabase Auth
│
├─ full_name: TEXT (nullable)
│  └─ Synced from Supabase Auth user metadata
│     Used by the mobile profile screen
│
├─ baseline_hr_bpm: INTEGER (NULLABLE)
│  └─ Updated after 1 week of data collection
│     Used by ML to normalize stress predictions
│
├─ baseline_temp_c: DECIMAL(4,2) (NULLABLE)
│  └─ User's resting skin temperature baseline
│     Helps identify thermal stress
│
└─ created_at, updated_at: TIMESTAMP
   └─ Auto-managed with trigger function


USER_SETTINGS TABLE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Purpose: Lightweight user preferences (separate for query performance)
PK: user_id (FK to users.id)
Row-Level Security: Users can only see/modify their own

Columns:
├─ user_id: UUID (PK, FK)
│  └─ FK Constraint: CASCADE on delete
│
├─ push_notifications: BOOLEAN (DEFAULT true)
│  └─ Allow app to send stress alert notifications
│
├─ breathing_duration: INTEGER (DEFAULT 60)
│  └─ Preferred Box Breathing duration in seconds
│     Range: typically 60-300s
│
├─ haptic_feedback: BOOLEAN (DEFAULT true)
│  └─ Vibrate watch/phone during breathing
│
└─ created_at, updated_at: TIMESTAMP


BIOMETRIC_WINDOWS TABLE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Purpose: 1-minute aggregated sensor data (ML feature vector storage)
PK: id (BIGSERIAL, auto-increment)
FK: user_id (indexes for fast queries)
Row-Level Security: Users can only see their own data

Columns:
├─ id: BIGSERIAL (PK)
│  └─ Auto-incrementing for sequence
│
├─ user_id: UUID (FK, INDEXED)
│  └─ Composite index: (user_id, timestamp desc)
│
├─ timestamp: TIMESTAMP (INDEXED)
│  └─ Exact minute this data represents
│     (e.g., 2024-03-14 14:30:00)
│
├─ hr_mean: DECIMAL(5,2) (NOT NULL)
│  └─ Average heart rate in BPM
│     Range: 40-200 typical
│
├─ hrv_sdnn: DECIMAL(6,2) (NOT NULL)
│  └─ Standard Deviation of NN intervals (ms)
│     Range: 0-500 typical
│     High HRV = relaxed, Low HRV = stressed
│
├─ temp_mean: DECIMAL(4,2) (NOT NULL)
│  └─ Average skin temperature in Celsius
│     Range: 30-40°C typical
│
├─ eda_peaks: INTEGER (NOT NULL)
│  └─ Electrodermal Activity: sweat gland responses
│     Range: 0-50 per minute
│     High peaks = high arousal/stress
│
└─ created_at: TIMESTAMP


PREDICTIONS_LOG TABLE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Purpose: Dual-engine ML output (Random Forest + LSTM fusion)
PK: id (BIGSERIAL)
FKs: user_id, window_id
Row-Level Security: Users can only see their own predictions

Columns:
├─ id: BIGSERIAL (PK)
│
├─ user_id: UUID (FK, INDEXED)
│  └─ For fast user-specific prediction queries
│
├─ window_id: BIGINT (FK, INDEXED)
│  └─ Links to biometric_windows.id
│
├─ rf_confidence: DECIMAL(3,2) (NOT NULL)
│  └─ Random Forest stress probability
│     Range: 0.00-1.00
│
├─ lstm_confidence: DECIMAL(3,2) (NOT NULL)
│  └─ LSTM stress probability
│     Range: 0.00-1.00
│
├─ fused_score: DECIMAL(3,2) (NOT NULL)
│  └─ Weighted average or ensemble score
│     Range: 0.00-1.00
│     Calculation: e.g., (rf * 0.4 + lstm * 0.6)
│
├─ final_state: VARCHAR(20) (NOT NULL)
│  └─ CHECK constraint: 'Stressed' or 'Relaxed'
│     Determined by threshold on fused_score
│     (e.g., fused_score > 0.5 → 'Stressed')
│
└─ created_at: TIMESTAMP (INDEXED for analytics)


INTERVENTIONS TABLE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Purpose: Log breathing exercises for effectiveness tracking
PK: id (BIGSERIAL)
FKs: user_id, prediction_id (nullable)
Row-Level Security: Users can see/insert/update their own only

Columns:
├─ id: BIGSERIAL (PK)
│
├─ user_id: UUID (FK, INDEXED)
│  └─ For user-specific intervention queries
│
├─ prediction_id: BIGINT (FK, NULLABLE)
│  └─ FK to predictions_log.id
│     NULL if trigger_type='Manual'
│     Set to prediction that triggered automatic intervention
│
├─ started_at: TIMESTAMP (NOT NULL, INDEXED)
│  └─ When breathing exercise began
│
├─ completed_secs: INTEGER (NOT NULL)
│  └─ How long user actually breathed (in seconds)
│     May be less than breathing_duration if user exited early
│
├─ trigger_type: VARCHAR(20) (NOT NULL)
│  └─ CHECK constraint: 'Automatic' or 'Manual'
│     Automatic: Backend AI detected stress
│     Manual: User pressed "Start Breathing" button
│
├─ user_feedback: VARCHAR(20) (NULLABLE)
│  └─ CHECK constraint: 'Better', 'Same', 'Worse', or NULL
│     Filled in after user completes breathing + rates experience
│     Used to validate AI effectiveness and refine predictions
│
└─ created_at: TIMESTAMP


// ============================================
// 3. TYPE DEFINITIONS (TypeScript)
// ============================================

Location: src/types/database.ts

All types are exported with Insert/Update variants:
- User, UserInsert, UserUpdate
- UserSettings, UserSettingsInsert, UserSettingsUpdate
- BiometricWindow, BiometricWindowInsert
- PredictionLog, PredictionLogInsert
- Intervention, InterventionInsert, InterventionUpdate

Composite types for complex queries:
- UserProfile: User + UserSettings
- BiometricWithPrediction: BiometricWindow + prediction
- InterventionWithContext: Intervention + related data
- UserAnalyticsSummary: Aggregated stats


// ============================================
// 4. DATABASE SERVICE FUNCTIONS (TypeScript)
// ============================================

Location: src/services/db.ts

USAGE PATTERN:
```typescript
import { db } from '@/services/db';

// Query
const user = await db.getUser(userId);

// Insert
const window = await db.insertBiometricWindow({
  user_id: userId,
  timestamp: new Date().toISOString(),
  hr_mean: 72,
  hrv_sdnn: 45,
  temp_mean: 32.5,
  eda_peaks: 8,
});

// Update
await db.updateUser(userId, { baseline_hr_bpm: 65 });

// Batch/Analytics
const stats = await db.getStressStats(userId, 7);
const interventions = await db.getRecentInterventions(userId, 10);
```

CORE OPERATIONS:

Users:
  ├─ getUser(userId)
  ├─ getUserByEmail(email)
  ├─ createUser(data)
  ├─ updateUser(userId, updates)
  └─ updateUserBaselines(userId, hr, temp)

Settings:
  ├─ getUserSettings(userId)
  ├─ createUserSettings(userId)
  └─ updateUserSettings(userId, updates)

Biometrics:
  ├─ insertBiometricWindow(data)
  ├─ getLatestBiometricWindow(userId)
  └─ getBiometricWindowsInRange(userId, start, end)

Predictions:
  ├─ insertPrediction(data)
  ├─ getLatestPrediction(userId)
  ├─ getPredictionsInRange(userId, start, end)
  └─ getStressStats(userId, days)

Interventions:
  ├─ insertIntervention(data)
  ├─ updateIntervention(id, updates)
  ├─ getRecentInterventions(userId, limit)
  └─ getInterventionStats(userId, days)

Composite:
  ├─ getUserProfile(userId) → User + Settings
  ├─ getInterventionWithContext(id) → Intervention + Prediction
  └─ deleteUser(userId) → CASCADE delete all related data


// ============================================
// 5. SUPABASE INTEGRATION & AUTH
// ============================================

Location: src/services/supabase.js

EXPORTS:
- supabase: Raw Supabase client
- authService: MindPulse auth wrapper

AUTH FLOW:

1. SignUp:
   ```javascript
   const { session, error } = await authService.signUp(email, password);
   // Automatically creates users + user_settings rows
   ```

2. SignIn:
   ```javascript
   const { session, error } = await authService.signIn(email, password);
   ```

3. SignOut:
   ```javascript
   const { error } = await authService.signOut();
   ```

4. Password Reset:
   ```javascript
   const { error } = await authService.resetPassword(email);
   // Sends reset email
   ```

5. Auth State Listener:
   ```javascript
   const unsubscribe = authService.onAuthStateChange((session) => {
     if (session) console.log('User logged in');
     else console.log('User logged out');
   });
   ```


// ============================================
// 6. ROW-LEVEL SECURITY (RLS) OVERVIEW
// ============================================

All tables have RLS enabled with enforcement:

users:
  ├─ SELECT: auth.uid() = id
  └─ UPDATE: auth.uid() = id

user_settings:
  ├─ SELECT: auth.uid() = user_id
  └─ UPDATE: auth.uid() = user_id

biometric_windows:
  ├─ SELECT: auth.uid() = user_id
  └─ INSERT: auth.uid() = user_id

predictions_log:
  └─ SELECT: auth.uid() = user_id

interventions:
  ├─ SELECT: auth.uid() = user_id
  ├─ INSERT: auth.uid() = user_id
  └─ UPDATE: auth.uid() = user_id

KEY BENEFIT: Users cannot access data from other users, even with leaked session tokens.


// ============================================
// 7. BEST PRACTICES & VALIDATION CHECKLIST
// ============================================

SCHEMA VALIDATION:
✅ All tables created with IF NOT EXISTS (safe re-runs)
✅ UUIDs for user IDs (not sequential)
✅ BIGSERIAL for high-volume tables (500K+ interventions)
✅ DECIMAL for precision measurements (not FLOAT)
✅ CHECK constraints for enums (Stressed/Relaxed, etc)
✅ Foreign key cascades for referential integrity
✅ Composite indexes for common query patterns
✅ RLS policies prevent cross-user data access
✅ Trigger functions auto-manage timestamps

INDEXING:
✅ user_id indexed on all tables (fast filtering)
✅ Composite index (user_id, timestamp desc) for time-series queries
✅ created_at indexed on prediction logs (7-day analytics)

DATA TYPES:
✅ DECIMAL(5,2) for HR mean (40-199.99 bpm)
✅ DECIMAL(6,2) for HRV (0-999.99 ms)
✅ DECIMAL(4,2) for temperature (0-99.99°C)
✅ INTEGER for EDA peaks (0-65535 per minute)
✅ DECIMAL(3,2) for ML confidence (0.00-0.99 = 0-99%)

PERFORMANCE CONSIDERATIONS:
⚠️ biometric_windows grows ~1440 rows/user/day
   └─ Set retention policy (e.g., delete after 90 days raw data)
   
⚠️ predictions_log similar growth
   └─ Typically smaller, keep longer for analytics

✅ Use getBiometricWindowsInRange for date filters (uses indexes)
✅ Batch insert biometric windows if possible
✅ Archive old data to separate analytics table


// ============================================
// 8. MIGRATION NOTES FOR DEPLOYMENT
// ============================================

1. FIRST DEPLOYMENT:
   - Run schema.sql in Supabase SQL Editor
   - Verify tables created: SELECT * FROM information_schema.tables
   - Enable RLS: Already in schema.sql

2. ENVIRONMENT SETUP:
   Add to .env.local:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxx
   EXPO_PUBLIC_SUPABASE_REDIRECT_URL=exp://localhost:8081
   ```

3. TEST FLOW:
   ```typescript
   import { authService } from '@/services/supabase';
   import { db } from '@/services/db';
   
   // Test signup
   const { session } = await authService.signUp('test@example.com', 'password');
   
   // Test db operations
   const user = await db.getUser(session.user.id);
   const settings = await db.getUserSettings(session.user.id);
   ```

4. OPTIONAL ENHANCEMENTS:
   - Add view for aggregated daily stats
   - Add stored procedure for ML batch predictions
   - Add soft-delete columns for GDPR compliance
   - Add data retention policies
   - Add backup schedule


// ============================================
// 9. SCHEMA DIAGRAM (ASCII)
// ============================================

┌─────────────────┐
│     AUTH        │ (Supabase managed)
│   users.id      │
└────────┬────────┘
         │
         ├──────────────────────────────────┐
         │                                  │
         ▼                                  ▼
    ┌─────────────┐              ┌──────────────────┐
    │   USERS      │              │  USER_SETTINGS   │
    ├─────────────┤              ├──────────────────┤
    │PK: id (UUID)│◄─────FK──────┤PK: user_id (UUID)│
    │ + email     │              │ settings...      │
    │ + baselines │              └──────────────────┘
    └────────┬────┘
             │
             │
             ├─────────────────────────┐
             │                         │
             ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │BIOMETRIC_WINDOWS │      │ PREDICTIONS_LOG  │
    ├──────────────────┤      ├──────────────────┤
    │PK: id            │      │PK: id            │
    │FK: user_id ◄─────┼──────┤FK: user_id       │
    │ timestamp (IND)  │      │FK: window_id ────┼──┐
    │ hr_mean, etc     │      │ rf_conf, etc     │  │
    └──────────────────┘      └──────┬───────────┘  │
                                     │              │
                                     └──────────────┘
             │
             ▼
    ┌──────────────────┐
    │  INTERVENTIONS   │
    ├──────────────────┤
    │PK: id            │
    │FK: user_id       │
    │FK: prediction_id │ (optional)
    │ user_feedback    │
    └──────────────────┘


// ============================================
// 10. QUICK REFERENCE: COMMON QUERIES
// ============================================

# Today's stress level
SELECT final_state, COUNT(*) as count
FROM predictions_log
WHERE user_id = $userId AND date(created_at) = TODAY
GROUP BY final_state;

# Average heart rate trend (last 7 days)
SELECT DATE(timestamp), AVG(hr_mean) as avg_hr
FROM biometric_windows
WHERE user_id = $userId AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY DATE(timestamp)
ORDER BY DATE(timestamp);

# Intervention effectiveness (did breathing help?)
SELECT
  CASE WHEN user_feedback = 'Better' THEN 'Helped'
       WHEN user_feedback = 'Worse' THEN 'Worsened'
       ELSE 'No Change'
  END as effectiveness,
  COUNT(*) as count
FROM interventions
WHERE user_id = $userId AND DATE(started_at) > NOW() - INTERVAL '30 days'
GROUP BY effectiveness;

# Top prediction confidence times (high stress moments)
SELECT timestamp, fused_score, final_state
FROM predictions_log
WHERE user_id = $userId
ORDER BY fused_score DESC
LIMIT 10;
