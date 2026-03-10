import * as Location from "expo-location";

const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_ENDPOINT = "https://air-quality-api.open-meteo.com/v1/air-quality";

const WEATHER_CODE_LABELS = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Heavy rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

const pickPlaceLabel = (place) => {
  if (!place) return "Current location";
  const city =
    place.city ||
    place.district ||
    place.subregion ||
    place.region ||
    place.name;
  return [city, place.country].filter(Boolean).join(", ") || "Current location";
};

export async function getEnvironmentalContext() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    const error = new Error("Location permission not granted.");
    error.code = "LOCATION_DENIED";
    throw error;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const { latitude, longitude } = position.coords;
  const places = await Location.reverseGeocodeAsync({ latitude, longitude });
  const place = places?.[0] || null;

  const weatherUrl =
    `${WEATHER_ENDPOINT}?latitude=${latitude}` +
    `&longitude=${longitude}` +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m" +
    "&timezone=auto";

  const airUrl =
    `${AIR_QUALITY_ENDPOINT}?latitude=${latitude}` +
    `&longitude=${longitude}` +
    "&current=pm2_5,pm10,us_aqi" +
    "&timezone=auto";

  const [weatherRes, airRes] = await Promise.all([
    fetch(weatherUrl),
    fetch(airUrl),
  ]);

  if (!weatherRes.ok) {
    throw new Error(`Weather request failed (${weatherRes.status}).`);
  }
  if (!airRes.ok) {
    throw new Error(`Air quality request failed (${airRes.status}).`);
  }

  const weatherJson = await weatherRes.json();
  const airJson = await airRes.json();

  const current = weatherJson.current || weatherJson.current_weather || {};
  const airCurrent = airJson.current || {};

  const weatherCode =
    current.weather_code ?? current.weathercode ?? null;

  return {
    location: {
      latitude,
      longitude,
      label: pickPlaceLabel(place),
    },
    weather: {
      temperatureC: current.temperature_2m ?? current.temperature ?? null,
      feelsLikeC: current.apparent_temperature ?? null,
      humidityPercent: current.relative_humidity_2m ?? null,
      windSpeed: current.wind_speed_10m ?? current.windspeed ?? null,
      weatherCode,
      weatherLabel:
        typeof weatherCode === "number"
          ? WEATHER_CODE_LABELS[weatherCode] || "Unknown"
          : "Unknown",
    },
    air: {
      pm2_5: airCurrent.pm2_5 ?? null,
      pm10: airCurrent.pm10 ?? null,
      usAqi: airCurrent.us_aqi ?? null,
    },
    meta: {
      timezone: weatherJson.timezone || airJson.timezone || null,
      fetchedAt: new Date().toISOString(),
    },
  };
}
