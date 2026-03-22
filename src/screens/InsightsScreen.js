import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import LeafletMap from "../components/LeafletMap";
import { radius, spacing } from "../constants/theme";
import { useThemeColors } from "../hooks/useThemeColors";
import { typography } from "../constants/typography";
import Screen from "../components/Screen";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Spinner } from "../../components/ui/spinner";
import { useEnvironmentalContext } from "../hooks/useEnvironmentalContext";
import {
  formatNumber,
  formatNumberWithUnit,
  formatRatioAsPercent,
} from "../utils/format";
import { useAuth } from "../contexts/AuthContext";
import db from "../services/db";
import { supabase } from "../services/supabase";

const screenWidth = Dimensions.get("window").width;
const REFRESH_INTERVAL_MS = 5000;
const RECENT_STRESS_LIMIT = 5;

const getLocalDayKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const createWeeklyTemplate = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    return {
      key: getLocalDayKey(day),
      label: day.toLocaleDateString(undefined, { weekday: "short" }),
      count: 0,
    };
  });
};

const buildStressInsights = (predictions) => {
  const weeklyTemplate = createWeeklyTemplate();
  const countsByDay = Object.fromEntries(
    weeklyTemplate.map((item) => [item.key, 0])
  );

  predictions.forEach((prediction) => {
    if (prediction.final_state !== "Stressed") return;
    const createdAt = new Date(prediction.created_at);
    if (Number.isNaN(createdAt.getTime())) return;
    const dayKey = getLocalDayKey(createdAt);
    if (dayKey in countsByDay) {
      countsByDay[dayKey] += 1;
    }
  });

  const stressedEvents = predictions
    .filter((prediction) => prediction.final_state === "Stressed")
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, RECENT_STRESS_LIMIT)
    .map((prediction) => {
      const occurredAt = new Date(prediction.created_at);
      const fusedScore = formatRatioAsPercent(prediction.fused_score, 0);
      const rfScore = formatRatioAsPercent(prediction.rf_confidence, 0);
      const lstmScore = formatRatioAsPercent(prediction.lstm_confidence, 0);
      return {
        id: String(prediction.id),
        title: occurredAt.toLocaleString(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        }),
        result: prediction.final_state,
        duration: `Fused ${fusedScore} • RF ${rfScore} • LSTM ${lstmScore}`,
      };
    });

  return {
    labels: weeklyTemplate.map((item) => item.label),
    data: weeklyTemplate.map((item) => countsByDay[item.key] ?? 0),
    events: stressedEvents,
  };
};

export default function InsightsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const [weeklyStress, setWeeklyStress] = useState({
    labels: createWeeklyTemplate().map((item) => item.label),
    data: Array(7).fill(0),
  });
  const [stressEvents, setStressEvents] = useState([]);
  const [stressLoading, setStressLoading] = useState(true);
  const [stressError, setStressError] = useState("");
  const { data: envContext, loading: envLoading, error: envError, reload } =
    useEnvironmentalContext();

  const loadStressInsights = useCallback(
    async (showLoading = false) => {
      if (!user?.id) {
        setStressLoading(false);
        setStressError("");
        setWeeklyStress({
          labels: createWeeklyTemplate().map((item) => item.label),
          data: Array(7).fill(0),
        });
        setStressEvents([]);
        return;
      }

      if (showLoading) {
        setStressLoading(true);
      }

      try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);

        const predictions = await db.getPredictionsInRange(
          user.id,
          start.toISOString(),
          end.toISOString()
        );

        const next = buildStressInsights(predictions || []);
        setWeeklyStress({ labels: next.labels, data: next.data });
        setStressEvents(next.events);
        setStressError("");
      } catch (error) {
        setStressError(error?.message || "Failed to load stress insights.");
      } finally {
        if (showLoading) {
          setStressLoading(false);
        }
      }
    },
    [user?.id]
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      await loadStressInsights(true);
    };
    load();

    if (!user?.id) return undefined;

    const intervalId = setInterval(() => {
      if (active) {
        loadStressInsights(false);
      }
    }, REFRESH_INTERVAL_MS);

    const channel = supabase
      .channel(`insights-predictions-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "predictions_log",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadStressInsights(false);
        }
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [loadStressInsights, user?.id]);

  const chartData = useMemo(
    () => ({
      labels: weeklyStress.labels,
      datasets: [
        {
          data: weeklyStress.data,
          color: (opacity = 1) => `rgba(${colors.accentRgb}, ${opacity})`,
          strokeWidth: 3,
        },
      ],
    }),
    [colors, weeklyStress]
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
    <Screen>
      <Text style={styles.title}>Weekly Stress</Text>

      <Card style={styles.chartCard}>
        {stressLoading ? (
          <View style={styles.stressLoadingRow}>
            <Spinner size="sm" variant="dots" />
            <Text style={styles.envStatus}>Loading stress data...</Text>
          </View>
        ) : stressError ? (
          <>
            <Text style={styles.envError}>{stressError}</Text>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => loadStressInsights(true)}
            >
              Retry
            </Button>
          </>
        ) : (
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
        )}
      </Card>

      <Text style={styles.sectionTitle}>Recent Stress Events</Text>
      {stressEvents.length ? (
        stressEvents.map((event) => (
          <Card key={event.id} style={styles.eventCard}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventResult}>Result: {event.result}</Text>
            <Text style={styles.eventDuration}>{event.duration}</Text>
          </Card>
        ))
      ) : (
        <Card style={styles.eventCard}>
          <Text style={styles.eventDuration}>
            No stressed events recorded in the last 7 days.
          </Text>
        </Card>
      )}

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
    </Screen>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    title: {
      ...typography.title,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    chartCard: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.lg,
    },
    chart: {
      borderRadius: radius.md,
      alignSelf: "center",
    },
    sectionTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    eventCard: {
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    eventTitle: {
      ...typography.bodyEmphasis,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    eventDuration: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    eventResult: {
      ...typography.bodySm,
      color: colors.textPrimary,
      marginBottom: spacing.xxs,
    },
    envCard: {
      padding: spacing.sm,
      marginBottom: spacing.lg,
    },
    envStatus: {
      ...typography.caption,
      color: colors.textMuted,
    },
    envLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    stressLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    envError: {
      ...typography.caption,
      color: colors.warning,
      marginBottom: spacing.sm,
    },
    envLocation: {
      ...typography.bodyEmphasis,
      color: colors.textPrimary,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    envSummary: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    envRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    envItem: {
      flex: 1,
    },
    envLabel: {
      ...typography.overline,
      color: colors.textSecondary,
      marginBottom: spacing.xxs,
    },
    envValue: {
      ...typography.bodyEmphasis,
      color: colors.textPrimary,
    },
    envMeta: {
      ...typography.captionSm,
      color: colors.textSubtle,
      marginTop: spacing.xxs,
    },
    envSource: {
      ...typography.captionSm,
      color: colors.textSubtle,
    },
  });
