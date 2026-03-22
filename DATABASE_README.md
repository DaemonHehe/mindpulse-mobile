# MindPulse Database Implementation

Complete database schema, TypeScript types, and service layer for the MindPulse React Native app.

## 📋 Implementation Summary

This package includes **5 interconnected components**:

### 1. **Database Schema** (`supabase/schema.sql`)
- 5 tables with proper relationships and constraints
- Row-Level Security (RLS) policies for data privacy
- Automatic timestamp management with triggers
- Performance indexes for time-series queries

**Tables:**
- `users` – Core identity and physiological baselines
- `user_settings` – Lightweight user preferences
- `biometric_windows` – 1-minute sensor aggregates (ML features)
- `predictions_log` – Dual-engine ML output (Random Forest + LSTM)
- `interventions` – Breathing exercise events and feedback

### 2. **TypeScript Types** (`src/types/database.ts`)
- Full type safety for all database records
- Insert/Update variants for each table
- Composite types for complex queries
- Strict enums (StressState, TriggerType, UserFeedback)

### 3. **Database Service Layer** (`src/services/db.ts`)
- ~40 CRUD functions with error handling
- Query builders for common analytics patterns
- Type-safe database operations
- Automatic error logging and context

### 4. **Enhanced Supabase Client** (`src/services/supabase.js`)
- Extended with `authService` wrapper
- Automatic user DB initialization on signup
- Auth state listeners
- Password reset integration
- Session management

### 5. **Comprehensive Documentation** (`SCHEMA_GUIDE.md`)
- Architecture overview and data flow
- Complete schema documentation
- Best practices and validation checklist
- Migration deployment guide
- Common query patterns

---

## 🚀 Quick Start

### Step 1: Deploy Schema to Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project → SQL Editor
3. Open `supabase/schema.sql` and copy the entire content
4. Paste into the SQL Editor
5. Click "Run"
6. Verify tables were created in the "Tables" section

### Step 2: Configure Environment Variables

Add to `.env.local` (or `.env.production`):

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_SUPABASE_REDIRECT_URL=exp://localhost:8081
```

### Step 3: Test the Integration

```typescript
import { authService } from '@/services/supabase';
import { db } from '@/services/db';

// Test signup
const { session, error } = await authService.signUp('test@example.com', 'password123');

if (error) {
  console.error('Signup failed:', error);
} else {
  // Verify user was created in DB
  const user = await db.getUser(session.user.id);
  console.log('User created:', user);
  
  // Get user settings
  const settings = await db.getUserSettings(session.user.id);
  console.log('Settings created:', settings);
}
```

---

## 📊 Data Flow Architecture

```
Watch (64Hz Bluetooth) 
    ↓
React Native (Aggregates → 1-minute window)
    ↓
biometric_windows table
    ↓
Python Backend (ML Inference)
    ├─ Random Forest Model → rf_confidence
    ├─ LSTM Model → lstm_confidence
    └─ Fusion Algorithm → fused_score
    ↓
predictions_log table
    ↓
Dashboard (Stress Insights Chart)
    ↓
IF stressed → TRIGGER_UI (Breathing Exercise)
    ↓
interventions table (Log event + user feedback)
```

---

## 🔑 Key Files Reference

| File | Purpose | Usage |
|------|---------|-------|
| `supabase/schema.sql` | Database schema | Run once in Supabase SQL Editor |
| `src/types/database.ts` | TypeScript definitions | Import types for type safety |
| `src/services/db.ts` | Database operations | `await db.getUser(userId)` |
| `src/services/supabase.js` | Auth + client | `authService.signUp(email, pass)` |
| `SCHEMA_GUIDE.md` | Complete documentation | Reference for architecture |

---

## 💻 Common Operations

### User Authentication

```typescript
// Sign up
const { session, error } = await authService.signUp('user@example.com', 'password');

// Sign in
const { session, error } = await authService.signIn('user@example.com', 'password');

// Sign out
const { error } = await authService.signOut();

// Get current user
const user = await authService.getUser();

// Reset password
const { error } = await authService.resetPassword('user@example.com');
```

### Biometric Data

```typescript
// Store 1-minute sensor aggregates
const window = await db.insertBiometricWindow({
  user_id: userId,
  timestamp: new Date().toISOString(),
  hr_mean: 72.5,
  hrv_sdnn: 45.3,
  temp_mean: 32.8,
  eda_peaks: 8,
});

// Retrieve latest window
const latest = await db.getLatestBiometricWindow(userId);

// Get historical data for chart
const history = await db.getBiometricWindowsInRange(
  userId,
  startTime.toISOString(),
  endTime.toISOString()
);
```

### ML Predictions

```typescript
// Log ML model output
const prediction = await db.insertPrediction({
  user_id: userId,
  window_id: biometricWindowId,
  rf_confidence: 0.85,
  lstm_confidence: 0.72,
  fused_score: 0.79,
  final_state: 'Stressed',
});

// Get stress statistics
const stats = await db.getStressStats(userId, 7); // Last 7 days
// Returns: { stress_count, relaxed_count, avg_fused_score }
```

### Breathing Interventions

```typescript
// Log breathing exercise (automatic or manual)
const intervention = await db.insertIntervention({
  user_id: userId,
  prediction_id: stressfulPredictionId, // null if manual
  started_at: new Date().toISOString(),
  completed_secs: 240,
  trigger_type: 'Automatic', // or 'Manual'
  user_feedback: null, // Will update after user rates
});

// Update with user feedback after exercise
await db.updateIntervention(intervention.id, {
  user_feedback: 'Better', // 'Better' | 'Same' | 'Worse'
});

// Get recent interventions
const recent = await db.getRecentInterventions(userId, 10);

// Get intervention stats
const stats = await db.getInterventionStats(userId, 7);
// Returns: { total_interventions, avg_duration_secs, feedback_better, ... }
```

### Dashboard Analytics

```typescript
// Get complete user profile with settings
const profile = await db.getUserProfile(userId);
// Returns: User + UserSettings

// Get intervention with related data
const intervention = await db.getInterventionWithContext(interventionId);
// Returns: Intervention + Prediction + BiometricWindow data

// Fetch predictions for chart
const predictions = await db.getPredictionsInRange(userId, start, end);

// Fetch to render Stress Insights
const stressStats = await db.getStressStats(userId, 7);
const interventionStats = await db.getInterventionStats(userId, 7);
```

---

## 🔒 Security & Privacy

### Row-Level Security (RLS)

All tables have RLS enabled. Users can **only** access their own data:

```sql
-- Example: biometric_windows
CREATE POLICY "Users can view own biometric data"
  ON public.biometric_windows
  FOR SELECT
  USING (auth.uid() = user_id);
```

**Benefits:**
- Prevents data leakage between users
- Works even if auth token is compromised
- Enforced at database level (not application level)

### Best Practices

1. **Always use `db.*` functions** – They handle auth context automatically
2. **Never bypass RLS** – Don't use raw `supabase.from()` queries for user data
3. **Validate on backend** – Don't trust client-side validation
4. **Rotate secrets regularly** – Supabase anon key should have minimal scope

---

## 📈 Performance Optimization

### Indexes

- **user_id indexes** – All tables indexed by user_id for fast filtering
- **Composite index** – `(user_id, timestamp DESC)` for time-series queries
- **created_at index** – Predictions table for 7-day analytics queries

### Query Patterns

```typescript
// ✅ GOOD - Uses indexes
await supabase
  .from('biometric_windows')
  .select('*')
  .eq('user_id', userId)          // Indexed
  .gte('timestamp', startTime)     // Indexed
  .order('timestamp', { ascending: false });

// ❌ PROBLEMATIC - Scans entire table
await supabase
  .from('biometric_windows')
  .select('*')
  .gte('hr_mean', 80);            // Not indexed
```

### Data Retention

On production, implement data retention:

```sql
-- Delete biometric windows older than 90 days
DELETE FROM public.biometric_windows
WHERE timestamp < NOW() - INTERVAL '90 days';

-- Keep predictions longer (useful for analytics)
DELETE FROM public.predictions_log
WHERE created_at < NOW() - INTERVAL '365 days';
```

---

## 🧪 Testing Checklist

- [ ] Schema deployed to Supabase
- [ ] Environment variables configured
- [ ] `authService.signUp()` creates user + settings
- [ ] `db.getUser()` retrieves correct user data
- [ ] `db.insertBiometricWindow()` stores sensor data
- [ ] `db.insertPrediction()` logs ML output
- [ ] `db.insertIntervention()` logs breathing exercises
- [ ] RLS policies prevent cross-user access
- [ ] Type checking passes (no TypeScript errors)
- [ ] Dashboard loads with mock data

---

## 🐛 Troubleshooting

### Issue: "Policy violation" error

**Cause:** RLS policy denying access
**Solution:** Ensure you're authenticated and user_id matches auth.uid()

```typescript
// Get auth user
const user = await authService.getUser();

// Use that user's ID
const data = await db.getUser(user.id);
```

### Issue: "Column not found" error

**Cause:** Schema not deployed
**Solution:** Run `supabase/schema.sql` in Supabase SQL Editor

### Issue: Type errors in TypeScript

**Cause:** Types not imported or mismatched
**Solution:** 
```typescript
import { BiometricWindow } from '@/types/database';

const window: BiometricWindow = await db.getLatestBiometricWindow(userId);
```

### Issue: Auth session lost on app restart

**Solution:** Already handled! `supabase.js` sets up persistent auth with AsyncStorage

---

## 📚 Further Reading

- [Supabase Documentation](https://supabase.com/docs)
- [Row-Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL JSON Functions](https://www.postgresql.org/docs/current/functions-json.html) (for complex analytics)
- `SCHEMA_GUIDE.md` – Complete architecture documentation

---

## 📝 File Structure

```
mindpulsemobile/
├── supabase/
│   └── schema.sql                    # ← Deploy this to Supabase
│
├── src/
│   ├── services/
│   │   ├── supabase.js              # ← Auth client
│   │   └── db.ts                    # ← Database functions
│   │
│   └── types/
│       └── database.ts              # ← TypeScript definitions
│
├── SCHEMA_GUIDE.md                   # ← Complete documentation
└── README.md                         # ← This file
```

---

## ✅ What's Been Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| PostgreSQL schema | ✅ Complete | 5 tables with constraints |
| RLS policies | ✅ Complete | All tables secured |
| Indexes | ✅ Complete | Optimized for common queries |
| TypeScript types | ✅ Complete | Full type safety |
| CRUD functions | ✅ Complete | ~40 database operations |
| Auth integration | ✅ Complete | SignUp, SignIn, SignOut, etc. |
| Error handling | ✅ Complete | Logged with context |
| Documentation | ✅ Complete | Architecture guide + reference |

---

## 🎯 Next Steps

1. **Deploy schema** → `supabase/schema.sql` to Supabase
2. **Configure environment** → Add `.env.local` variables
3. **Test auth flow** → Run signup/signin in app
4. **Integrate biometric collection** → Use `db.insertBiometricWindow()`
5. **Connect ML predictions** → Use `db.insertPrediction()` from backend
6. **Build dashboard** → Use analytics functions for charts
7. **Implement breathing UI** → Log interventions with `db.insertIntervention()`

---

**Questions?** Check `SCHEMA_GUIDE.md` for architecture details or refer to [Supabase docs](https://supabase.com/docs).
