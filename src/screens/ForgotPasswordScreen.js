import React, { useMemo, useState } from "react";
import { Text, StyleSheet, TextInput, View } from "react-native";
import Screen from "../components/Screen";
import { useThemeColors } from "../hooks/useThemeColors";
import { spacing, radius } from "../constants/theme";
import { typography } from "../constants/typography";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useAuth } from "../contexts/AuthContext";

export default function ForgotPasswordScreen({ navigation }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleReset = async () => {
    if (!email.trim()) {
      setError("Enter the email you used to sign up.");
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setNotice("Password reset email sent. Check your inbox to continue.");
    } catch (err) {
      setError(err?.message ?? "Unable to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={true} contentStyle={styles.content}>
      <Text style={styles.title}>Forgot password</Text>
      <Text style={styles.subtitle}>We will email you a reset link.</Text>

      <Card style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@email.com"
          placeholderTextColor={colors.textMuted}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Button onPress={handleReset} loading={loading} style={styles.primaryButton}>
          Send reset email
        </Button>
      </Card>

      <View style={styles.footer}>
        <Button variant="link" onPress={() => navigation.goBack()}>
          Back to log in
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
