import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { radius } from "../constants/theme";
import { useThemeColors, useThemeScheme } from "../hooks/useThemeColors";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";

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
  const scale = useRef(new Animated.Value(SCALE_MIN)).current;
  const [phase, setPhase] = useState(phases[0]);

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
    let index = 0;
    setPhase(phases[0]);
    const id = setInterval(() => {
      index = (index + 1) % phases.length;
      setPhase(phases[index]);
    }, PHASE_DURATION_MS);

    return () => clearInterval(id);
  }, []);

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

        <Button onPress={() => navigation.goBack()} size="lg">
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
      paddingVertical: 28,
      paddingHorizontal: 22,
      alignItems: "center",
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "600",
      marginBottom: 6,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      marginBottom: 24,
    },
    animationWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
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
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "600",
      marginTop: 18,
    },
    timerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      marginBottom: 20,
    },
    timerText: {
      color: colors.textMuted,
      fontSize: 12,
    },
  });
