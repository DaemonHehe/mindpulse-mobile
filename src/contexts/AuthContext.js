import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Linking } from "react-native";
import { supabase } from "../services/supabase";

const AuthContext = createContext({
  session: null,
  user: null,
  profile: null,
  initializing: true,
  profileLoading: false,
  recoveryActive: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  sendPasswordReset: async () => {},
  updatePassword: async () => {},
  updateProfile: async () => {},
  deleteProfile: async () => {},
  refreshProfile: async () => {},
  clearRecovery: () => {},
});

const PROFILE_FIELDS = "id,email,full_name,created_at,updated_at";

const parseParams = (url) => {
  if (!url) return {};
  const hashIndex = url.indexOf("#");
  const queryIndex = url.indexOf("?");
  let paramString = "";

  if (hashIndex >= 0) {
    paramString = url.slice(hashIndex + 1);
  } else if (queryIndex >= 0) {
    paramString = url.slice(queryIndex + 1);
  }

  if (!paramString) return {};

  return paramString.split("&").reduce((acc, part) => {
    const [key, value] = part.split("=");
    if (!key) return acc;
    acc[decodeURIComponent(key)] = decodeURIComponent(value ?? "");
    return acc;
  }, {});
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [recoveryActive, setRecoveryActive] = useState(false);

  const user = session?.user ?? null;

  const fetchProfile = useCallback(async (activeUser) => {
    if (!activeUser) {
      setProfile(null);
      return null;
    }

    setProfileLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("id", activeUser.id)
      .maybeSingle();

    if (error) {
      setProfileLoading(false);
      throw error;
    }

    if (!data) {
      const payload = {
        id: activeUser.id,
        email: activeUser.email ?? null,
        full_name: activeUser.user_metadata?.full_name ?? null,
        updated_at: new Date().toISOString(),
      };

      const { data: created, error: createError } = await supabase
        .from("profiles")
        .insert(payload)
        .select(PROFILE_FIELDS)
        .single();

      setProfileLoading(false);

      if (createError) {
        throw createError;
      }

      setProfile(created);
      return created;
    }

    setProfile(data);
    setProfileLoading(false);
    return data;
  }, []);

  useEffect(() => {
    let active = true;

    const hydrateSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error) {
        console.warn("[Supabase] Failed to restore session", error.message);
      }

      setSession(data?.session ?? null);

      if (data?.session?.user) {
        try {
          await fetchProfile(data.session.user);
        } catch (err) {
          console.warn("[Supabase] Failed to load profile", err.message);
        }
      } else {
        setProfile(null);
      }

      setInitializing(false);
    };

    hydrateSession();

    const { data } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        if (!active) return;
        setSession(nextSession ?? null);

        if (event === "PASSWORD_RECOVERY") {
          setRecoveryActive(true);
        }

        if (!nextSession) {
          setRecoveryActive(false);
        }

        if (nextSession?.user) {
          try {
            await fetchProfile(nextSession.user);
          } catch (err) {
            console.warn("[Supabase] Failed to load profile", err.message);
          }
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      active = false;
      data?.subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  const handleRecoveryLink = useCallback(async (url) => {
    const params = parseParams(url);
    if (params.type !== "recovery") return;
    if (!params.access_token || !params.refresh_token) return;

    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });

    if (error) {
      console.warn("[Supabase] Failed to set recovery session", error.message);
      return;
    }

    setRecoveryActive(true);
  }, []);

  useEffect(() => {
    let active = true;

    Linking.getInitialURL()
      .then((url) => {
        if (!active || !url) return;
        handleRecoveryLink(url);
      })
      .catch(() => {});

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleRecoveryLink(url);
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [handleRecoveryLink]);

  const signIn = useCallback(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  }, []);

  const signUp = useCallback(async ({ email, password, fullName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      throw error;
    }

    return {
      needsEmailConfirmation: !data?.session,
    };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    setRecoveryActive(false);
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    const redirectTo = process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL;
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined
    );

    if (error) {
      throw error;
    }
  }, []);

  const updatePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      throw error;
    }
    setRecoveryActive(false);
  }, []);

  const updateProfile = useCallback(
    async (updates) => {
      if (!user) {
        throw new Error("Not authenticated.");
      }

      const payload = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id)
        .select(PROFILE_FIELDS)
        .single();

      if (error) {
        throw error;
      }

      setProfile(data);
      return data;
    },
    [user]
  );

  const deleteProfile = useCallback(async () => {
    if (!user) {
      throw new Error("Not authenticated.");
    }

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (error) {
      throw error;
    }

    setProfile(null);
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user) return null;
    return fetchProfile(user);
  }, [fetchProfile, user]);

  const clearRecovery = useCallback(() => {
    setRecoveryActive(false);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      initializing,
      profileLoading,
      recoveryActive,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      updatePassword,
      updateProfile,
      deleteProfile,
      refreshProfile,
      clearRecovery,
    }),
    [
      session,
      user,
      profile,
      initializing,
      profileLoading,
      recoveryActive,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      updatePassword,
      updateProfile,
      deleteProfile,
      refreshProfile,
      clearRecovery,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
