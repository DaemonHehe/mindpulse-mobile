import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { shadow } from "../constants/theme";
import { useThemeColors, useThemeScheme } from "../hooks/useThemeColors";

export default function SiriOrb({ size = 72, active = true }) {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const isDark = scheme === "dark";
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pulse = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withTiming(1, {
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );
      spin.value = withRepeat(
        withTiming(1, { duration: 6000, easing: Easing.linear }),
        -1
      );
    } else {
      pulse.value = withTiming(0, { duration: 400 });
      spin.value = withTiming(0, { duration: 400 });
    }
  }, [active, pulse, spin]);

  const glowStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [0.92, 1.25]);
    const opacity = interpolate(pulse.value, [0, 1], [0.18, 0.6]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const orbStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [0.98, 1.06]);
    return {
      transform: [{ scale }],
    };
  });

  const sheenStyle = useAnimatedStyle(() => {
    const rotate = interpolate(spin.value, [0, 1], [0, 360]);
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.glow,
          {
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(0, 0, 0, 0.12)",
          },
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          glowStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          { width: size, height: size, borderRadius: size / 2 },
          orbStyle,
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? ["#2F2F2F", "#3A3A3A", "#1E1E1E"]
              : ["#141414", "#2A2A2A", "#0C0C0C"]
          }
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={[styles.orbLayer, { borderRadius: size / 2 }]}
        />
        <Animated.View style={[styles.sheen, sheenStyle]}>
          <LinearGradient
            colors={["rgba(255,255,255,0.4)", "rgba(255,255,255,0)"]}
            start={{ x: 0.1, y: 0.2 }}
            end={{ x: 0.9, y: 0.8 }}
            style={[styles.sheenLayer, { borderRadius: size / 2 }]}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      justifyContent: "center",
    },
    glow: {
      position: "absolute",
    },
    orb: {
      ...shadow.soft,
      overflow: "hidden",
      backgroundColor: colors.surfaceAlt,
    },
    orbLayer: {
      flex: 1,
    },
    sheen: {
      ...StyleSheet.absoluteFillObject,
    },
    sheenLayer: {
      flex: 1,
      opacity: 0.6,
    },
  });
