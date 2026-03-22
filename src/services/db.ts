/**
 * Database service functions for MindPulse
 * Handles all CRUD operations with Supabase
 */

import { supabase } from './supabase';
import type {
  User,
  UserInsert,
  UserUpdate,
  UserSettings,
  UserSettingsInsert,
  UserSettingsUpdate,
  BiometricWindow,
  BiometricWindowInsert,
  PredictionLog,
  PredictionLogInsert,
  Intervention,
  InterventionInsert,
  InterventionUpdate,
  UserProfile,
  InterventionWithContext,
  UserAnalyticsSummary,
} from '../types/database';

type DashboardSnapshot = {
  biometricWindow: BiometricWindow | null;
  prediction: PredictionLog | null;
};

/**
 * ERROR HANDLING UTILITIES
 */
const handleSupabaseError = (error: any, context: string) => {
  console.error(`[DB Error - ${context}]`, error);
  throw new Error(`Database error in ${context}: ${error?.message || 'Unknown error'}`);
};

// ============================================
// USERS - User identity and baselines
// ============================================

export const db = {
  /**
   * Ensure the public users/user_settings rows exist for the current auth user
   */
  async ensureUserRecord(userId: string): Promise<void> {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      const { error: userError } = await supabase
        .from('users')
        .upsert(
          {
            id: userId,
            email: authUser?.id === userId ? authUser.email ?? null : null,
            full_name:
              authUser?.id === userId
                ? authUser.user_metadata?.full_name ?? null
                : null,
          },
          { onConflict: 'id' }
        );

      if (userError) throw userError;

      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId }, { onConflict: 'user_id' });

      if (settingsError) {
        console.warn(
          '[DB Warning - ensureUserRecord]',
          settingsError.message
        );
      }
    } catch (error) {
      handleSupabaseError(error, 'ensureUserRecord');
    }
  },

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data;
    } catch (error) {
      handleSupabaseError(error, 'getUser');
    }
  },

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    } catch (error) {
      handleSupabaseError(error, 'getUserByEmail');
    }
  },

  /**
   * Create new user (typically called during registration via Auth service)
   */
  async createUser(user: UserInsert): Promise<User> {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([user])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      handleSupabaseError(error, 'createUser');
    }
  },

  /**
   * Update user (e.g., update baselines after week 1)
   */
  async updateUser(userId: string, updates: UserUpdate): Promise<User> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      handleSupabaseError(error, 'updateUser');
    }
  },

  /**
   * Update user baselines (HR and temperature)
   */
  async updateUserBaselines(
    userId: string,
    baseline_hr_bpm: number,
    baseline_temp_c: number
  ): Promise<User> {
    return this.updateUser(userId, { baseline_hr_bpm, baseline_temp_c });
  },

  // ============================================
  // USER_SETTINGS - User preferences
  // ============================================

  /**
   * Get user settings
   */
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    } catch (error) {
      handleSupabaseError(error, 'getUserSettings');
    }
  },

  /**
   * Create default user settings (called on user registration)
   */
  async createUserSettings(userId: string): Promise<UserSettings> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .insert([{ user_id: userId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      handleSupabaseError(error, 'createUserSettings');
    }
  },

  /**
   * Update user settings
   */
  async updateUserSettings(userId: string, updates: UserSettingsUpdate): Promise<UserSettings> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      handleSupabaseError(error, 'updateUserSettings');
    }
  },

  // ============================================
  // BIOMETRIC_WINDOWS - Raw sensor aggregates
  // ============================================

  /**
   * Store 1-minute biometric window (called by phone after aggregating Bluetooth stream)
   */
  async insertBiometricWindow(data: BiometricWindowInsert): Promise<BiometricWindow> {
    try {
      const { data: result, error } = await supabase
        .from('biometric_windows')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      handleSupabaseError(error, 'insertBiometricWindow');
    }
  },

  /**
   * Get latest biometric window for user
   */
  async getLatestBiometricWindow(userId: string): Promise<BiometricWindow | null> {
    try {
      const { data, error } = await supabase
        .from('biometric_windows')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    } catch (error) {
      handleSupabaseError(error, 'getLatestBiometricWindow');
    }
  },

  /**
   * Get biometric windows in time range (for charts/analytics)
   */
  async getBiometricWindowsInRange(
    userId: string,
    startTime: string,
    endTime: string
  ): Promise<BiometricWindow[]> {
    try {
      const { data, error } = await supabase
        .from('biometric_windows')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', startTime)
        .lte('timestamp', endTime)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'getBiometricWindowsInRange');
    }
  },

  // ============================================
  // PREDICTIONS_LOG - ML model outputs
  // ============================================

  /**
   * Log prediction result (called by backend after ML inference)
   */
  async insertPrediction(data: PredictionLogInsert): Promise<PredictionLog> {
    try {
      const { data: result, error } = await supabase
        .from('predictions_log')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      handleSupabaseError(error, 'insertPrediction');
    }
  },

  /**
   * Get latest prediction for user
   */
  async getLatestPrediction(userId: string): Promise<PredictionLog | null> {
    try {
      const { data, error } = await supabase
        .from('predictions_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    } catch (error) {
      handleSupabaseError(error, 'getLatestPrediction');
    }
  },

  /**
   * Get the latest biometric and prediction records for dashboard hydration
   */
  async getLatestDashboardSnapshot(userId: string): Promise<DashboardSnapshot> {
    try {
      const [biometricWindow, prediction] = await Promise.all([
        this.getLatestBiometricWindow(userId),
        this.getLatestPrediction(userId),
      ]);

      return {
        biometricWindow,
        prediction,
      };
    } catch (error) {
      handleSupabaseError(error, 'getLatestDashboardSnapshot');
    }
  },

  /**
   * Persist a biometric window and its derived prediction together
   */
  async createBiometricSnapshot(
    biometricWindow: BiometricWindowInsert,
    prediction: Omit<PredictionLogInsert, 'window_id'>
  ): Promise<DashboardSnapshot> {
    try {
      await this.ensureUserRecord(biometricWindow.user_id);
      const savedWindow = await this.insertBiometricWindow(biometricWindow);
      const savedPrediction = await this.insertPrediction({
        ...prediction,
        window_id: savedWindow.id,
      });

      return {
        biometricWindow: savedWindow,
        prediction: savedPrediction,
      };
    } catch (error) {
      handleSupabaseError(error, 'createBiometricSnapshot');
    }
  },

  /**
   * Get predictions in time range (for Stress Insights chart)
   */
  async getPredictionsInRange(
    userId: string,
    startTime: string,
    endTime: string
  ): Promise<PredictionLog[]> {
    try {
      const { data, error } = await supabase
        .from('predictions_log')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startTime)
        .lte('created_at', endTime)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'getPredictionsInRange');
    }
  },

  /**
   * Get stress statistics for dashboard
   */
  async getStressStats(userId: string, days: number = 7): Promise<{
    stress_count: number;
    relaxed_count: number;
    avg_fused_score: number;
  }> {
    try {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - days);

      const { data, error } = await supabase
        .from('predictions_log')
        .select('final_state, fused_score')
        .eq('user_id', userId)
        .gte('created_at', startTime.toISOString());

      if (error) throw error;

      const predictions = data || [];
      const stressCount = predictions.filter((p) => p.final_state === 'Stressed').length;
      const relaxedCount = predictions.filter((p) => p.final_state === 'Relaxed').length;
      const avgScore =
        predictions.length > 0
          ? predictions.reduce((sum, p) => sum + p.fused_score, 0) / predictions.length
          : 0;

      return {
        stress_count: stressCount,
        relaxed_count: relaxedCount,
        avg_fused_score: parseFloat(avgScore.toFixed(2)),
      };
    } catch (error) {
      handleSupabaseError(error, 'getStressStats');
    }
  },

  // ============================================
  // INTERVENTIONS - Breathing exercises
  // ============================================

  /**
   * Log intervention event (called when breathing exercise completes)
   */
  async insertIntervention(data: InterventionInsert): Promise<Intervention> {
    try {
      await this.ensureUserRecord(data.user_id);
      const { data: result, error } = await supabase
        .from('interventions')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      handleSupabaseError(error, 'insertIntervention');
    }
  },

  /**
   * Update intervention with user feedback
   */
  async updateIntervention(interventionId: number, updates: InterventionUpdate): Promise<Intervention> {
    try {
      const { data, error } = await supabase
        .from('interventions')
        .update(updates)
        .eq('id', interventionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      handleSupabaseError(error, 'updateIntervention');
    }
  },

  /**
   * Get recent interventions for user
   */
  async getRecentInterventions(userId: string, limit: number = 10): Promise<Intervention[]> {
    try {
      const { data, error } = await supabase
        .from('interventions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      handleSupabaseError(error, 'getRecentInterventions');
    }
  },

  /**
   * Get intervention statistics
   */
  async getInterventionStats(userId: string, days: number = 7): Promise<{
    total_interventions: number;
    avg_duration_secs: number;
    automatic_count: number;
    manual_count: number;
    feedback_better: number;
    feedback_same: number;
    feedback_worse: number;
  }> {
    try {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - days);

      const { data, error } = await supabase
        .from('interventions')
        .select('*')
        .eq('user_id', userId)
        .gte('started_at', startTime.toISOString());

      if (error) throw error;

      const interventions = data || [];
      const totalDuration = interventions.reduce((sum, i) => sum + i.completed_secs, 0);
      const avgDuration =
        interventions.length > 0 ? Math.round(totalDuration / interventions.length) : 0;

      return {
        total_interventions: interventions.length,
        avg_duration_secs: avgDuration,
        automatic_count: interventions.filter((i) => i.trigger_type === 'Automatic').length,
        manual_count: interventions.filter((i) => i.trigger_type === 'Manual').length,
        feedback_better: interventions.filter((i) => i.user_feedback === 'Better').length,
        feedback_same: interventions.filter((i) => i.user_feedback === 'Same').length,
        feedback_worse: interventions.filter((i) => i.user_feedback === 'Worse').length,
      };
    } catch (error) {
      handleSupabaseError(error, 'getInterventionStats');
    }
  },

  // ============================================
  // BULK & COMPOSITE OPERATIONS
  // ============================================

  /**
   * Get complete user profile with settings
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const user = await this.getUser(userId);
      if (!user) return null;

      const userSettings = await this.getUserSettings(userId);

      return {
        ...user,
        user_settings: userSettings,
      };
    } catch (error) {
      handleSupabaseError(error, 'getUserProfile');
    }
  },

  /**
   * Get intervention with related biometric and prediction data
   */
  async getInterventionWithContext(interventionId: number): Promise<InterventionWithContext | null> {
    try {
      const { data, error } = await supabase
        .from('interventions')
        .select(
          `
          *,
          prediction:predictions_log!interventions_prediction_id_fkey(*)
        `
        )
        .eq('id', interventionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data;
    } catch (error) {
      handleSupabaseError(error, 'getInterventionWithContext');
    }
  },

  /**
   * Delete user and cascade all related data
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, 'deleteUser');
    }
  },
};

export default db;
