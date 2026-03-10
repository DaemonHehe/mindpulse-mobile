import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import LeafletMap from "../components/LeafletMap";
import { radius } from "../constants/theme";
import { useThemeColors } from "../hooks/useThemeColors";
import GradientBackdrop from "../components/GradientBackdrop";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Spinner } from "../../components/ui/spinner";
import { useEnvironmentalContext } from "../hooks/useEnvironmentalContext";
import { formatNumber, formatNumberWithUnit } from "../utils/format";

const screenWidth = Dimensions.get("window").width;

const events = [
  { id: "1", title: "Yesterday at 2:00 PM", duration: "15 mins duration" },
  { id: "2", title: "Sunday at 10:20 AM", duration: "8 mins duration" },
  { id: "3", title: "Friday at 6:45 PM", duration: "12 mins duration" },
];

export default function InsightsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: envContext, loading: envLoading, error: envError, reload } =
    useEnvironmentalContext();

  const chartData = useMemo(
    () => ({
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [
        {
          data: [22, 45, 30, 68, 40, 55, 28],
          color: (opacity = 1) => `rgba(${colors.accentRgb}, ${opacity})`,
          strokeWidth: 3,
        },
      ],
    }),
    [colors]
  );

  const chartConfig = useMemo(
    () => ({
      backgroundGradientFrom: colors.surface,
      backgroundGradientTo: colors.surface,
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(${colors.accentRgb}, ${opacity})`,
      labelColor: () => colors.textSubtle,
      propsForDots: {
        r: "4",
        strokeWidth: "2",
        stroke: colors.accent,
      },
      propsForBackgroundLines: {
        stroke: colors.border,
      },
    }),
    [colors]
  );

  const temperatureLabel = formatNumberWithUnit(
    envContext?.weather.temperatureC,
    "C",
    1
  );
  const feelsLikeLabel = formatNumberWithUnit(
    envContext?.weather.feelsLikeC,
    "C",
    1
  );
  const humidityLabel = formatNumberWithUnit(
    envContext?.weather.humidityPercent,
    "%",
    0
  );
  const windLabel = formatNumberWithUnit(
    envContext?.weather.windSpeed,
    " m/s",
    1
  );
  const aqiLabel = formatNumber(envContext?.air.usAqi, 0);

  return (
    <View style={styles.screen}>
      <GradientBackdrop />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
      <Text style={styles.title}>Weekly Stress</Text>

      <Card style={styles.chartCard}>
        <LineChart
          data={chartData}
          width={Math.max(screenWidth - 40, 320)}
          height={220}
          withShadow={false}
          withInnerLines={true}
          withOuterLines={false}
          fromZero={true}
          bezier
          chartConfig={chartConfig}
          style={styles.chart}
        />
      </Card>

      <Text style={styles.sectionTitle}>Recent Stress Events</Text>
      {events.map((event) => (
        <Card key={event.id} style={styles.eventCard}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventDuration}>{event.duration}</Text>
        </Card>
      ))}

      <Text style={styles.sectionTitle}>Environmental Context</Text>
      <Card style={styles.envCard}>
        {envLoading ? (
          <View style={styles.envLoadingRow}>
            <Spinner size="sm" variant="dots" />
            <Text style={styles.envStatus}>Loading environment data...</Text>
          </View>
        ) : envError ? (
          <>
            <Text style={styles.envError}>{envError}</Text>
            <Button variant="secondary" size="sm" onPress={reload}>
              Retry
            </Button>
          </>
        ) : (
          <>
            <LeafletMap
              latitude={envContext.location.latitude}
              longitude={envContext.location.longitude}
            />
            <Text style={styles.envLocation}>{envContext.location.label}</Text>
            <Text style={styles.envSummary}>{envContext.weather.weatherLabel}</Text>
            <View style={styles.envRow}>
              <View style={styles.envItem}>
                <Text style={styles.envLabel}>Temp</Text>
                <Text style={styles.envValue}>{temperatureLabel}</Text>
                <Text style={styles.envMeta}>Feels {feelsLikeLabel}</Text>
              </View>
              <View style={styles.envItem}>
                <Text style={styles.envLabel}>Humidity</Text>
                <Text style={styles.envValue}>{humidityLabel}</Text>
                <Text style={styles.envMeta}>Wind {windLabel}</Text>
              </View>
              <View style={styles.envItem}>
                <Text style={styles.envLabel}>US AQI</Text>
                <Text style={styles.envValue}>{aqiLabel}</Text>
              </View>
            </View>
            <Text style={styles.envSource}>
              Data: Open-Meteo, CAMS. Map: OpenStreetMap.
            </Text>
          </>
        )}
      </Card>
    </ScrollView>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 54,
      paddingBottom: 32,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "600",
      marginBottom: 16,
    },
    chartCard: {
      paddingVertical: 12,
      paddingHorizontal: 8,
      marginBottom: 20,
    },
    chart: {
      borderRadius: radius.md,
      alignSelf: "center",
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 10,
    },
    eventCard: {
      padding: 14,
      marginBottom: 10,
    },
    eventTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "500",
      marginBottom: 6,
    },
    eventDuration: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    envCard: {
      padding: 14,
      marginBottom: 20,
    },
    envStatus: {
      color: colors.textMuted,
      fontSize: 12,
    },
    envLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    envError: {
      color: colors.warning,
      fontSize: 12,
      marginBottom: 10,
    },
    envLocation: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
      marginTop: 12,
      marginBottom: 6,
    },
    envSummary: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 10,
    },
    envRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    envItem: {
      flex: 1,
    },
    envLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 4,
    },
    envValue: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    envMeta: {
      color: colors.textSubtle,
      fontSize: 10,
      marginTop: 2,
    },
    envSource: {
      color: colors.textSubtle,
      fontSize: 10,
    },
  });
