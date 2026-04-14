export const SENSOR_RANGES = {
  tempC: { min: 20, max: 45 },
  hrBpm: { min: 0, max: 240 },
  hrvSdnn: { min: 0, max: 500 },
  edaRaw: { min: 0, max: 4095 },
  edaPeaks: { min: 0, max: 8 },
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const roundTo = (value, digits = 2) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

export const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const isFiniteWithin = (value, min, max) =>
  Number.isFinite(value) && value >= min && value <= max;

export const normalizeTemperatureCelsius = (value) => {
  const parsed = toFiniteNumber(value);
  if (!Number.isFinite(parsed)) return null;

  let normalized = parsed;

  // Kelvin to Celsius.
  if (normalized >= 170 && normalized <= 400) {
    normalized -= 273.15;
  }

  // Fahrenheit to Celsius fallback.
  if (normalized >= 70 && normalized <= 130) {
    normalized = (normalized - 32) * (5 / 9);
  }

  if (
    !isFiniteWithin(
      normalized,
      SENSOR_RANGES.tempC.min,
      SENSOR_RANGES.tempC.max
    )
  ) {
    return null;
  }

  return roundTo(normalized, 2);
};

export const normalizeEdaPeaks = (value) => {
  const parsed = toFiniteNumber(value);
  if (!Number.isFinite(parsed)) return null;

  if (parsed <= SENSOR_RANGES.edaPeaks.max) {
    return Math.round(clamp(parsed, SENSOR_RANGES.edaPeaks.min, SENSOR_RANGES.edaPeaks.max));
  }

  return Math.round(
    clamp((parsed / SENSOR_RANGES.edaRaw.max) * SENSOR_RANGES.edaPeaks.max, SENSOR_RANGES.edaPeaks.min, SENSOR_RANGES.edaPeaks.max)
  );
};
