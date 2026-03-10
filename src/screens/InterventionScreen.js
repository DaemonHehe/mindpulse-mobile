import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";
import { useNavigation } from "@react-navigation/native";

const phases = ["Inhale", "Hold", "Exhale"];

export default function InterventionScreen() {
  const navigation = useNavigation();
  const scale = useRef(new Animated.Value(0.85)).current;
  const [phase, setPhase] = useState(phases[0]);

  useEffect(() => {
    const inhale = Animated.timing(scale, {
      toValue: 1.15,
      duration: 4000,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    const hold = Animated.timing(scale, {
      toValue: 1.15,
      duration: 4000,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    const exhale = Animated.timing(scale, {
      toValue: 0.85,
      duration: 4000,
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
    }, 4000);

    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>Box Breathing</Text>
        <Text style={styles.subtitle}>Follow the circle and breathe</Text>

        <View style={styles.animationWrap}>
          <Animated.View style={[styles.circle, { transform: [{ scale }] }]} />
          <Text style={styles.phase}>{phase}</Text>
        </View>

        <View style={styles.timerRow}>
          <Text style={styles.timerText}>4s inhale</Text>
          <Text style={styles.timerText}>4s hold</Text>
          <Text style={styles.timerText}>4s exhale</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>I feel better</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(11, 31, 34, 0.88)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#0E2A2E",
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: "#12363A",
    alignItems: "center",
  },
  title: {
    color: "#EAF6F6",
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 6,
  },
  subtitle: {
    color: "#7AA5A5",
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
    backgroundColor: "rgba(55, 227, 178, 0.12)",
    borderWidth: 2,
    borderColor: "#37E3B2",
  },
  phase: {
    color: "#EAF6F6",
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
    color: "#88AEB2",
    fontSize: 12,
  },
  button: {
    backgroundColor: "#37E3B2",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: "#042F2A",
    fontWeight: "700",
  },
});
