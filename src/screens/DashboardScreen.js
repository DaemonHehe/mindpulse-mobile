import React, { useEffect, useMemo, useState } from "react";
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

const UPDATE_INTERVAL_MS = 3000;
const STRESS_THRESHOLD_HR = 95;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round1 = (value) => Math.round(value * 10) / 10;

const createInitialData = () => ({
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
});

export default function DashboardScreen() {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState(() => createInitialData());
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
        const stressed = nextHr > STRESS_THRESHOLD_HR && tempDropped;

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
    }, UPDATE_INTERVAL_MS);

    return () => clearInterval(id);
  }, []);

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
        duration: `Skin temp ${data.metrics.temp_mean} C`,
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
      </View>

      <Separator style={styles.separator} />

      <Card style={styles.aiCard}>
        <Text style={styles.aiTitle}>LLM Insight</Text>
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
