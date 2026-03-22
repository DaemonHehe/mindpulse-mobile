/**
 * Enhanced Supabase client with auth integration
 * Extends the base supabase client with MindPulse-specific auth flows
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, Session, AuthError, User } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const authRedirectUrl = process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL;
export const USER_PROFILE_FIELDS =
  'id,email,full_name,baseline_hr_bpm,baseline_temp_c,created_at,updated_at';

const syncUserData = async (user: User | null | undefined): Promise<void> => {
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
  async signUp(email: string, password: string): Promise<{ session: Session | null; error: AuthError | null }> {
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
      return { session: null, error: error as AuthError };
    }
  },

  /**
   * Sign in existing user
   */
  async signIn(email: string, password: string): Promise<{ session: Session | null; error: AuthError | null }> {
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
      return { session: null, error: error as AuthError };
    }
  },

  /**
   * Sign out and clear session
   */
  async signOut(): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('[Auth] Sign out error:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('[Auth] Unexpected sign out error:', error);
      return { error: error as AuthError };
    }
  },

  /**
   * Get current session
   */
  async getSession(): Promise<Session | null> {
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
  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
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
      return { error: error as AuthError };
    }
  },

  /**
   * Update password after reset
   */
  async updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
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
      return { error: error as AuthError };
    }
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  },
};

export default supabase;
