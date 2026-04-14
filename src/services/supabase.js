/**
 * Enhanced Supabase client with auth integration
 * Extends the base supabase client with MindPulse-specific auth flows
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const normalizeEnv = (value) => (typeof value === 'string' ? value.trim() : '');

const supabaseUrl = normalizeEnv(process.env.EXPO_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = normalizeEnv(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const FALLBACK_SUPABASE_URL = 'https://placeholder.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'placeholder-anon-key';

if (!isSupabaseConfigured) {
  console.warn(
    '[SupabaseInit:v2] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

const buildClientOptions = () => ({
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const createSupabaseClientSafely = () => {
  const resolvedSupabaseUrl = supabaseUrl || FALLBACK_SUPABASE_URL;
  const resolvedSupabaseAnonKey = supabaseAnonKey || FALLBACK_SUPABASE_ANON_KEY;

  try {
    return createClient(
      resolvedSupabaseUrl,
      resolvedSupabaseAnonKey,
      buildClientOptions()
    );
  } catch (error) {
    console.error(
      '[SupabaseInit:v2] Primary client init failed, retrying with fallback config',
      error
    );
    return createClient(
      FALLBACK_SUPABASE_URL,
      FALLBACK_SUPABASE_ANON_KEY,
      buildClientOptions()
    );
  }
};

export const supabase = createSupabaseClientSafely();

const authRedirectUrl = process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL;
export const USER_PROFILE_FIELDS =
  'id,email,full_name,baseline_hr_bpm,baseline_temp_c,created_at,updated_at';

const syncUserData = async (user) => {
  if (!user) return;

  const profilePayload = {
    id: user.id,
    email: user.email ?? null,
    full_name: user.user_metadata?.full_name ?? null,
  };
  const { error: userError } = await supabase
    .from('users')
    .upsert(profilePayload, { onConflict: 'id' });

  if (userError) {
    console.warn('[Supabase] Failed to sync user record', userError.message);
    return;
  }

  const { error: settingsError } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id }, { onConflict: 'user_id' });

  if (settingsError) {
    console.warn(
      '[Supabase] Failed to sync user settings',
      settingsError.message
    );
  }
};

/**
 * Auth wrapper with user context and DB setup
 */
export const authService = {
  /**
   * Sign up new user and initialize their database records
   */
  async signUp(email, password) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: authRedirectUrl ? { emailRedirectTo: authRedirectUrl } : undefined,
      });

      if (error) {
        console.error('[Auth] Sign up error:', error);
        return { session: null, error };
      }

      if (data.session?.user) {
        await syncUserData(data.session.user);
      }

      return { session: data.session, error: null };
    } catch (error) {
      console.error('[Auth] Unexpected sign up error:', error);
      return { session: null, error };
    }
  },

  /**
   * Sign in existing user
   */
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Auth] Sign in error:', error);
        return { session: null, error };
      }

      if (data.session?.user) {
        await syncUserData(data.session.user);
      }

      return { session: data.session, error: null };
    } catch (error) {
      console.error('[Auth] Unexpected sign in error:', error);
      return { session: null, error };
    }
  },

  /**
   * Sign out and clear session
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('[Auth] Sign out error:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('[Auth] Unexpected sign out error:', error);
      return { error };
    }
  },

  /**
   * Get current session
   */
  async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[Auth] Get session error:', error);
        return null;
      }

      return data.session;
    } catch (error) {
      console.error('[Auth] Unexpected get session error:', error);
      return null;
    }
  },

  /**
   * Get current user
   */
  async getUser() {
    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.error('[Auth] Get user error:', error);
        return null;
      }

      return data.user;
    } catch (error) {
      console.error('[Auth] Unexpected get user error:', error);
      return null;
    }
  },

  /**
   * Reset password via email
   */
  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email,
        authRedirectUrl ? { redirectTo: authRedirectUrl } : undefined
      );

      if (error) {
        console.error('[Auth] Reset password error:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('[Auth] Unexpected reset password error:', error);
      return { error };
    }
  },

  /**
   * Update password after reset
   */
  async updatePassword(newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('[Auth] Update password error:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('[Auth] Unexpected update password error:', error);
      return { error };
    }
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  },
};

export default supabase;
