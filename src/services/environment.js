import * as Location from "expo-location";

const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_ENDPOINT = "https://air-quality-api.open-meteo.com/v1/air-quality";
const REQUEST_TIMEOUT_MS = 10000;
const AIR_QUALITY_TIMEOUT_MS = 5000;
const LAST_KNOWN_MAX_AGE_MS = 30 * 60 * 1000;
const LAST_KNOWN_REQUIRED_ACCURACY_M = 5000;

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

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const createLocationError = (message, code, cause) => {
  const error = new Error(message);
  error.code = code;
  if (cause) {
    error.cause = cause;
  }
  return error;
};

const ensureForegroundLocationPermission = async () => {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.granted) {
    return permission;
  }

  if (permission.canAskAgain === false) {
    throw createLocationError(
      "Location permission is blocked. Enable location access in system settings to load environmental context.",
      "LOCATION_DENIED"
    );
  }

  try {
    permission = await Location.requestForegroundPermissionsAsync();
  } catch (error) {
    throw createLocationError(
      "Unable to request location permission right now. Retry after the screen finishes loading.",
      "LOCATION_PERMISSION_REQUEST_FAILED",
      error
    );
  }

  if (!permission.granted) {
    throw createLocationError(
      permission.canAskAgain === false
        ? "Location permission is blocked. Enable location access in system settings to load environmental context."
        : "Location permission is required to load environmental context.",
      "LOCATION_DENIED"
    );
  }

  return permission;
};

const getBestAvailablePosition = async () => {
  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: true,
    });
  } catch (error) {
    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: LAST_KNOWN_REQUIRED_ACCURACY_M,
    });

    if (lastKnown) {
      return lastKnown;
    }

    throw createLocationError(
      "Current location is unavailable. Enable device location and retry environmental context.",
      "LOCATION_UNAVAILABLE",
      error
    );
  }
};

export async function getEnvironmentalContext() {
  await ensureForegroundLocationPermission();

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw createLocationError(
      "Location services are disabled. Turn on device location to load environmental context.",
      "LOCATION_DISABLED"
    );
  }

  const position = await getBestAvailablePosition();
  const { latitude, longitude } = position.coords;
  let place = null;
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    place = places?.[0] || null;
  } catch (error) {
    place = null;
  }

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

  let weatherRes;
  let airRes = null;
  let airQualityError = "";

  try {
    weatherRes = await fetchWithTimeout(weatherUrl);
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? "Environment request timed out."
        : "Failed to reach weather data provider.";
    throw new Error(message);
  }

  if (!weatherRes.ok) {
    throw new Error(`Weather request failed (${weatherRes.status}).`);
  }

  try {
    airRes = await fetchWithTimeout(airUrl, {}, AIR_QUALITY_TIMEOUT_MS);
    if (!airRes.ok) {
      throw new Error(`Air quality request failed (${airRes.status}).`);
    }
  } catch (error) {
    airQualityError =
      error?.name === "AbortError"
        ? "Air quality request timed out."
        : error?.message || "Failed to reach air quality data provider.";
  }

  const weatherJson = await weatherRes.json();
  const airJson = airRes?.ok ? await airRes.json() : {};

  const current = weatherJson.current || weatherJson.current_weather || {};
  const airCurrent = airJson.current || {};

  const weatherCodeRaw =
    current.weather_code ?? current.weathercode ?? null;
  const weatherCode = Number.isFinite(weatherCodeRaw)
    ? weatherCodeRaw
    : toNumber(weatherCodeRaw);

  return {
    location: {
      latitude,
      longitude,
      label: pickPlaceLabel(place),
    },
    weather: {
      temperatureC: toNumber(current.temperature_2m ?? current.temperature),
      feelsLikeC: toNumber(current.apparent_temperature),
      humidityPercent: toNumber(current.relative_humidity_2m),
      windSpeed: toNumber(current.wind_speed_10m ?? current.windspeed),
      weatherCode,
      weatherLabel:
        typeof weatherCode === "number"
          ? WEATHER_CODE_LABELS[weatherCode] || "Unknown"
          : "Unknown",
    },
    air: {
      pm2_5: toNumber(airCurrent.pm2_5),
      pm10: toNumber(airCurrent.pm10),
      usAqi: toNumber(airCurrent.us_aqi),
      available: !airQualityError,
    },
    meta: {
      timezone: weatherJson.timezone || airJson.timezone || null,
      fetchedAt: new Date().toISOString(),
      airQualityError,
    },
  };
}
