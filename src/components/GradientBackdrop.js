import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, Pattern, Rect, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeColors, useThemeScheme } from "../hooks/useThemeColors";

export default function GradientBackdrop() {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const isDark = scheme === "dark";
  const dotOpacity = isDark ? 0.28 : 0.55;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[colors.background, colors.surface]}
        start={{ x: 0.4, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Svg style={StyleSheet.absoluteFillObject}>
        <Defs>
          <Pattern
            id="dotPattern"
            x="0"
            y="0"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <Circle cx="1.6" cy="1.6" r="1.4" fill={colors.textSubtle} />
          </Pattern>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#dotPattern)"
          opacity={dotOpacity}
        />
      </Svg>
    </View>
  );
}
