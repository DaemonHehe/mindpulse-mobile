import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import { useThemeColors } from "../hooks/useThemeColors";
import { spacing } from "../constants/theme";
import { typography } from "../constants/typography";
import Screen from "../components/Screen";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useThemeMode } from "../../theme/ThemeProvider";

export default function SettingsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { mode, setMode, resolvedScheme } = useThemeMode();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [connected, setConnected] = useState(true);

  const handleDisconnect = () => {
    setConnected(false);
  };

  return (
    <Screen scroll={true}>
      <Text style={styles.title}>Profile</Text>

      <Card style={styles.card}>
        <Text style={styles.name}>Alex Morgan</Text>
        <Text style={styles.meta}>alex.morgan@mindpulse.app</Text>
        <Text style={styles.meta}>Device: MindPulse Watch</Text>
        <View style={styles.statusRow}>
          <Text style={styles.meta}>Status</Text>
          <Badge variant={connected ? "success" : "destructive"}>
            {connected ? "Connected" : "Disconnected"}
          </Badge>
        </View>
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
      marginBottom: spacing.xxs,
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
  });
