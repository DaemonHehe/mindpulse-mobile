import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { radius, spacing } from "../constants/theme";
import { useThemeColors, useThemeScheme } from "../hooks/useThemeColors";
import { typography } from "../constants/typography";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useAuth } from "../contexts/AuthContext";
import db from "../services/db";

const phases = ["Inhale", "Hold", "Exhale"];
const PHASE_DURATION_MS = 4000;
const SCALE_MIN = 0.85;
const SCALE_MAX = 1.15;

export default function InterventionScreen() {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const isDark = scheme === "dark";
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const scale = useRef(new Animated.Value(SCALE_MIN)).current;
  const startedAtRef = useRef(new Date());
  const interventionIdRef = useRef(null);
  const [phase, setPhase] = useState(phases[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const inhale = Animated.timing(scale, {
      toValue: SCALE_MAX,
      duration: PHASE_DURATION_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    const hold = Animated.timing(scale, {
      toValue: SCALE_MAX,
      duration: PHASE_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    const exhale = Animated.timing(scale, {
      toValue: SCALE_MIN,
      duration: PHASE_DURATION_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });

    const loop = Animated.loop(Animated.sequence([inhale, hold, exhale]));
    loop.start();

    return () => loop.stop();
  }, [scale]);

  useEffect(() => {
    startedAtRef.current = new Date();
    let index = 0;
    setPhase(phases[0]);
    const id = setInterval(() => {
      index = (index + 1) % phases.length;
      setPhase(phases[index]);
    }, PHASE_DURATION_MS);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;

    const startInterventionSession = async () => {
      if (!user?.id) return;

      try {
        const latestPrediction = await db.getLatestPrediction(user.id);
        const draft = await db.insertIntervention({
          user_id: user.id,
          prediction_id: latestPrediction?.id ?? null,
          started_at: startedAtRef.current.toISOString(),
          completed_secs: 1,
          trigger_type: "Manual",
          user_feedback: null,
        });

        if (active) {
          interventionIdRef.current = draft.id;
        }
      } catch (err) {
        if (active) {
          setError(err?.message || "Failed to start breathing session log.");
        }
      }
    };

    startInterventionSession();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleComplete = async () => {
    if (saving) return;
    if (!user?.id) {
      setError("You must be signed in.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const completedSecs = Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current.getTime()) / 1000)
      );

      if (interventionIdRef.current) {
        await db.updateIntervention(interventionIdRef.current, {
          completed_secs: completedSecs,
          user_feedback: "Better",
        });
      } else {
        const latestPrediction = await db.getLatestPrediction(user.id);
        await db.insertIntervention({
          user_id: user.id,
          prediction_id: latestPrediction?.id ?? null,
          started_at: startedAtRef.current.toISOString(),
          completed_secs: completedSecs,
          trigger_type: "Manual",
          user_feedback: "Better",
        });
      }

      navigation.goBack();
    } catch (err) {
      setError(err?.message || "Failed to save breathing session.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <Card style={styles.card}>
        <Text style={styles.title}>Box Breathing</Text>
        <Text style={styles.subtitle}>Follow the circle and breathe</Text>

        <View style={styles.animationWrap}>
          <Animated.View
            style={[
              styles.circle,
              {
                backgroundColor: isDark
                  ? "rgba(242, 242, 242, 0.08)"
                  : "rgba(17, 17, 17, 0.05)",
                transform: [{ scale }],
              },
            ]}
          />
          <Text style={styles.phase}>{phase}</Text>
        </View>

        <View style={styles.timerRow}>
          <Text style={styles.timerText}>4s inhale</Text>
          <Text style={styles.timerText}>4s hold</Text>
          <Text style={styles.timerText}>4s exhale</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button onPress={handleComplete} size="lg" loading={saving} disabled={saving}>
          I feel better
        </Button>
      </Card>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center",
      padding: 24,
    },
    card: {
      borderRadius: radius.xl,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
    },
    title: {
      ...typography.title,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    subtitle: {
      ...typography.bodySm,
      color: colors.textSecondary,
      marginBottom: spacing.xl,
    },
    animationWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
      height: 200,
    },
    circle: {
      width: 160,
      height: 160,
      borderRadius: 80,
      borderWidth: 2,
      borderColor: colors.accent,
    },
    phase: {
      ...typography.titleSm,
      color: colors.textPrimary,
      marginTop: spacing.lg,
    },
    timerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      marginBottom: spacing.lg,
    },
    timerText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    error: {
      ...typography.caption,
      color: colors.warning,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
  });
