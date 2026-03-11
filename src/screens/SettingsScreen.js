import React, { useEffect, useMemo, useState } from "react";
import { Alert, View, Text, StyleSheet, Switch, TextInput } from "react-native";
import { useThemeColors } from "../hooks/useThemeColors";
import { radius, spacing } from "../constants/theme";
import { typography } from "../constants/typography";
import Screen from "../components/Screen";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useThemeMode } from "../../theme/ThemeProvider";
import { useAuth } from "../contexts/AuthContext";

export default function SettingsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { mode, setMode, resolvedScheme } = useThemeMode();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [connected, setConnected] = useState(true);
  const { user, profile, profileLoading, updateProfile, signOut, deleteProfile } =
    useAuth();
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  const handleDisconnect = () => {
    setConnected(false);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileError("");
    setSavingProfile(true);
    try {
      await updateProfile({ full_name: fullName.trim() });
    } catch (err) {
      setProfileError(err?.message ?? "Unable to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      setProfileError(err?.message ?? "Unable to sign out.");
    }
  };

  const handleDeleteProfile = () => {
    if (!user) return;
    Alert.alert(
      "Delete profile data",
      "This removes your profile record. Your authentication account remains.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setProfileError("");
            try {
              await deleteProfile();
              await signOut();
            } catch (err) {
              setProfileError(err?.message ?? "Unable to delete profile.");
            }
          },
        },
      ]
    );
  };

  return (
    <Screen scroll={true}>
      <Text style={styles.title}>Profile</Text>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.label}>Full name</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
          editable={!profileLoading}
        />
        <Text style={styles.label}>Email</Text>
        <View style={styles.readonlyField}>
          <Text style={styles.readonlyText}>{user?.email ?? "Not signed in"}</Text>
        </View>

        <Text style={styles.meta}>Device: MindPulse Watch</Text>
        <View style={styles.statusRow}>
          <Text style={styles.meta}>Status</Text>
          <Badge variant={connected ? "success" : "destructive"}>
            {connected ? "Connected" : "Disconnected"}
          </Badge>
        </View>

        {profileError ? <Text style={styles.error}>{profileError}</Text> : null}

        <Button
          onPress={handleSaveProfile}
          loading={savingProfile}
          disabled={!user || profileLoading}
          style={styles.saveButton}
        >
          Save profile
        </Button>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <Text style={styles.settingSubtitle}>
          Follow the system theme or set manually.
        </Text>
        <View style={styles.themeRow}>
          <Button
            size="sm"
            variant={mode === "system" ? "default" : "outline"}
            onPress={() => setMode("system")}
            style={styles.themeButton}
          >
            System
          </Button>
          <Button
            size="sm"
            variant={mode === "light" ? "default" : "outline"}
            onPress={() => setMode("light")}
            style={styles.themeButton}
          >
            Light
          </Button>
          <Button
            size="sm"
            variant={mode === "dark" ? "default" : "outline"}
            onPress={() => setMode("dark")}
            style={styles.themeButton}
          >
            Dark
          </Button>
        </View>
        <Text style={styles.themeHint}>
          Current: {resolvedScheme === "dark" ? "Dark" : "Light"}
        </Text>
      </Card>

      <Card style={styles.settingRow}>
        <View>
          <Text style={styles.settingTitle}>Push Notifications</Text>
          <Text style={styles.settingSubtitle}>Stress alerts and reminders</Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={notificationsEnabled ? colors.textPrimary : colors.textMuted}
        />
      </Card>

      <Button
        variant="destructive"
        onPress={handleDisconnect}
        disabled={!connected}
        style={styles.disconnectButton}
      >
        {connected ? "Disconnect Wearable" : "Wearable Disconnected"}
      </Button>

      <Button
        variant="outline"
        onPress={handleSignOut}
        disabled={!user}
        style={styles.signOutButton}
      >
        Log out
      </Button>

      <Button
        variant="destructive"
        onPress={handleDeleteProfile}
        disabled={!user}
        style={styles.deleteButton}
      >
        Delete profile data
      </Button>
    </Screen>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    title: {
      ...typography.title,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    card: {
      padding: spacing.md,
      marginBottom: spacing.xl,
    },
    name: {
      ...typography.titleSm,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    meta: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    sectionTitle: {
      ...typography.bodyEmphasis,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    themeRow: {
      flexDirection: "row",
      gap: spacing.xs,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    themeButton: {
      flex: 1,
    },
    themeHint: {
      ...typography.captionSm,
      color: colors.textMuted,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    settingTitle: {
      ...typography.bodyEmphasis,
      color: colors.textPrimary,
      marginBottom: spacing.xxs,
    },
    settingSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.xs,
    },
    disconnectButton: {
      alignSelf: "stretch",
      marginTop: spacing.xs,
    },
    label: {
      ...typography.captionEmphasis,
      color: colors.textSecondary,
      marginTop: spacing.sm,
      marginBottom: spacing.xxs,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    readonlyField: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    readonlyText: {
      ...typography.body,
      color: colors.textMuted,
    },
    error: {
      ...typography.bodySm,
      color: colors.warning,
      marginTop: spacing.sm,
    },
    saveButton: {
      marginTop: spacing.md,
      alignSelf: "stretch",
    },
    signOutButton: {
      alignSelf: "stretch",
      marginTop: spacing.md,
    },
    deleteButton: {
      alignSelf: "stretch",
      marginTop: spacing.sm,
    },
  });
