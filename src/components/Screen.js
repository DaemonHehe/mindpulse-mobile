import React, { useMemo } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import GradientBackdrop from "./GradientBackdrop";
import { useThemeColors } from "../hooks/useThemeColors";
import { layout } from "../constants/layout";

export default function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (scroll) {
    return (
      <View style={[styles.screen, style]}>
        <GradientBackdrop />
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, style]}>
      <GradientBackdrop />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: layout.screenPaddingX,
      paddingTop: layout.screenPaddingTop,
      paddingBottom: layout.screenPaddingBottom,
    },
  });
