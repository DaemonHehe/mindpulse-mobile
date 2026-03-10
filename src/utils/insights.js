export const buildInsightPrompt = (envContext, events) => {
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
};
