import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import { useThemeColors } from "../hooks/useThemeColors";
import GradientBackdrop from "../components/GradientBackdrop";
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
    <View style={styles.screen}>
      <GradientBackdrop />
      <View style={styles.container}>
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
      </View>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 54,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "600",
      marginBottom: 16,
    },
    card: {
      padding: 18,
      marginBottom: 24,
    },
    name: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 6,
    },
    meta: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 4,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 6,
    },
    themeRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
      marginBottom: 10,
    },
    themeButton: {
      flex: 1,
    },
    themeHint: {
      color: colors.textMuted,
      fontSize: 11,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      marginBottom: 20,
    },
    settingTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "500",
      marginBottom: 4,
    },
    settingSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
    },
    disconnectButton: {
      alignSelf: "stretch",
      marginTop: 6,
    },
  });
