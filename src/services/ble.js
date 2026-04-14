import { PermissionsAndroid, Platform } from "react-native";
import { decode as decodeBase64 } from "base-64";
import {
  clamp,
  isFiniteWithin,
  normalizeEdaPeaks,
  normalizeTemperatureCelsius,
  toFiniteNumber,
  SENSOR_RANGES,
} from "../utils/biometric";

const DEFAULT_DEVICE_NAME = "MindPulse_Watch";
const DEFAULT_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const DEFAULT_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const DEFAULT_PPG_CHARACTERISTIC_UUID = "d4f9b2d0-7d4a-4f8f-9c79-8b3e25f7c801";
const DEFAULT_SCAN_TIMEOUT_MS = 12000;

let bleManagerInstance = null;

const getBleManagerClass = () => {
  const { BleManager } = require("react-native-ble-plx");
  return BleManager;
};

const toNumber = toFiniteNumber;

const extractNumericTokens = (raw) => {
  if (typeof raw !== "string") return [];
  const matches = raw.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
  if (!matches?.length) return [];
  return matches.map(Number).filter((value) => Number.isFinite(value));
};

const pickSensorTuple = (values) => {
  if (!Array.isArray(values) || values.length < 7) {
    return null;
  }

  const scoreTuple = (tuple) => {
    const [accX, accY, accZ, tempRaw, hr, ir, eda] = tuple;
    const tempC = normalizeTemperatureCelsius(tempRaw);
    let score = 0;

    if (
      [accX, accY, accZ].every(
        (value) => Number.isFinite(value) && value >= -200 && value <= 200
      )
    ) {
      score += 1;
    }
    if (isFiniteWithin(tempC, 20, 45)) score += 3;
    if (isFiniteWithin(hr, 0, 240)) score += 2;
    if (Number.isFinite(ir) && ir >= 0) score += 1;
    if (isFiniteWithin(eda, 0, 4095)) score += 2;

    return score;
  };

  let bestTuple = null;
  let bestScore = -1;

  for (let index = 0; index <= values.length - 7; index += 1) {
    const tuple = values.slice(index, index + 7);
    const score = scoreTuple(tuple);
    if (score > bestScore) {
      bestScore = score;
      bestTuple = tuple;
    }
  }

  if (bestScore < 4) {
    return values.length === 7 ? values : null;
  }

  return bestTuple;
};

export const normalizeUuid = (value) => value?.trim().toLowerCase() ?? "";

export const getBleConfig = () => ({
  deviceName: process.env.EXPO_PUBLIC_BLE_DEVICE_NAME?.trim() || DEFAULT_DEVICE_NAME,
  serviceUuid:
    normalizeUuid(process.env.EXPO_PUBLIC_BLE_SERVICE_UUID) || DEFAULT_SERVICE_UUID,
  characteristicUuid:
    normalizeUuid(process.env.EXPO_PUBLIC_BLE_CHARACTERISTIC_UUID) ||
    DEFAULT_CHARACTERISTIC_UUID,
  ppgCharacteristicUuid:
    normalizeUuid(process.env.EXPO_PUBLIC_BLE_PPG_CHARACTERISTIC_UUID) ||
    DEFAULT_PPG_CHARACTERISTIC_UUID,
});

export const getBleConfigError = () => "";

export const getBleManager = () => {
  if (!bleManagerInstance) {
    const BleManager = getBleManagerClass();
    bleManagerInstance = new BleManager();
  }

  return bleManagerInstance;
};

export const destroyBleManager = async () => {
  if (!bleManagerInstance) return;
  try {
    await bleManagerInstance.destroy();
  } catch (error) {
    console.warn("[BLE] Failed to destroy manager", error?.message ?? String(error));
  } finally {
    bleManagerInstance = null;
  }
};

export const formatBleError = (error, fallback = "Bluetooth request failed.") =>
  error?.reason || error?.message || fallback;

export const requestBlePermissions = async () => {
  if (Platform.OS !== "android") {
    return true;
  }

  if (Platform.Version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);

    return Object.values(result).every(
      (value) => value === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const location = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );

  return location === PermissionsAndroid.RESULTS.GRANTED;
};

export const waitForBluetoothPoweredOn = async (manager, timeoutMs = 10000) => {
  const currentState = await manager.state();
  if (currentState === "PoweredOn") {
    return currentState;
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      subscription?.remove();
      reject(new Error("Bluetooth is not powered on."));
    }, timeoutMs);

    const subscription = manager.onStateChange((state) => {
      if (state !== "PoweredOn") return;
      clearTimeout(timeoutId);
      subscription.remove();
      resolve(state);
    }, true);
  });
};

const matchesPreferredDevice = (device, preferredName) => {
  if (!preferredName) return true;

  const normalizeName = (value) =>
    (value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");

  const name = normalizeName(device?.name || device?.localName);
  if (!name) return false;

  const target = normalizeName(preferredName);
  return name === target || name.includes(target);
};

export const scanForDevice = async ({
  manager,
  serviceUuid,
  preferredName,
  timeoutMs = DEFAULT_SCAN_TIMEOUT_MS,
}) =>
  new Promise(async (resolve, reject) => {
    let settled = false;

    const finish = async (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);

      try {
        await manager.stopDeviceScan();
      } catch (error) {
        // Ignore stop scan failures during teardown.
      }

      callback(value);
    };

    const timeoutId = setTimeout(() => {
      finish(reject, new Error("No BLE device found before scan timeout."));
    }, timeoutMs);

    try {
      await manager.startDeviceScan(
        serviceUuid ? [serviceUuid] : null,
        null,
        (error, device) => {
          if (error) {
            finish(reject, error);
            return;
          }

          if (!device || !matchesPreferredDevice(device, preferredName)) {
            return;
          }

          finish(resolve, device);
        }
      );
    } catch (error) {
      finish(reject, error);
    }
  });

export const decodeBlePayload = (encodedValue) => {
  if (!encodedValue) return null;

  const tryDecode = (value) => {
    try {
      return decodeBase64(value);
    } catch (error) {
      return null;
    }
  };

  const normalizedBase64 = String(encodedValue)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const decoded =
    tryDecode(encodedValue) ??
    (normalizedBase64 !== encodedValue ? tryDecode(normalizedBase64) : null) ??
    String(encodedValue);

  const trimmed = decoded?.trim();

  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return { raw: trimmed };
  }
};

export const decodePpgPayload = (encodedValue) => {
  if (!encodedValue) return [];

  let decoded = "";
  try {
    decoded = decodeBase64(encodedValue);
  } catch (error) {
    return [];
  }

  const byteValues = Array.from(decoded, (char) => char.charCodeAt(0));
  const count = byteValues[0] ?? 0;
  const samples = [];

  for (let index = 0; index < count; index += 1) {
    const offset = 1 + index * 4;
    if (offset + 3 >= byteValues.length) break;

    const sample =
      byteValues[offset] |
      (byteValues[offset + 1] << 8) |
      (byteValues[offset + 2] << 16) |
      (byteValues[offset + 3] << 24);
    samples.push(sample >>> 0);
  }

  return samples;
};

const normalizeEdaSignal = (value) => {
  return normalizeEdaPeaks(value);
};

const parseCsvPayload = (raw) => {
  if (typeof raw !== "string") {
    return null;
  }

  const commaParts = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const commaNumbers = commaParts.map((value) => Number(value));
  const hasValidCommaNumbers =
    commaNumbers.length >= 7 &&
    commaNumbers.every((value) => Number.isFinite(value));
  const numericSeries = hasValidCommaNumbers
    ? commaNumbers
    : extractNumericTokens(raw);
  const selected = pickSensorTuple(numericSeries);

  if (!selected) {
    return null;
  }

  const [accX, accY, accZ, tempC, beatAvg, irValue, edaValue] = selected;
  const nextTemp = normalizeTemperatureCelsius(tempC);
  const nextHr = toNumber(beatAvg);
  const nextIr = toNumber(irValue);
  const nextEdaRaw = toNumber(edaValue);

  return {
    acc_x: toNumber(accX),
    acc_y: toNumber(accY),
    acc_z: toNumber(accZ),
    temp_mean: isFiniteWithin(nextTemp, SENSOR_RANGES.tempC.min, SENSOR_RANGES.tempC.max)
      ? nextTemp
      : null,
    hr_mean: isFiniteWithin(nextHr, SENSOR_RANGES.hrBpm.min, SENSOR_RANGES.hrBpm.max)
      ? nextHr
      : null,
    ir_value: Number.isFinite(nextIr) && nextIr >= 0 ? nextIr : null,
    eda_raw: isFiniteWithin(nextEdaRaw, SENSOR_RANGES.edaRaw.min, SENSOR_RANGES.edaRaw.max)
      ? nextEdaRaw
      : null,
    eda_peaks: normalizeEdaSignal(nextEdaRaw),
  };
};

export const normalizeBleReading = (payload) => {
  if (typeof payload?.raw === "string") {
    const csvMetrics = parseCsvPayload(payload.raw);
    if (csvMetrics) {
      return {
        timestamp: new Date().toISOString(),
        metrics: {
          hr_mean: csvMetrics.hr_mean,
          hrv_sdnn: null,
          temp_mean: csvMetrics.temp_mean,
          eda_peaks: csvMetrics.eda_peaks,
        },
        raw: csvMetrics,
      };
    }
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const source =
    payload.metrics && typeof payload.metrics === "object" ? payload.metrics : payload;
  const nextHr = toNumber(
    source.hr_mean ?? source.hr ?? source.heartRate ?? source.heart_rate
  );
  const nextHrv = toNumber(source.hrv_sdnn ?? source.hrv ?? source.sdnn);
  const nextTemp = normalizeTemperatureCelsius(
    source.temp_mean ??
      source.temp_c ??
      source.temperature ??
      source.temperature_c
  );
  const nextEda = toNumber(source.eda_peaks ?? source.eda ?? source.gsr_peaks);

  const metrics = {
    hr_mean: isFiniteWithin(nextHr, SENSOR_RANGES.hrBpm.min, SENSOR_RANGES.hrBpm.max)
      ? nextHr
      : null,
    hrv_sdnn: Number.isFinite(nextHrv) && nextHrv >= 0 ? nextHrv : null,
    temp_mean: isFiniteWithin(nextTemp, SENSOR_RANGES.tempC.min, SENSOR_RANGES.tempC.max)
      ? nextTemp
      : null,
    eda_peaks: Number.isFinite(nextEda)
      ? Math.round(
          nextEda <= SENSOR_RANGES.edaPeaks.max
            ? clamp(nextEda, SENSOR_RANGES.edaPeaks.min, SENSOR_RANGES.edaPeaks.max)
            : normalizeEdaSignal(nextEda) ?? 0
        )
      : null,
  };

  const hasMetrics = Object.values(metrics).some((value) => value !== null);
  if (!hasMetrics) {
    return {
      timestamp: payload.timestamp || new Date().toISOString(),
      metrics: null,
      raw: payload,
    };
  }

  return {
    timestamp: payload.timestamp || new Date().toISOString(),
    metrics,
    raw: payload,
  };
};
