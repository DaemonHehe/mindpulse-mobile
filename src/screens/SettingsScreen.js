import React, { useState } from "react";
import { View, Text, StyleSheet, Switch, Pressable } from "react-native";

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [connected, setConnected] = useState(true);

  const handleDisconnect = () => {
    setConnected(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.name}>Alex Morgan</Text>
        <Text style={styles.meta}>alex.morgan@mindpulse.app</Text>
        <Text style={styles.meta}>Device: MindPulse Watch</Text>
        <Text style={styles.meta}>
          Status: {connected ? "Connected" : "Disconnected"}
        </Text>
      </View>

      <View style={styles.settingRow}>
        <View>
          <Text style={styles.settingTitle}>Push Notifications</Text>
          <Text style={styles.settingSubtitle}>Stress alerts and reminders</Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
          trackColor={{ false: "#12363A", true: "#37E3B2" }}
          thumbColor={notificationsEnabled ? "#EAF6F6" : "#88AEB2"}
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.disconnectButton,
          pressed && styles.disconnectPressed,
          !connected && styles.disconnectDisabled,
        ]}
        onPress={handleDisconnect}
        disabled={!connected}
      >
        <Text style={styles.disconnectText}>
          {connected ? "Disconnect Wearable" : "Wearable Disconnected"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1F22",
    paddingHorizontal: 20,
    paddingTop: 54,
  },
  title: {
    color: "#EAF6F6",
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#0E2A2E",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#12363A",
    marginBottom: 24,
  },
  name: {
    color: "#EAF6F6",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },
  meta: {
    color: "#7AA5A5",
    fontSize: 12,
    marginBottom: 4,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0E2A2E",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#12363A",
    marginBottom: 20,
  },
  settingTitle: {
    color: "#EAF6F6",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  settingSubtitle: {
    color: "#7AA5A5",
    fontSize: 12,
  },
  disconnectButton: {
    backgroundColor: "#2E1212",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4A1A1A",
  },
  disconnectPressed: {
    opacity: 0.8,
  },
  disconnectDisabled: {
    backgroundColor: "#1F1F1F",
    borderColor: "#2C2C2C",
  },
  disconnectText: {
    color: "#FF8A3D",
    fontWeight: "600",
  },
});
