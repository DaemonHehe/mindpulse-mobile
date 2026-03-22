/**
 * TypeScript type definitions for MindPulse database schema
 * Auto-generated from schema.sql - Keep in sync with DB structure
 */

// ============================================
// USERS - Core identity table
// ============================================
export interface User {
  id: string; // UUID
  email: string | null;
  full_name: string | null;
  created_at: string; // Timestamp ISO 8601
  baseline_hr_bpm: number | null;
  baseline_temp_c: number | null;
  updated_at: string;
}

export type UserInsert = Omit<User, 'created_at' | 'updated_at'>;
export type UserUpdate = Partial<Omit<User, 'id' | 'created_at'>>;

// ============================================
// USER_SETTINGS - Lightweight settings
// ============================================
export interface UserSettings {
  user_id: string; // UUID, FK to users
  push_notifications: boolean;
  breathing_duration: number; // seconds
  haptic_feedback: boolean;
  created_at: string;
  updated_at: string;
}

export type UserSettingsInsert = Omit<UserSettings, 'created_at' | 'updated_at'>;
export type UserSettingsUpdate = Partial<Omit<UserSettings, 'user_id' | 'created_at'>>;

// ============================================
// BIOMETRIC_WINDOWS - 1-minute aggregations
// ============================================
export interface BiometricWindow {
  id: number; // BIGSERIAL
  user_id: string; // UUID, FK to users
  timestamp: string; // Timestamp ISO 8601
  hr_mean: number; // Decimal (5,2) - bpm
  hrv_sdnn: number; // Decimal (6,2) - HRV metric
  temp_mean: number; // Decimal (4,2) - Celsius
  eda_peaks: number; // Integer - sweat gland responses
  created_at: string;
}

export type BiometricWindowInsert = Omit<BiometricWindow, 'id' | 'created_at'>;

// ============================================
// PREDICTIONS_LOG - ML output analytics
// ============================================
export type StressState = 'Stressed' | 'Relaxed';

export interface PredictionLog {
  id: number; // BIGSERIAL
  user_id: string; // UUID, FK to users
  window_id: number; // BIGINT, FK to biometric_windows
  rf_confidence: number; // Decimal (3,2) - 0-1 probability
  lstm_confidence: number; // Decimal (3,2) - 0-1 probability
  fused_score: number; // Decimal (3,2) - final score
  final_state: StressState;
  created_at: string;
}

export type PredictionLogInsert = Omit<PredictionLog, 'id' | 'created_at'>;

// ============================================
// INTERVENTIONS - Breathing exercise events
// ============================================
export type TriggerType = 'Automatic' | 'Manual';
export type UserFeedback = 'Better' | 'Same' | 'Worse' | null;

export interface Intervention {
  id: number; // BIGSERIAL
  user_id: string; // UUID, FK to users
  prediction_id: number | null; // BIGINT, FK to predictions_log
  started_at: string; // Timestamp ISO 8601
  completed_secs: number; // Integer - seconds breathed
  trigger_type: TriggerType;
  user_feedback: UserFeedback;
  created_at: string;
}

export type InterventionInsert = Omit<Intervention, 'id' | 'created_at'>;
export type InterventionUpdate = Partial<Omit<Intervention, 'id' | 'user_id' | 'prediction_id' | 'started_at' | 'created_at'>>;

// ============================================
// COMPOSITE TYPES - For complex queries
// ============================================

/**
 * User profile with associated settings
 */
export interface UserProfile extends User {
  user_settings: UserSettings | null;
}

/**
 * Biometric data with prediction context
 */
export interface BiometricWithPrediction extends BiometricWindow {
  prediction: PredictionLog | null;
}

/**
 * Intervention with associated prediction data
 */
export interface InterventionWithContext extends Intervention {
  prediction?: PredictionLog | null;
  biometric_window?: BiometricWindow | null;
}

/**
 * User dashboard analytics snapshot
 */
export interface UserAnalyticsSummary {
  user_id: string;
  total_predictions: number;
  stress_count: number;
  relaxed_count: number;
  avg_fused_score: number;
  total_interventions: number;
  avg_intervention_duration_secs: number;
  feedback_better: number;
  feedback_same: number;
  feedback_worse: number;
}
