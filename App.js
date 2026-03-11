import "react-native-gesture-handler";
import React, { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { ThemeProvider, useThemeMode } from "./theme/ThemeProvider";
import { useThemeColors } from "./src/hooks/useThemeColors";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";

import DashboardScreen from "./src/screens/DashboardScreen";
import InsightsScreen from "./src/screens/InsightsScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import InterventionScreen from "./src/screens/InterventionScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./src/screens/ResetPasswordScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();

const iconByRoute = {
  Dashboard: "home",
  Insights: "activity",
  Settings: "settings",
};

function RootTabs() {
  const colors = useThemeColors();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, size }) => {
          const name = iconByRoute[route.name] || "circle";
          return <Feather name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AuthFlow() {
  const { recoveryActive } = useAuth();
  return (
    <AuthStack.Navigator
      key={recoveryActive ? "recovery" : "auth"}
      initialRouteName={recoveryActive ? "ResetPassword" : "Login"}
      screenOptions={{ headerShown: false }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function AppContent() {
  const colors = useThemeColors();
  const { resolvedScheme } = useThemeMode();
  const { session, initializing, recoveryActive } = useAuth();

  const appTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        primary: colors.accent,
      },
    }),
    [colors]
  );

  return (
    <>
      {initializing ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <NavigationContainer theme={appTheme}>
          <StatusBar
            style={resolvedScheme === "dark" ? "light" : "dark"}
            backgroundColor={colors.background}
          />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {session && !recoveryActive ? (
              <>
                <Stack.Screen name="Root" component={RootTabs} />
                <Stack.Screen
                  name="Intervention"
                  component={InterventionScreen}
                  options={{
                    presentation: "transparentModal",
                    animation: "fade",
                  }}
                />
              </>
            ) : (
              <Stack.Screen name="Auth" component={AuthFlow} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
