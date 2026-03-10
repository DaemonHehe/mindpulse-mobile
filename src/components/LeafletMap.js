import React, { useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";
import { WebView } from "react-native-webview";
import { radius } from "../constants/theme";
import { useThemeColors, useThemeScheme } from "../hooks/useThemeColors";

export default function LeafletMap({
  latitude,
  longitude,
  height = 220,
  interactive = false,
}) {
  const colors = useThemeColors();
  const scheme = useThemeScheme();
  const isDark = scheme === "dark";
  const styles = useMemo(() => createStyles(colors), [colors]);
  const lat = Number(latitude);
  const lon = Number(longitude);
  const isValid = Number.isFinite(lat) && Number.isFinite(lon);

  const html = useMemo(() => {
    const tileUrl = isDark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    const tileAttribution = isDark
      ? '&copy; OpenStreetMap contributors &copy; CARTO'
      : "&copy; OpenStreetMap contributors";

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map {
        height: 100%;
        margin: 0;
        background: ${colors.surface};
      }
      .leaflet-control-attribution {
        font-size: 10px;
        color: ${colors.textSubtle};
      }
      .leaflet-control-attribution a {
        color: ${colors.textSubtle};
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      var map = L.map("map").setView([${lat}, ${lon}], 13);
      L.tileLayer("${tileUrl}", {
        maxZoom: 19,
        attribution: "${tileAttribution}"
      }).addTo(map);
      L.circleMarker([${lat}, ${lon}], {
        radius: 6,
        color: "${colors.accent}",
        weight: 2,
        fillColor: "${colors.accent}",
        fillOpacity: 0.6
      }).addTo(map);
    </script>
  </body>
</html>`;
  }, [lat, lon, colors, isDark]);

  if (!isValid) {
    return (
      <View style={[styles.container, styles.fallback, { height }]}>
        <Text style={styles.fallbackText}>Location unavailable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        startInLoadingState
        scrollEnabled={false}
        pointerEvents={interactive ? "auto" : "none"}
      />
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      width: "100%",
      borderRadius: radius.md,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    webview: {
      flex: 1,
      backgroundColor: "transparent",
    },
    fallback: {
      alignItems: "center",
      justifyContent: "center",
    },
    fallbackText: {
      color: colors.textMuted,
      fontSize: 12,
    },
  });
