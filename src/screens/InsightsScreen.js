import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable } from "react-native";
import { LineChart } from "react-native-chart-kit";
import LeafletMap from "../components/LeafletMap";
import { getEnvironmentalContext } from "../services/environment";
import { askOpenRouter } from "../services/openrouter";

const screenWidth = Dimensions.get("window").width;

const chartData = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  datasets: [
    {
      data: [22, 45, 30, 68, 40, 55, 28],
      color: (opacity = 1) => `rgba(55, 227, 178, ${opacity})`,
      strokeWidth: 3,
    },
  ],
};

const events = [
  { id: "1", title: "Yesterday at 2:00 PM", duration: "15 mins duration" },
  { id: "2", title: "Sunday at 10:20 AM", duration: "8 mins duration" },
  { id: "3", title: "Friday at 6:45 PM", duration: "12 mins duration" },
];

export default function InsightsScreen() {
  const [envContext, setEnvContext] = useState(null);
  const [envLoading, setEnvLoading] = useState(true);
  const [envError, setEnvError] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResponse, setLlmResponse] = useState("");

  useEffect(() => {
    let active = true;

    const loadContext = async () => {
      setEnvLoading(true);
      setEnvError("");

      try {
        const data = await getEnvironmentalContext();
        if (!active) return;
        setEnvContext(data);
      } catch (error) {
        if (!active) return;
        setEnvError(
          error?.message || "Failed to load environmental context."
        );
      } finally {
        if (active) setEnvLoading(false);
      }
    };

    loadContext();

    return () => {
      active = false;
    };
  }, []);

  const prompt = useMemo(() => {
    if (!envContext) return "";
    const eventLines = events
      .map((event) => `- ${event.title} (${event.duration})`)
      .join("\n");

    return [
      "You are a concise wellbeing assistant.",
      "Use the following context to generate a short insight and one actionable suggestion.",
      "",
      `Location: ${envContext.location.label}`,
      `Weather: ${envContext.weather.weatherLabel}, ${envContext.weather.temperatureC}C (feels like ${envContext.weather.feelsLikeC}C)`,
      `Humidity: ${envContext.weather.humidityPercent}%`,
      `Wind: ${envContext.weather.windSpeed} m/s`,
      `Air quality (US AQI): ${envContext.air.usAqi}`,
      "",
      "Recent stress events:",
      eventLines,
    ].join("\n");
  }, [envContext]);

  const handleGenerate = async () => {
    if (!envContext || llmLoading) return;

    setLlmLoading(true);
    setLlmError("");

    try {
      const response = await askOpenRouter({
        system: "Keep the response under 80 words.",
        user: prompt,
      });
      setLlmResponse(response);
    } catch (error) {
      setLlmError(error?.message || "Failed to generate insight.");
    } finally {
      setLlmLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weekly Stress</Text>

      <View style={styles.chartCard}>
        <LineChart
          data={chartData}
          width={Math.max(screenWidth - 40, 320)}
          height={220}
          withShadow={false}
          withInnerLines={true}
          withOuterLines={false}
          fromZero={true}
          bezier
          chartConfig={{
            backgroundGradientFrom: "#0E2A2E",
            backgroundGradientTo: "#0E2A2E",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(55, 227, 178, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(122, 165, 165, ${opacity})`,
            propsForDots: {
              r: "4",
              strokeWidth: "2",
              stroke: "#37E3B2",
            },
            propsForBackgroundLines: {
              stroke: "#12363A",
            },
          }}
          style={styles.chart}
        />
      </View>

      <Text style={styles.sectionTitle}>Recent Stress Events</Text>
      {events.map((event) => (
        <View key={event.id} style={styles.eventCard}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventDuration}>{event.duration}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Environmental Context</Text>
      <View style={styles.envCard}>
        {envLoading ? (
          <Text style={styles.envStatus}>Loading environment data...</Text>
        ) : envError ? (
          <Text style={styles.envError}>{envError}</Text>
        ) : (
          <>
            <LeafletMap
              latitude={envContext.location.latitude}
              longitude={envContext.location.longitude}
            />
            <Text style={styles.envLocation}>{envContext.location.label}</Text>
            <View style={styles.envRow}>
              <View style={styles.envItem}>
                <Text style={styles.envLabel}>Temp</Text>
                <Text style={styles.envValue}>
                  {envContext.weather.temperatureC}C
                </Text>
              </View>
              <View style={styles.envItem}>
                <Text style={styles.envLabel}>Humidity</Text>
                <Text style={styles.envValue}>
                  {envContext.weather.humidityPercent}%
                </Text>
              </View>
              <View style={styles.envItem}>
                <Text style={styles.envLabel}>US AQI</Text>
                <Text style={styles.envValue}>{envContext.air.usAqi}</Text>
              </View>
            </View>
            <Text style={styles.envSource}>
              Data: Open-Meteo, CAMS. Map: OpenStreetMap.
            </Text>
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>LLM Insight</Text>
      <View style={styles.aiCard}>
        <Text style={styles.aiSubtitle}>
          Generates a short insight using live environment data.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.aiButton,
            pressed && styles.aiButtonPressed,
            (!envContext || llmLoading) && styles.aiButtonDisabled,
          ]}
          onPress={handleGenerate}
          disabled={!envContext || llmLoading}
        >
          <Text style={styles.aiButtonText}>
            {llmLoading ? "Generating..." : "Generate Insight"}
          </Text>
        </Pressable>
        {llmError ? <Text style={styles.aiError}>{llmError}</Text> : null}
        {llmResponse ? (
          <Text style={styles.aiResponse}>{llmResponse}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1F22",
    paddingHorizontal: 20,
    paddingTop: 54,
  },
  title: {
    color: "#EAF6F6",
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 16,
  },
  chartCard: {
    backgroundColor: "#0E2A2E",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#12363A",
    marginBottom: 20,
  },
  chart: {
    borderRadius: 16,
    alignSelf: "center",
  },
  sectionTitle: {
    color: "#D5F2F2",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  eventCard: {
    backgroundColor: "#0E2A2E",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#12363A",
    marginBottom: 10,
  },
  eventTitle: {
    color: "#EAF6F6",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  eventDuration: {
    color: "#7AA5A5",
    fontSize: 12,
  },
  envCard: {
    backgroundColor: "#0E2A2E",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#12363A",
    marginBottom: 20,
  },
  envStatus: {
    color: "#88AEB2",
    fontSize: 12,
  },
  envError: {
    color: "#FF8A3D",
    fontSize: 12,
  },
  envLocation: {
    color: "#EAF6F6",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
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
    color: "#7AA5A5",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  envValue: {
    color: "#EAF6F6",
    fontSize: 14,
    fontWeight: "600",
  },
  envSource: {
    color: "#6F9BA0",
    fontSize: 10,
  },
  aiCard: {
    backgroundColor: "#0E2A2E",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#12363A",
    marginBottom: 20,
  },
  aiSubtitle: {
    color: "#7AA5A5",
    fontSize: 12,
    marginBottom: 12,
  },
  aiButton: {
    backgroundColor: "#37E3B2",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  aiButtonPressed: {
    opacity: 0.85,
  },
  aiButtonDisabled: {
    opacity: 0.5,
  },
  aiButtonText: {
    color: "#042F2A",
    fontWeight: "700",
  },
  aiError: {
    color: "#FF8A3D",
    fontSize: 12,
    marginBottom: 8,
  },
  aiResponse: {
    color: "#EAF6F6",
    fontSize: 13,
    lineHeight: 18,
  },
});
