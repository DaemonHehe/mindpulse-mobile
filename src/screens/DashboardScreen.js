import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Modal, Animated, Easing } from "react-native";
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
import { formatNumber, formatRatioAsPercent, formatTime } from "../utils/format";
import { buildInsightPrompt } from "../utils/insights";
import { useAuth } from "../contexts/AuthContext";
import { useBle } from "../contexts/BleContext";
import db from "../services/db";
import { predictStress } from "../services/stressPrediction";
import {
  buildBiometricWindowFromBleWindow,
  buildPrediction,
  buildStressPayloadFromBleWindow,
  createInitialData,
  DETECT_WINDOW_SEC,
  mapSnapshotToData,
  mergeMetrics,
  REMOTE_PREDICTION_STRIDE_MS,
  REMOTE_PREDICTION_WINDOW_MS,
  sanitizeBiometricWindowForDb,
  appendBleWindowSample,
} from "./dashboard/pipeline";
import {
  isFiniteWithin,
  normalizeTemperatureCelsius,
  roundTo,
  SENSOR_RANGES,
  toFiniteNumber,
} from "../utils/biometric";

export default function DashboardScreen() {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const {
    deviceName: bleDeviceName,
    isConnected: bleConnected,
    isScanning: bleScanning,
    isConnecting: bleConnecting,
    latestPayload,
    latestReading,
    error: bleError,
  } = useBle();
  const [data, setData] = useState(() => createInitialData());
  const [dbError, setDbError] = useState("");
  const [syncTestMessage, setSyncTestMessage] = useState("");
  const [syncTestLoading, setSyncTestLoading] = useState(false);
  const [detectModalVisible, setDetectModalVisible] = useState(false);
  const [detectCountdownSec, setDetectCountdownSec] = useState(DETECT_WINDOW_SEC);
  const [detectRunning, setDetectRunning] = useState(false);
  const [detectMessage, setDetectMessage] = useState("");
  const bleWindowSamplesRef = useRef([]);
  const predictionInFlightRef = useRef(false);
  const lastRemotePredictionAtRef = useRef(0);
  const detectTimerRef = useRef(null);
  const detectPulseLoopRef = useRef(null);
  const timerScale = useRef(new Animated.Value(1)).current;
  const timerOpacity = useRef(new Animated.Value(1)).current;
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
    return () => {
      if (detectTimerRef.current) {
        clearInterval(detectTimerRef.current);
        detectTimerRef.current = null;
      }
      if (detectPulseLoopRef.current) {
        detectPulseLoopRef.current.stop();
        detectPulseLoopRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!detectRunning) {
      if (detectPulseLoopRef.current) {
        detectPulseLoopRef.current.stop();
        detectPulseLoopRef.current = null;
      }
      timerScale.setValue(1);
      timerOpacity.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(timerScale, {
            toValue: 1.08,
            duration: 550,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(timerOpacity, {
            toValue: 0.72,
            duration: 550,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(timerScale, {
            toValue: 1,
            duration: 550,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(timerOpacity, {
            toValue: 1,
            duration: 550,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    detectPulseLoopRef.current = loop;
    loop.start();

    return () => {
      loop.stop();
      if (detectPulseLoopRef.current === loop) {
        detectPulseLoopRef.current = null;
      }
      timerScale.setValue(1);
      timerOpacity.setValue(1);
    };
  }, [detectRunning, timerOpacity, timerScale]);

  useEffect(() => {
    if (bleConnected) {
      return;
    }

    bleWindowSamplesRef.current = [];
    predictionInFlightRef.current = false;
    lastRemotePredictionAtRef.current = 0;
    if (detectTimerRef.current) {
      clearInterval(detectTimerRef.current);
      detectTimerRef.current = null;
    }
    setDetectRunning(false);
    setSyncTestMessage("");
    setSyncTestLoading(false);
  }, [bleConnected]);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      if (!user?.id) {
        if (!active) return;
        setData(createInitialData());
        setDbError("");
        setSyncTestMessage("");
        return;
      }

      try {
        const snapshot = await db.getLatestDashboardSnapshot(user.id);
        if (!active) return;

        if (snapshot?.biometricWindow || snapshot?.prediction) {
          setData(mapSnapshotToData(snapshot));
        } else {
          setData(createInitialData());
        }
        setDbError("");
      } catch (error) {
        if (!active) return;
        setDbError(error?.message || "Failed to load dashboard data.");
        setData(createInitialData());
      }
    };

    hydrate();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!bleConnected || !latestReading?.metrics) {
      return;
    }

    bleWindowSamplesRef.current = appendBleWindowSample(
      bleWindowSamplesRef.current,
      latestReading
    );

    setDbError("");
    setData((prev) => {
      const metrics = mergeMetrics(prev.metrics, latestReading.metrics);
      return {
        timestamp: latestReading.timestamp || new Date().toISOString(),
        metrics,
        ml_prediction: buildPrediction(metrics, prev.metrics.temp_mean),
      };
    });
  }, [bleConnected, latestReading]);

  useEffect(() => {
    if (!bleConnected || !latestReading?.metrics || !user?.id) {
      return;
    }

    const samples = bleWindowSamplesRef.current;
    const payload = buildStressPayloadFromBleWindow(samples);
    if (!payload) {
      return;
    }

    const now = Date.now();
    if (
      predictionInFlightRef.current ||
      now - lastRemotePredictionAtRef.current < REMOTE_PREDICTION_STRIDE_MS
    ) {
      return;
    }

    predictionInFlightRef.current = true;
    lastRemotePredictionAtRef.current = now;

    const syncPrediction = async () => {
      try {
        const prediction = await predictStress(payload);
        const biometricWindow = buildBiometricWindowFromBleWindow(
          samples,
          latestReading.metrics,
          user.id
        );

        if (!biometricWindow) {
          throw new Error(
            "BLE window is not ready for persistence (waiting for valid sensor range)."
          );
        }

        const snapshot = await db.createBiometricSnapshot(
          biometricWindow,
          {
            user_id: user.id,
            rf_confidence: prediction.rf_confidence,
            lstm_confidence: prediction.lstm_confidence,
            fused_score: prediction.fused_score,
            final_state: prediction.final_state,
          }
        );

        setDbError("");
        setData(mapSnapshotToData(snapshot));
      } catch (error) {
        setDbError(error?.message || "Failed to sync remote prediction.");
      } finally {
        predictionInFlightRef.current = false;
      }
    };

    syncPrediction();
  }, [bleConnected, latestReading, user?.id]);

  const handleStartBreathing = () => {
    navigation.navigate("Intervention");
  };

  const stopDetectTimer = () => {
    if (detectTimerRef.current) {
      clearInterval(detectTimerRef.current);
      detectTimerRef.current = null;
    }
  };

  const closeDetectModal = () => {
    if (detectRunning) {
      return;
    }
    setDetectModalVisible(false);
    setDetectMessage("");
    setDetectCountdownSec(DETECT_WINDOW_SEC);
  };

  const runTimedStressDetection = async () => {
    try {
      if (!bleConnected) {
        throw new Error("Watch disconnected during detection.");
      }

      if (!user?.id) {
        throw new Error("Sign in is required to run model detection.");
      }

      const windowSec = DETECT_WINDOW_SEC;
      const windowMs = REMOTE_PREDICTION_WINDOW_MS;
      const samples = bleWindowSamplesRef.current;
      const payload = buildStressPayloadFromBleWindow(samples, windowMs);
      if (!payload) {
        throw new Error(
          `Need at least ${windowSec}s of BLE data before detection. Keep the watch connected and retry.`
        );
      }

      setDetectMessage("Running model inference...");
      const prediction = await predictStress(payload);
      const finalState =
        typeof prediction?.final_state === "string" && prediction.final_state
          ? prediction.final_state
          : "Relaxed";
      const fusedScore = toFiniteNumber(prediction?.fused_score) ?? 0;
      const rfConfidence = toFiniteNumber(prediction?.rf_confidence) ?? fusedScore;
      const lstmConfidence =
        toFiniteNumber(prediction?.lstm_confidence) ?? fusedScore;

      const biometricWindow = buildBiometricWindowFromBleWindow(
        samples,
        latestReading?.metrics,
        user.id,
        windowMs
      );

      if (!biometricWindow) {
        throw new Error(
          "BLE window is not ready for persistence (waiting for valid sensor range)."
        );
      }

      const snapshot = await db.createBiometricSnapshot(
        biometricWindow,
        {
          user_id: user.id,
          rf_confidence: rfConfidence,
          lstm_confidence: lstmConfidence,
          fused_score: fusedScore,
          final_state: finalState,
        }
      );

      setDbError("");
      setData(mapSnapshotToData(snapshot));
      setSyncTestMessage(
        `Detect stress (${windowSec}s) complete: ${finalState} (${formatRatioAsPercent(
          fusedScore
        )}).`
      );
      setDetectMessage(
        `Detection complete: ${finalState} (${formatRatioAsPercent(fusedScore)}).`
      );
    } catch (error) {
      const message = error?.message || "Stress detection failed.";
      setDbError(message);
      setDetectMessage(message);
    } finally {
      stopDetectTimer();
      setDetectRunning(false);
    }
  };

  const startDetectCountdown = () => {
    if (!bleConnected) {
      setDbError("Watch is disconnected. Connect your device before detection.");
      return;
    }

    const windowSec = DETECT_WINDOW_SEC;
    stopDetectTimer();
    setDbError("");
    setSyncTestMessage("");
    setDetectCountdownSec(windowSec);
    setDetectMessage(`Collecting BLE data for ${windowSec} seconds...`);
    setDetectRunning(true);

    detectTimerRef.current = setInterval(() => {
      setDetectCountdownSec((previous) => {
        if (previous <= 1) {
          setTimeout(() => {
            runTimedStressDetection();
          }, 0);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
  };

  const cancelDetectCountdown = () => {
    stopDetectTimer();
    setDetectRunning(false);
    setDetectMessage("Detection cancelled.");
    setDetectCountdownSec(DETECT_WINDOW_SEC);
  };

  const openDetectModal = () => {
    setDetectModalVisible(true);
    setDetectCountdownSec(DETECT_WINDOW_SEC);
    setDetectMessage("");
  };

  const formatMetricWithUnit = (value, unit, digits = 0) => {
    const formatted = formatNumber(value, digits);
    return formatted === "--" ? "-" : `${formatted} ${unit}`;
  };

  const handleRunSyncTest = async () => {
    setSyncTestMessage("");
    setDbError("");

    if (!bleConnected) {
      setDbError("Watch is disconnected. Connect your device and run the test again.");
      return;
    }

    if (!latestReading) {
      setDbError("No BLE reading received yet. Keep the watch connected and retry.");
      return;
    }

    if (!latestReading.metrics) {
      const payloadPreview =
        typeof latestPayload?.raw === "string"
          ? latestPayload.raw.slice(0, 80)
          : latestPayload
          ? JSON.stringify(latestPayload).slice(0, 80)
          : "";
      setDbError(
        payloadPreview
          ? `BLE payload received but format is unrecognized: ${payloadPreview}`
          : "BLE payload received but format is unrecognized."
      );
      return;
    }

    const liveMetrics = {
      hr_mean: toFiniteNumber(latestReading.metrics.hr_mean),
      hrv_sdnn: toFiniteNumber(latestReading.metrics.hrv_sdnn),
      temp_mean: normalizeTemperatureCelsius(latestReading.metrics.temp_mean),
      eda_peaks: toFiniteNumber(latestReading.metrics.eda_peaks),
    };

    if (
      !isFiniteWithin(
        liveMetrics.hr_mean,
        SENSOR_RANGES.hrBpm.min,
        SENSOR_RANGES.hrBpm.max
      ) ||
      !isFiniteWithin(
        liveMetrics.temp_mean,
        SENSOR_RANGES.tempC.min,
        SENSOR_RANGES.tempC.max
      ) ||
      !isFiniteWithin(
        liveMetrics.eda_peaks,
        SENSOR_RANGES.edaPeaks.min,
        SENSOR_RANGES.edaPeaks.max
      )
    ) {
      setDbError(
        "Device reading is incomplete or out of expected range. Wait for the next packet and try again."
      );
      return;
    }

    if (!user?.id) {
      setSyncTestMessage(
        `Live device data is flowing (${formatTime(
          latestReading.timestamp
        )}), but you are not signed in for database sync.`
      );
      return;
    }

    setSyncTestLoading(true);
    try {
      const prediction = buildPrediction(
        liveMetrics,
        normalizeTemperatureCelsius(data.metrics.temp_mean) ?? liveMetrics.temp_mean
      );

      const biometricWindow = sanitizeBiometricWindowForDb({
          user_id: user.id,
          timestamp: latestReading.timestamp || new Date().toISOString(),
          hr_mean: roundTo(liveMetrics.hr_mean, 1),
          hrv_sdnn: roundTo(liveMetrics.hrv_sdnn ?? 0, 1),
          temp_mean: roundTo(liveMetrics.temp_mean, 1),
          eda_peaks: Math.max(0, Math.round(liveMetrics.eda_peaks)),
        });

      if (!biometricWindow) {
        throw new Error("Current sensor values are outside expected range.");
      }

      const snapshot = await db.createBiometricSnapshot(
        biometricWindow,
        {
          user_id: user.id,
          rf_confidence: prediction.rf_confidence ?? 0,
          lstm_confidence: prediction.lstm_confidence ?? 0,
          fused_score: prediction.fused_score ?? 0,
          final_state: prediction.state === "-" ? "Relaxed" : prediction.state,
        }
      );

      setData(mapSnapshotToData(snapshot));
      setSyncTestMessage(
        `Sync test passed at ${formatTime(
          snapshot?.biometricWindow?.timestamp || latestReading.timestamp
        )}.`
      );
      setDbError("");
    } catch (error) {
      setDbError(error?.message || "Sync test failed.");
    } finally {
      setSyncTestLoading(false);
    }
  };

  const displayState =
    typeof data.ml_prediction.state === "string" && data.ml_prediction.state
      ? data.ml_prediction.state
      : "-";
  const heartRateText = formatMetricWithUnit(data.metrics.hr_mean, "BPM");
  const temperatureText = formatMetricWithUnit(data.metrics.temp_mean, "C", 1);
  const hrvText = formatMetricWithUnit(data.metrics.hrv_sdnn, "", 1).replace(
    /\s+$/,
    ""
  );
  const edaText = formatNumber(data.metrics.eda_peaks);

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
        title: `State: ${displayState}`,
        duration: `Confidence ${formatRatioAsPercent(data.ml_prediction.confidence)}`,
      },
      {
        id: "hr",
        title: `Heart rate ${heartRateText}`,
        duration: `Skin temp ${temperatureText}, HRV ${hrvText}`,
      },
      {
        id: "eda",
        title: `EDA peaks ${edaText}`,
        duration: `Updated ${formatTime(data.timestamp)}`,
      },
    ],
    [data, displayState, edaText, heartRateText, hrvText, temperatureText]
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
          <Badge variant={bleConnected ? "success" : "destructive"}>
            {bleConnected ? `${bleDeviceName} Connected` : "Watch Disconnected"}
          </Badge>
        </View>
      </View>

      <Card style={[styles.statusCard, { backgroundColor: statusColors.card }]}>
        <Text style={[styles.statusLabel, { color: statusColors.text }]}>
          Current State
        </Text>
        <Text style={[styles.statusValue, { color: statusColors.accent }]}>
          {displayState}
        </Text>
        <Text style={[styles.confidence, { color: statusColors.text }]}>
          Confidence {formatRatioAsPercent(data.ml_prediction.confidence)}
        </Text>
      </Card>

      <View style={styles.metricsRow}>
        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>Heart Rate</Text>
          <Text style={styles.metricValue}>{heartRateText}</Text>
        </Card>
        <Card style={[styles.metricCard, styles.metricCardRight]}>
          <Text style={styles.metricLabel}>Skin Temp</Text>
          <Text style={styles.metricValue}>{temperatureText}</Text>
        </Card>
      </View>

      <Button
        size="lg"
        onPress={openDetectModal}
        style={styles.detectStressButton}
      >
        Detect Stress
      </Button>

      <Button
        variant="outline"
        size="sm"
        onPress={handleRunSyncTest}
        loading={syncTestLoading}
        disabled={bleConnecting || bleScanning}
        style={styles.testSyncButton}
      >
        Test Device Sync
      </Button>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Last updated {formatTime(data.timestamp)}
        </Text>
        {syncTestMessage ? (
          <Text style={styles.syncSuccess}>{syncTestMessage}</Text>
        ) : null}
        {bleError ? <Text style={styles.syncError}>{bleError}</Text> : null}
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

      <Modal
        transparent
        animationType="fade"
        visible={detectModalVisible}
        onRequestClose={closeDetectModal}
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Detect Stress</Text>
            <Text style={styles.modalSubtitle}>
              Keep your watch connected.
            </Text>

            <Text style={styles.timerLabel}>Countdown</Text>
            <Animated.Text
              style={[
                styles.timerValue,
                detectRunning && styles.timerValueActive,
                {
                  transform: [{ scale: timerScale }],
                  opacity: timerOpacity,
                },
              ]}
            >
              {`${detectCountdownSec}s`}
            </Animated.Text>

            {detectMessage ? (
              <Text
                style={[
                  styles.detectMessage,
                  detectRunning ? styles.detectMessageActive : styles.detectMessageIdle,
                ]}
              >
                {detectMessage}
              </Text>
            ) : null}

            {detectRunning ? (
              <Button variant="destructive" onPress={cancelDetectCountdown}>
                Cancel
              </Button>
            ) : (
              <Button onPress={startDetectCountdown}>Start Detection (60s)</Button>
            )}

            <Button variant="outline" size="sm" onPress={closeDetectModal}>
              Close
            </Button>
          </Card>
        </View>
      </Modal>
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
    syncSuccess: {
      ...typography.caption,
      color: colors.success ?? colors.accent,
      marginTop: spacing.xxs,
    },
    syncError: {
      ...typography.caption,
      color: colors.warning,
      marginTop: spacing.xxs,
    },
    testSyncButton: {
      alignSelf: "stretch",
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
    },
    detectStressButton: {
      alignSelf: "stretch",
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
    modalCard: {
      alignSelf: "stretch",
      gap: spacing.sm,
    },
    modalTitle: {
      ...typography.titleSm,
      color: colors.textPrimary,
    },
    modalSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    timerLabel: {
      ...typography.overline,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    timerValue: {
      ...typography.display,
      color: colors.textPrimary,
    },
    timerValueActive: {
      color: colors.accent,
      textShadowColor: "rgba(0,0,0,0.18)",
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 6,
    },
    timerHint: {
      ...typography.caption,
      color: colors.textMuted,
      marginBottom: spacing.xs,
    },
    detectMessage: {
      ...typography.bodySm,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      marginBottom: spacing.xs,
    },
    detectMessageActive: {
      color: colors.textPrimary,
      backgroundColor: colors.surfaceAlt,
    },
    detectMessageIdle: {
      color: colors.textSecondary,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
