import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { radius, spacing } from "../constants/theme";
import { useThemeColors } from "../hooks/useThemeColors";
import { typography } from "../constants/typography";
import Screen from "../components/Screen";
import SiriOrb from "../components/SiriOrb";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Separator } from "../../components/ui/separator";
import { useEnvironmentalContext } from "../hooks/useEnvironmentalContext";
import { useLlmInsight } from "../hooks/useLlmInsight";
import { formatRatioAsPercent, formatTime } from "../utils/format";
import { buildInsightPrompt } from "../utils/insights";
import { useAuth } from "../contexts/AuthContext";
import db from "../services/db";

const UPDATE_INTERVAL_MS = 3000;
const STRESS_THRESHOLD_HR = 95;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round1 = (value) => Math.round(value * 10) / 10;
const round2 = (value) => Math.round(value * 100) / 100;

const createInitialData = () => ({
  timestamp: new Date().toISOString(),
  metrics: {
    hr_mean: 72,
    hrv_sdnn: 48,
    temp_mean: 33.5,
    eda_peaks: 2,
  },
  ml_prediction: {
    state: "Relaxed",
    confidence: 0.85,
    rf_confidence: 0.82,
    lstm_confidence: 0.88,
    fused_score: 0.85,
  },
});

const buildPrediction = (metrics, prevTemp) => {
  const tempDropped = metrics.temp_mean < prevTemp;
  const stressed =
    metrics.hr_mean > STRESS_THRESHOLD_HR &&
    (tempDropped || metrics.eda_peaks >= 4 || metrics.hrv_sdnn < 35);

  const rfConfidence = stressed
    ? clamp(0.68 + (metrics.hr_mean - 90) / 40, 0.68, 0.96)
    : clamp(0.84 - Math.max(metrics.eda_peaks - 1, 0) * 0.04, 0.62, 0.92);
  const lstmConfidence = stressed
    ? clamp(0.66 + (34 - Math.min(metrics.temp_mean, 34)) * 0.12, 0.67, 0.95)
    : clamp(0.83 - Math.max(32 - metrics.hrv_sdnn / 2, 0) * 0.02, 0.64, 0.93);
  const fusedScore = round2((rfConfidence + lstmConfidence) / 2);

  return {
    state: stressed ? "Stressed" : "Relaxed",
    confidence: fusedScore,
    rf_confidence: round2(rfConfidence),
    lstm_confidence: round2(lstmConfidence),
    fused_score: fusedScore,
  };
};

const buildNextSyntheticData = (prev) => {
  const prevHr = prev.metrics.hr_mean;
  const prevTemp = prev.metrics.temp_mean;
  const prevHrv = prev.metrics.hrv_sdnn;

  let nextHr = clamp(prevHr + (Math.random() * 8 - 4), 60, 112);
  let nextTemp = clamp(prevTemp + (Math.random() * 0.4 - 0.2), 32.0, 35.5);
  let nextEda = clamp(prev.metrics.eda_peaks + Math.round(Math.random() * 2 - 1), 0, 6);
  let nextHrv = clamp(prevHrv + (Math.random() * 8 - 4), 24, 90);

  const stressPulse = Math.random() < 0.25;
  if (stressPulse) {
    nextHr = clamp(96 + Math.random() * 14, 96, 112);
    nextTemp = clamp(prevTemp - (0.3 + Math.random() * 0.5), 32.0, 35.0);
    nextEda = clamp(nextEda + 2, 0, 8);
    nextHrv = clamp(prevHrv - (6 + Math.random() * 8), 18, 55);
  }

  const metrics = {
    hr_mean: Math.round(nextHr),
    hrv_sdnn: round1(nextHrv),
    temp_mean: round1(nextTemp),
    eda_peaks: Math.round(nextEda),
  };

  return {
    timestamp: new Date().toISOString(),
    metrics,
    ml_prediction: buildPrediction(metrics, prev.metrics.temp_mean),
  };
};

const mapSnapshotToData = (snapshot) => {
  const biometricWindow = snapshot?.biometricWindow ?? null;
  const prediction = snapshot?.prediction ?? null;

  if (!biometricWindow && !prediction) {
    return createInitialData();
  }

  const metrics = {
    hr_mean: biometricWindow?.hr_mean ?? 72,
    hrv_sdnn: biometricWindow?.hrv_sdnn ?? 48,
    temp_mean: biometricWindow?.temp_mean ?? 33.5,
    eda_peaks: biometricWindow?.eda_peaks ?? 2,
  };

  return {
    timestamp:
      biometricWindow?.timestamp ??
      prediction?.created_at ??
      new Date().toISOString(),
    metrics,
    ml_prediction: {
      state: prediction?.final_state ?? "Relaxed",
      confidence: prediction?.fused_score ?? 0.85,
      rf_confidence: prediction?.rf_confidence ?? 0.82,
      lstm_confidence: prediction?.lstm_confidence ?? 0.88,
      fused_score: prediction?.fused_score ?? 0.85,
    },
  };
};

export default function DashboardScreen() {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const [data, setData] = useState(() => createInitialData());
  const [dbError, setDbError] = useState("");
  const dataRef = useRef(data);
  const { data: envContext, loading: envLoading, error: envError, reload } =
    useEnvironmentalContext();
  const {
    loading: llmLoading,
    error: llmError,
    response: llmResponse,
    generate,
    clear,
  } = useLlmInsight({ system: "Keep the response under 80 words." });

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let active = true;
    let writing = false;

    const commitData = (nextData) => {
      dataRef.current = nextData;
      if (active) {
        setData(nextData);
      }
    };

    const persistSyntheticSnapshot = async () => {
      if (!user?.id || writing) return;
      writing = true;

      const nextData = buildNextSyntheticData(dataRef.current);

      try {
        const snapshot = await db.createBiometricSnapshot(
          {
            user_id: user.id,
            timestamp: nextData.timestamp,
            hr_mean: nextData.metrics.hr_mean,
            hrv_sdnn: nextData.metrics.hrv_sdnn,
            temp_mean: nextData.metrics.temp_mean,
            eda_peaks: nextData.metrics.eda_peaks,
          },
          {
            user_id: user.id,
            rf_confidence: nextData.ml_prediction.rf_confidence,
            lstm_confidence: nextData.ml_prediction.lstm_confidence,
            fused_score: nextData.ml_prediction.fused_score,
            final_state: nextData.ml_prediction.state,
          }
        );

        setDbError("");
        commitData(mapSnapshotToData(snapshot));
      } catch (error) {
        const message = error?.message || "Failed to sync dashboard data.";
        setDbError(message);
        commitData(nextData);
      } finally {
        writing = false;
      }
    };

    const hydrate = async () => {
      if (!user?.id) {
        commitData(createInitialData());
        setDbError("");
        return;
      }

      try {
        const snapshot = await db.getLatestDashboardSnapshot(user.id);
        if (!active) return;

        if (snapshot?.biometricWindow || snapshot?.prediction) {
          commitData(mapSnapshotToData(snapshot));
        } else {
          commitData(createInitialData());
        }
        setDbError("");
      } catch (error) {
        if (!active) return;
        setDbError(error?.message || "Failed to load dashboard data.");
        commitData(createInitialData());
      }

      await persistSyntheticSnapshot();
    };

    hydrate();
    const id = setInterval(() => {
      persistSyntheticSnapshot();
    }, UPDATE_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [user?.id]);

  const handleStartBreathing = () => {
    navigation.navigate("Intervention");
  };

  const isStressed = data.ml_prediction.state === "Stressed";
  const statusColors = useMemo(() => {
    return isStressed
      ? {
          card: colors.stressedCard,
          accent: colors.warning,
          text: colors.stressedText,
        }
      : {
          card: colors.calmCard,
          accent: colors.accent,
          text: colors.calmText,
        };
  }, [isStressed, colors]);

  const insightEvents = useMemo(
    () => [
      {
        id: "state",
        title: `State: ${data.ml_prediction.state}`,
        duration: `Confidence ${formatRatioAsPercent(data.ml_prediction.confidence)}`,
      },
      {
        id: "hr",
        title: `Heart rate ${data.metrics.hr_mean} BPM`,
        duration: `Skin temp ${data.metrics.temp_mean} C, HRV ${data.metrics.hrv_sdnn}`,
      },
      {
        id: "eda",
        title: `EDA peaks ${data.metrics.eda_peaks}`,
        duration: `Updated ${formatTime(data.timestamp)}`,
      },
    ],
    [data]
  );

  const prompt = useMemo(
    () => buildInsightPrompt(envContext, insightEvents),
    [envContext, insightEvents]
  );

  const handleGenerate = () => {
    if (!prompt || llmLoading) return;
    generate(prompt);
  };

  const handleClear = () => {
    clear();
  };

  const llmMessage = envLoading
    ? "Fetching environment context..."
    : envError
    ? envError
    : llmLoading
    ? "Thinking..."
    : llmError
    ? llmError
    : llmResponse
    ? llmResponse
    : "Tap Generate Insight to get a short, tailored suggestion.";

  const llmMessageTone = envError || llmError ? "error" : "default";

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.subtle}>MindPulse Dashboard</Text>
        </View>
        <View style={styles.statusRow}>
          <Badge variant="success">Watch Connected</Badge>
        </View>
      </View>

      <Card style={[styles.statusCard, { backgroundColor: statusColors.card }]}>
        <Text style={[styles.statusLabel, { color: statusColors.text }]}>
          Current State
        </Text>
        <Text style={[styles.statusValue, { color: statusColors.accent }]}>
          {data.ml_prediction.state}
        </Text>
        <Text style={[styles.confidence, { color: statusColors.text }]}>
          Confidence {formatRatioAsPercent(data.ml_prediction.confidence)}
        </Text>
      </Card>

      <View style={styles.metricsRow}>
        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>Heart Rate</Text>
          <Text style={styles.metricValue}>{data.metrics.hr_mean} BPM</Text>
        </Card>
        <Card style={[styles.metricCard, styles.metricCardRight]}>
          <Text style={styles.metricLabel}>Skin Temp</Text>
          <Text style={styles.metricValue}>{data.metrics.temp_mean} C</Text>
        </Card>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Last updated {formatTime(data.timestamp)}
        </Text>
        {dbError ? <Text style={styles.syncError}>{dbError}</Text> : null}
      </View>

      <Separator style={styles.separator} />

      <Card style={styles.aiCard}>
        <Text style={styles.aiTitle}>Coach</Text>
        <Text style={styles.aiSubtitle}>
          Generates a short insight using your current state and environment data.
        </Text>
        <View style={styles.llmRow}>
          <SiriOrb
            size={70}
            active={envLoading || llmLoading}
          />
          <View style={styles.chatBubble}>
            <Text
              style={[
                styles.chatText,
                llmMessageTone === "error" && styles.chatError,
              ]}
            >
              {llmMessage}
            </Text>
            <View style={styles.chatTail} />
          </View>
        </View>
        <View style={styles.aiActions}>
          <Button
            onPress={handleGenerate}
            disabled={!envContext || llmLoading || envLoading}
            loading={llmLoading}
          >
            Generate Insight
          </Button>
          {llmResponse ? (
            <Button variant="outline" size="sm" onPress={handleClear}>
              Clear
            </Button>
          ) : null}
          {envError ? (
            <Button variant="secondary" size="sm" onPress={reload}>
              Retry Environment
            </Button>
          ) : null}
        </View>
      </Card>

      <Button size="lg" onPress={handleStartBreathing} style={styles.breathingButton}>
        Start Box Breathing
      </Button>
    </Screen>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.lg,
    },
    greeting: {
      ...typography.title,
      color: colors.textPrimary,
    },
    subtle: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: spacing.xxs,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
    },
    statusCard: {
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    statusLabel: {
      ...typography.overline,
      marginBottom: spacing.xs,
    },
    statusValue: {
      ...typography.display,
      marginBottom: spacing.xs,
    },
    confidence: {
      ...typography.bodyEmphasis,
    },
    metricsRow: {
      flexDirection: "row",
      marginBottom: spacing.md,
    },
    metricCard: {
      flex: 1,
      padding: spacing.md,
    },
    metricCardRight: {
      marginLeft: spacing.sm,
    },
    metricLabel: {
      ...typography.overline,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    metricValue: {
      ...typography.metric,
      color: colors.textPrimary,
    },
    footer: {
      marginTop: spacing.xs,
    },
    footerText: {
      ...typography.caption,
      color: colors.textSubtle,
    },
    syncError: {
      ...typography.caption,
      color: colors.warning,
      marginTop: spacing.xxs,
    },
    separator: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      opacity: 0.6,
    },
    aiCard: {
      padding: spacing.md,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    aiTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    aiSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    llmRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    chatBubble: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      position: "relative",
    },
    chatTail: {
      position: "absolute",
      left: -6,
      top: 20,
      width: 14,
      height: 14,
      backgroundColor: colors.surfaceAlt,
      borderLeftWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      transform: [{ rotate: "45deg" }],
    },
    chatText: {
      ...typography.bodySm,
      color: colors.textPrimary,
    },
    chatError: {
      color: colors.warning,
    },
    aiActions: {
      gap: spacing.xs,
    },
    breathingButton: {
      marginTop: spacing.lg,
      alignSelf: "stretch",
    },
  });
