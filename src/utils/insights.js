export const buildInsightPrompt = (envContext, events) => {
  if (!envContext) return "";

  const airQuality =
    Number.isFinite(envContext.air?.usAqi) && envContext.air?.available !== false
      ? envContext.air.usAqi
      : "unavailable";

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
    `Air quality (US AQI): ${airQuality}`,
    "",
    "Recent stress events:",
    eventLines,
  ].join("\n");
};
