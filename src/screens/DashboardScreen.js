import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round1 = (value) => Math.round(value * 10) / 10;

const initialData = {
  timestamp: new Date().toISOString(),
  metrics: {
    hr_mean: 72,
    temp_mean: 33.5,
    eda_peaks: 2,
  },
  ml_prediction: {
    state: "Relaxed",
    confidence: 0.85,
  },
};

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(initialData);
  const lastStateRef = useRef(initialData.ml_prediction.state);

  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => {
        const prevHr = prev.metrics.hr_mean;
        const prevTemp = prev.metrics.temp_mean;

        let nextHr = clamp(prevHr + (Math.random() * 8 - 4), 60, 112);
        let nextTemp = clamp(prevTemp + (Math.random() * 0.4 - 0.2), 32.0, 35.5);
        let nextEda = clamp(prev.metrics.eda_peaks + Math.round(Math.random() * 2 - 1), 0, 6);

        const stressPulse = Math.random() < 0.25;
        if (stressPulse) {
          nextHr = clamp(96 + Math.random() * 14, 96, 112);
          nextTemp = clamp(prevTemp - (0.3 + Math.random() * 0.5), 32.0, 35.0);
          nextEda = clamp(nextEda + 2, 0, 8);
        }

        const tempDropped = nextTemp < prevTemp;
        const stressed = nextHr > 95 && tempDropped;

        const confidence = stressed
          ? 0.78 + Math.random() * 0.2
          : 0.8 + Math.random() * 0.15;

        return {
          timestamp: new Date().toISOString(),
          metrics: {
            hr_mean: Math.round(nextHr),
            temp_mean: round1(nextTemp),
            eda_peaks: Math.round(nextEda),
          },
          ml_prediction: {
            state: stressed ? "Stressed" : "Relaxed",
            confidence: round1(confidence),
          },
        };
      });
    }, 3000);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const nextState = data.ml_prediction.state;
    if (nextState === "Stressed" && lastStateRef.current !== "Stressed") {
      navigation.navigate("Intervention");
    }
    lastStateRef.current = nextState;
  }, [data.ml_prediction.state, navigation]);

  const isStressed = data.ml_prediction.state === "Stressed";
  const statusColors = isStressed
    ? { card: "#3B1E16", accent: "#FF8A3D", text: "#FFE6D6" }
    : { card: "#0E3A42", accent: "#37E3B2", text: "#E6FFFA" };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.subtle}>MindPulse Dashboard</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={styles.connectedDot} />
          <Text style={styles.statusText}>Watch Connected</Text>
        </View>
      </View>

      <View style={[styles.statusCard, { backgroundColor: statusColors.card }]}>
        <Text style={[styles.statusLabel, { color: statusColors.text }]}>Current State</Text>
        <Text style={[styles.statusValue, { color: statusColors.accent }]}>
          {data.ml_prediction.state}
        </Text>
        <Text style={[styles.confidence, { color: statusColors.text }]}>
          Confidence {Math.round(data.ml_prediction.confidence * 100)}%
        </Text>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Heart Rate</Text>
          <Text style={styles.metricValue}>{data.metrics.hr_mean} BPM</Text>
        </View>
        <View style={[styles.metricCard, styles.metricCardRight]}>
          <Text style={styles.metricLabel}>Skin Temp</Text>
          <Text style={styles.metricValue}>{data.metrics.temp_mean} C</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Last updated {new Date(data.timestamp).toLocaleTimeString()}
        </Text>
      </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  greeting: {
    color: "#EAF6F6",
    fontSize: 22,
    fontWeight: "600",
  },
  subtle: {
    color: "#88AEB2",
    marginTop: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E2A2E",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#12363A",
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#37E3B2",
    marginRight: 6,
  },
  statusText: {
    color: "#D5F2F2",
    fontSize: 12,
  },
  statusCard: {
    borderRadius: 20,
    padding: 22,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#12363A",
  },
  statusLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  statusValue: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 6,
  },
  confidence: {
    fontSize: 14,
  },
  metricsRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#0E2A2E",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#12363A",
  },
  metricCardRight: {
    marginLeft: 12,
  },
  metricLabel: {
    color: "#7AA5A5",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  metricValue: {
    color: "#EAF6F6",
    fontSize: 20,
    fontWeight: "600",
  },
  footer: {
    marginTop: 6,
  },
  footerText: {
    color: "#6F9BA0",
    fontSize: 12,
  },
});
