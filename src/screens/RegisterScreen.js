import React, { useMemo, useState } from "react";
import { Text, StyleSheet, TextInput, View } from "react-native";
import Screen from "../components/Screen";
import { useThemeColors } from "../hooks/useThemeColors";
import { spacing, radius } from "../constants/theme";
import { typography } from "../constants/typography";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useAuth } from "../contexts/AuthContext";

export default function RegisterScreen({ navigation }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);
    try {
      const result = await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      });

      if (result?.needsEmailConfirmation) {
        setNotice("Check your email to confirm your account, then log in.");
      }
    } catch (err) {
      setError(err?.message ?? "Unable to sign up.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={true} contentStyle={styles.content}>
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>Start tracking your recovery insights.</Text>

      <Card style={styles.card}>
        <Text style={styles.label}>Full name</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Alex Morgan"
          placeholderTextColor={colors.textMuted}
        />

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

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Create a password"
          placeholderTextColor={colors.textMuted}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Button onPress={handleRegister} loading={loading} style={styles.primaryButton}>
          Create account
        </Button>
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Button variant="outline" onPress={() => navigation.goBack()}>
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
      gap: spacing.xs,
    },
    footerText: {
      ...typography.bodySm,
      color: colors.textSecondary,
    },
  });
