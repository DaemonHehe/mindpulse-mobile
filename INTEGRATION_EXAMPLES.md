/**
 * INTEGRATION EXAMPLES - How to use the database layer in React Native screens
 * 
 * This file demonstrates real-world usage patterns for each screen/component
 */

// ============================================
// 1. LOGIN & REGISTRATION SCREEN
// ============================================

import { authService } from '@/services/supabase';
import { db } from '@/services/db';

export const LoginScreenIntegration = {
  /**
   * Handle user registration
   * - Create auth user
   * - Initialize database records (auto-done by authService.signUp)
   */
  async handleSignUp(email: string, password: string) {
    try {
      const { session, error } = await authService.signUp(email, password);
      
      if (error) {
        console.error('Signup error:', error.message);
        return { success: false, error: error.message };
      }

      // User and user_settings automatically created by authService
      console.log('✅ User registered and initialized');
      
      return { success: true, session };
    } catch (error) {
      console.error('Unexpected error:', error);
      return { success: false, error: 'Unexpected error during signup' };
    }
  },

  /**
   * Handle user login
   */
  async handleSignIn(email: string, password: string) {
    try {
      const { session, error } = await authService.signIn(email, password);
      
      if (error) {
        console.error('Signin error:', error.message);
        return { success: false, error: 'Invalid email or password' };
      }

      console.log('✅ User signed in');
      
      return { success: true, session };
    } catch (error) {
      console.error('Unexpected error:', error);
      return { success: false, error: 'Unexpected error during signin' };
    }
  },
};

// ============================================
// 2. SETTINGS SCREEN
// ============================================

export const SettingsScreenIntegration = {
  /**
   * Load user settings on screen mount
   */
  async loadSettings(userId: string) {
    try {
      const settings = await db.getUserSettings(userId);
      
      if (!settings) {
        console.warn('No settings found for user');
        return null;
      }

      return {
        push_notifications: settings.push_notifications,
        breathing_duration: settings.breathing_duration,
        haptic_feedback: settings.haptic_feedback,
      };
    } catch (error) {
      console.error('Error loading settings:', error);
      return null;
    }
  },

  /**
   * Update user settings
   */
  async updateSettings(userId: string, updates: {
    push_notifications?: boolean;
    breathing_duration?: number;
    haptic_feedback?: boolean;
  }) {
    try {
      const updated = await db.updateUserSettings(userId, updates);
      console.log('✅ Settings updated');
      return updated;
    } catch (error) {
      console.error('Error updating settings:', error);
      return null;
    }
  },

  /**
   * Example: User changes breathing duration
   */
  async handleBreathingDurationChange(userId: string, newDuration: number) {
    if (newDuration < 30 || newDuration > 600) {
      console.warn('Invalid duration: must be 30-600 seconds');
      return false;
    }

    const result = await this.updateSettings(userId, {
      breathing_duration: newDuration,
    });

    return result !== null;
  },
};

// ============================================
// 3. DASHBOARD SCREEN - Display Analytics
// ============================================

export const DashboardScreenIntegration = {
  /**
   * Load all dashboard data on screen mount
   */
  async loadDashboardData(userId: string) {
    try {
      // Parallel load all dashboard components
      const [stressStats, interventionStats, recentInterventions] = await Promise.all([
        db.getStressStats(userId, 7),           // Last 7 days
        db.getInterventionStats(userId, 7),     // Last 7 days
        db.getRecentInterventions(userId, 5),   // Last 5 exercises
      ]);

      return {
        stressStats,        // { stress_count, relaxed_count, avg_fused_score }
        interventionStats,  // { total_interventions, avg_duration, feedback_* }
        recentInterventions,
      };
    } catch (error) {
      console.error('Error loading dashboard:', error);
      return null;
    }
  },

  /**
   * Calculate dashboard metrics for rendering
   */
  calculateMetrics(stressStats, interventionStats) {
    const total = stressStats.stress_count + stressStats.relaxed_count;
    const stressPercentage = total > 0 
      ? Math.round((stressStats.stress_count / total) * 100) 
      : 0;

    const totalFeedback = 
      interventionStats.feedback_better +
      interventionStats.feedback_same +
      interventionStats.feedback_worse;

    const helpPercentage = totalFeedback > 0
      ? Math.round((interventionStats.feedback_better / totalFeedback) * 100)
      : 0;

    return {
      stressPercentage,
      relaxPercentage: 100 - stressPercentage,
      avgStressScore: stressStats.avg_fused_score.toFixed(2),
      helpPercentage,
      totalExercises: interventionStats.total_interventions,
      avgDuration: interventionStats.avg_duration_secs,
    };
  },

  /**
   * Render Stress Insights chart (Last 24 hours)
   */
  async loadChartData(userId: string) {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
      const predictions = await db.getPredictionsInRange(
        userId,
        yesterday.toISOString(),
        now.toISOString()
      );

      // Group by hour
      const hourlyData = {};
      predictions.forEach(p => {
        const hour = new Date(p.created_at).getHours();
        hourlyData[hour] = hourlyData[hour] || [];
        hourlyData[hour].push(p.fused_score);
      });

      // Calculate hourly averages
      return Object.entries(hourlyData).map(([hour, scores]) => ({
        hour: parseInt(hour),
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        pointCount: scores.length,
      }));
    } catch (error) {
      console.error('Error loading chart data:', error);
      return [];
    }
  },
};

// ============================================
// 4. BREATHING INTERVENTION SCREEN
// ============================================

export const BreathingInterventionIntegration = {
  /**
   * Start breathing intervention (triggered by AI or user)
   */
  async startIntervention(userId: string, options: {
    predictionId?: number; // null if manual
    triggerType: 'Automatic' | 'Manual';
  }) {
    try {
      const intervention = await db.insertIntervention({
        user_id: userId,
        prediction_id: options.predictionId || null,
        started_at: new Date().toISOString(),
        completed_secs: 0,               // Will update on completion
        trigger_type: options.triggerType,
        user_feedback: null,             // Will update after rating
      });

      console.log('✅ Intervention started:', intervention.id);
      return intervention;
    } catch (error) {
      console.error('Error starting intervention:', error);
      return null;
    }
  },

  /**
   * Complete breathing exercise and log duration
   */
  async completeIntervention(interventionId: number, completedSecs: number) {
    try {
      const updated = await db.updateIntervention(interventionId, {
        completed_secs: completedSecs,
      });

      console.log('✅ Intervention completed');
      return updated;
    } catch (error) {
      console.error('Error completing intervention:', error);
      return null;
    }
  },

  /**
   * User rates post-exercise experience
   */
  async recordUserFeedback(interventionId: number, feedback: 'Better' | 'Same' | 'Worse') {
    try {
      const updated = await db.updateIntervention(interventionId, {
        user_feedback: feedback,
      });

      console.log(`✅ Feedback recorded: ${feedback}`);
      return updated;
    } catch (error) {
      console.error('Error recording feedback:', error);
      return null;
    }
  },

  /**
   * Example: Full breathing exercise flow
   */
  async fullBreathingFlow(userId: string, stressfulPredictionId: number | null) {
    // 1. Start intervention
    const intervention = await this.startIntervention(userId, {
      predictionId: stressfulPredictionId,
      triggerType: stressfulPredictionId ? 'Automatic' : 'Manual',
    });

    if (!intervention) return;

    // 2. [UI shows breathing animation for duration]
    // 3. User completes exercise (simulated 4 minutes = 240 seconds)
    const completedSecs = 240;
    await this.completeIntervention(intervention.id, completedSecs);

    // 4. User rates experience
    // [User selects "Better", "Same", or "Worse"]
    await this.recordUserFeedback(intervention.id, 'Better');

    console.log('✅ Full intervention cycle complete');
  },
};

// ============================================
// 5. BIOMETRIC COLLECTION (Background)
// ============================================

export const BiometricCollectionIntegration = {
  /**
   * Called every minute by Bluetooth aggregation service
   * Stores 1-minute biometric window to database
   */
  async logBiometricWindow(userId: string, biometricData: {
    hr_mean: number;
    hrv_sdnn: number;
    temp_mean: number;
    eda_peaks: number;
  }) {
    try {
      const window = await db.insertBiometricWindow({
        user_id: userId,
        timestamp: new Date().toISOString(),
        hr_mean: biometricData.hr_mean,
        hrv_sdnn: biometricData.hrv_sdnn,
        temp_mean: biometricData.temp_mean,
        eda_peaks: biometricData.eda_peaks,
      });

      console.log('📊 Biometric window recorded:', window.id);
      return window;
    } catch (error) {
      console.error('Error logging biometric:', error);
      return null;
    }
  },

  /**
   * After week 1, calculate and update user baselines
   */
  async calculateAndUpdateBaselines(userId: string) {
    try {
      // Get all data from week 1
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const biometrics = await db.getBiometricWindowsInRange(
        userId,
        weekAgo.toISOString(),
        new Date().toISOString()
      );

      if (biometrics.length < 1440) { // ~1 day of data
        console.log('Not enough data to calculate baselines');
        return null;
      }

      // Calculate averages
      const avgHR = biometrics.reduce((sum, b) => sum + b.hr_mean, 0) / biometrics.length;
      const avgTemp = biometrics.reduce((sum, b) => sum + b.temp_mean, 0) / biometrics.length;

      // Update user record
      const updated = await db.updateUserBaselines(
        userId,
        Math.round(avgHR),
        Math.round(avgTemp * 100) / 100
      );

      console.log('✅ Baselines updated:', { avgHR, avgTemp });
      return updated;
    } catch (error) {
      console.error('Error calculating baselines:', error);
      return null;
    }
  },
};

// ============================================
// 6. ML PREDICTION LOGGING (Backend Integration)
// ============================================

export const MLPredictionIntegration = {
  /**
   * Called by backend Python service after inference
   * Logs both model outputs and fused score
   */
  async logPrediction(data: {
    user_id: string;
    window_id: number;
    rf_confidence: number;    // Random Forest output
    lstm_confidence: number;  // LSTM output
    fused_score: number;      // Combined/weighted score
  }) {
    try {
      // Determine stress state based on threshold
      const finalState = data.fused_score > 0.5 ? 'Stressed' : 'Relaxed';

      const prediction = await db.insertPrediction({
        user_id: data.user_id,
        window_id: data.window_id,
        rf_confidence: data.rf_confidence,
        lstm_confidence: data.lstm_confidence,
        fused_score: data.fused_score,
        final_state: finalState,
      });

      console.log('🤖 Prediction logged:', {
        id: prediction.id,
        state: finalState,
        confidence: data.fused_score,
      });

      // Return whether to trigger intervention
      return {
        shouldTrigger: finalState === 'Stressed',
        prediction,
      };
    } catch (error) {
      console.error('Error logging prediction:', error);
      return { shouldTrigger: false, prediction: null };
    }
  },

  /**
   * Example: Backend inference pipeline
   * 
   * Flow:
   * 1. Backend polls for new biometric_windows
   * 2. Runs ML models on latest window
   * 3. Logs prediction and checks if intervention needed
   * 4. If stressed, sends push notification to React Native
   */
  async backendInferencePipeline(userId: string) {
    // Get latest sensor data
    const latestWindow = await db.getLatestBiometricWindow(userId);
    if (!latestWindow) return;

    // [Python Backend: Run ML models]
    const rfConfidence = 0.85;   // Random Forest output
    const lstmConfidence = 0.72; // LSTM output
    const fusedScore = (rfConfidence * 0.4 + lstmConfidence * 0.6); // Weighted average

    // Log prediction
    const { shouldTrigger, prediction } = await this.logPrediction({
      user_id: userId,
      window_id: latestWindow.id,
      rf_confidence: rfConfidence,
      lstm_confidence: lstmConfidence,
      fused_score: fusedScore,
    });

    // If stressed, trigger breathing exercise
    if (shouldTrigger && prediction) {
      console.log('🚨 High stress detected - triggering intervention');
      
      // [Backend sends push notification to React Native]
      // [React Native receives and shows breathing UI]
      
      // When user completes breathing (in React Native):
      return {
        triggerIntervention: true,
        predictionId: prediction.id,
        confidenceScore: fusedScore,
      };
    }

    return { triggerIntervention: false };
  },
};

// ============================================
// 7. AUTH STATE LISTENER (App.js/index.js)
// ============================================

export const AppStateIntegration = {
  /**
   * Set up auth listener on app startup
   * Persists session across app restarts
   */
  setupAuthListener() {
    const unsubscribe = authService.onAuthStateChange((session) => {
      if (session) {
        console.log('👤 User logged in:', session.user.id);
        // Navigate to Dashboard
        // updateAppState({ userId: session.user.id, authenticated: true });
      } else {
        console.log('👤 User logged out');
        // Navigate to Login
        // updateAppState({ userId: null, authenticated: false });
      }
    });

    return unsubscribe;
  },

  /**
   * Clean up on app unmount
   */
  async cleanupAuthListener(unsubscribe) {
    unsubscribe?.();
  },
};

// ============================================
// 8. COMPLETE EXAMPLE: Integrating into LoginScreen.js
// ============================================

/*
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Alert } from 'react-native';
import { authService } from '@/services/supabase';
import { LoginScreenIntegration } from './integration-examples';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Validation', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const result = await LoginScreenIntegration.handleSignUp(email, password);
      
      if (result.success) {
        Alert.alert('Success', 'Account created!', [
          { text: 'OK', onPress: () => navigation.push('Dashboard') }
        ]);
      } else {
        Alert.alert('Error', result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Validation', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const result = await LoginScreenIntegration.handleSignIn(email, password);
      
      if (result.success) {
        // Session persists automatically
        navigation.replace('Dashboard');
      } else {
        Alert.alert('Error', result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, padding: 10, marginBottom: 20 }}
      />
      <TouchableOpacity 
        onPress={handleSignIn} 
        disabled={loading}
        style={{ backgroundColor: '#007AFF', padding: 15, marginBottom: 10 }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>
          {loading ? 'Loading...' : 'Sign In'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={handleSignUp} 
        disabled={loading}
        style={{ backgroundColor: '#34C759', padding: 15 }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>
          {loading ? 'Creating...' : 'Sign Up'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
*/

// ============================================
// 9. ERROR HANDLING PATTERNS
// ============================================

export const ErrorHandlingPatterns = {
  /**
   * Wrap async operations with error handling
   */
  async safeDbOperation(operation, context) {
    try {
      return await operation();
    } catch (error) {
      console.error(`[${context}] Error:`, error);
      // Could also send to error tracking service (Sentry, etc.)
      return null;
    }
  },

  /**
   * Retry on specific errors
   */
  async retryableOperation(operation, maxRetries = 3) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) throw error;
        
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  },
};

// ============================================
// 10. SUMMARY - Usage Pattern
// ============================================

/*
TYPICAL USAGE PATTERN:

1. AUTHENTICATION
   import { authService } from '@/services/supabase';
   
   const { session, error } = await authService.signUp(email, password);
   if (session) {
     userId = session.user.id; // Save for later use
     navigation.navigate('Dashboard');
   }

2. LOAD DATA
   import { db } from '@/services/db';
   
   const user = await db.getUser(userId);
   const settings = await db.getUserSettings(userId);

3. SAVE DATA
   await db.insertBiometricWindow({
     user_id: userId,
     timestamp: new Date().toISOString(),
     hr_mean: 72.5,
     hrv_sdnn: 45.3,
     temp_mean: 32.8,
     eda_peaks: 8,
   });

4. QUERY ANALYTICS
   const stats = await db.getStressStats(userId, 7);
   const interventions = await db.getRecentInterventions(userId, 10);

5. ERROR HANDLING
   try {
     const data = await db.getUser(userId);
   } catch (error) {
     console.error('Failed to fetch user:', error);
     // Show error UI
   }

ALL FUNCTIONS RETURN PROMISES!
Always use await or .then() for async operations
*/
