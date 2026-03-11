import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Switch } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Screen from "../components/Screen";
import { useThemeColors } from "../hooks/useThemeColors";
import { spacing, radius } from "../constants/theme";
import { typography } from "../constants/typography";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useAuth } from "../contexts/AuthContext";

const REMEMBER_EMAIL_KEY = "auth:remember-email";

export default function LoginScreen({ navigation }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(REMEMBER_EMAIL_KEY)
      .then((storedEmail) => {
        if (!active || !storedEmail) return;
        setEmail(storedEmail);
        setRememberEmail(true);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await signIn({ email: email.trim(), password });
      if (rememberEmail) {
        await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      } else {
        await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch (err) {
      setError(err?.message ?? "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={true} contentStyle={styles.content}>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Log in to continue your recovery flow.</Text>

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

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Your password"
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Remember email</Text>
          <Switch
            value={rememberEmail}
            onValueChange={setRememberEmail}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={rememberEmail ? colors.textPrimary : colors.textMuted}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button onPress={handleLogin} loading={loading} style={styles.primaryButton}>
          Log in
        </Button>

        <Button
          variant="link"
          onPress={() => navigation.navigate("ForgotPassword")}
        >
          Forgot password?
        </Button>
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>New here?</Text>
        <Button
          variant="outline"
          onPress={() => navigation.navigate("Register")}
          style={styles.secondaryButton}
        >
          Create an account
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
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.sm,
    },
    switchLabel: {
      ...typography.bodySm,
      color: colors.textSecondary,
    },
    error: {
      ...typography.bodySm,
      color: colors.warning,
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
    secondaryButton: {
      alignSelf: "stretch",
    },
  });
