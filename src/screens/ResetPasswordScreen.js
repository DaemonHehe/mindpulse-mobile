import React, { useMemo, useState } from "react";
import { Text, StyleSheet, TextInput, View } from "react-native";
import Screen from "../components/Screen";
import { useThemeColors } from "../hooks/useThemeColors";
import { spacing, radius } from "../constants/theme";
import { typography } from "../constants/typography";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useAuth } from "../contexts/AuthContext";

export default function ResetPasswordScreen({ navigation }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { updatePassword, recoveryActive, session, clearRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canReset = recoveryActive || !!session;

  const handleUpdate = async () => {
    if (!canReset) {
      setError("Open the reset link from your email first.");
      return;
    }
    if (!password || password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);
    try {
      await updatePassword(password);
      clearRecovery();
      setNotice("Password updated. You can continue.");
      if (navigation.canGoBack()) {
        navigation.navigate("Login");
      }
    } catch (err) {
      setError(err?.message ?? "Unable to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={true} contentStyle={styles.content}>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>Set a new password to continue.</Text>

      <Card style={styles.card}>
        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="New password"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Confirm password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Repeat password"
          placeholderTextColor={colors.textMuted}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Button onPress={handleUpdate} loading={loading} style={styles.primaryButton}>
          Update password
        </Button>
      </Card>

      <View style={styles.footer}>
        <Button variant="link" onPress={() => navigation.goBack()}>
          Back
        </Button>
      </View>
    </Screen>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    content: {
      flexGrow: 1,
      justifyContent: "center",
      paddingTop: spacing.xl,
      paddingBottom: spacing.xl,
    },
    title: {
      ...typography.title,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    card: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    label: {
      ...typography.captionEmphasis,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    error: {
      ...typography.bodySm,
      color: colors.warning,
      marginTop: spacing.xs,
    },
    notice: {
      ...typography.bodySm,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    primaryButton: {
      marginTop: spacing.sm,
      alignSelf: "stretch",
    },
    footer: {
      marginTop: spacing.lg,
      alignItems: "center",
    },
  });
