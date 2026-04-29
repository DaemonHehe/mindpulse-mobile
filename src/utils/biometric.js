export const SENSOR_RANGES = {
  tempC: { min: 20, max: 45 },
  hrBpm: { min: 0, max: 240 },
  hrvSdnn: { min: 0, max: 500 },
  edaRaw: { min: 0, max: 4095 },
  edaPeaks: { min: 0, max: 8 },
};

export const DEFAULT_SKIN_TEMP_C = 32.5;

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

const normalizeTemperatureCandidate = (value) => {
  if (
    isFiniteWithin(
      value,
      SENSOR_RANGES.tempC.min,
      SENSOR_RANGES.tempC.max
    )
  ) {
    return value;
  }

  return null;
};

export const normalizeTemperatureCelsius = (value) => {
  const parsed = toFiniteNumber(value);
  if (!Number.isFinite(parsed)) return null;

  const direct = normalizeTemperatureCandidate(parsed);
  if (direct !== null) {
    return roundTo(direct, 2);
  }

  const kelvin = normalizeTemperatureCandidate(parsed - 273.15);
  if (kelvin !== null) {
    return roundTo(kelvin, 2);
  }

  const centiCelsius = normalizeTemperatureCandidate(parsed / 100);
  if (centiCelsius !== null) {
    return roundTo(centiCelsius, 2);
  }

  const deciCelsius = normalizeTemperatureCandidate(parsed / 10);
  if (deciCelsius !== null) {
    return roundTo(deciCelsius, 2);
  }

  const fahrenheit = normalizeTemperatureCandidate((parsed - 32) * (5 / 9));
  if (fahrenheit !== null) {
    return roundTo(fahrenheit, 2);
  }

  return null;
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
