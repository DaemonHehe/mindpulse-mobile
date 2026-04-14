import {
  SENSOR_RANGES,
  clamp,
  isFiniteWithin,
  normalizeTemperatureCelsius,
  roundTo,
  toFiniteNumber,
} from "../../utils/biometric";

export const STRESS_THRESHOLD_HR = 95;
export const REMOTE_PREDICTION_WINDOW_MS = 60 * 1000;
export const REMOTE_PREDICTION_STRIDE_MS = 30 * 1000;
export const DETECT_WINDOW_SEC = REMOTE_PREDICTION_WINDOW_MS / 1000;

const average = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const round1 = (value) => roundTo(value, 1);
const round2 = (value) => roundTo(value, 2);

export const sanitizeBiometricWindowForDb = (window) => {
  if (!window || typeof window !== "object") {
    return null;
  }

  const hr = toFiniteNumber(window.hr_mean);
  const hrv = toFiniteNumber(window.hrv_sdnn);
  const temp = normalizeTemperatureCelsius(window.temp_mean);
  const edaPeaks = toFiniteNumber(window.eda_peaks);

  if (!isFiniteWithin(hr, SENSOR_RANGES.hrBpm.min, SENSOR_RANGES.hrBpm.max)) {
    return null;
  }

  if (!isFiniteWithin(temp, SENSOR_RANGES.tempC.min, SENSOR_RANGES.tempC.max)) {
    return null;
  }

  if (!Number.isFinite(edaPeaks)) {
    return null;
  }

  return {
    ...window,
    hr_mean: round1(clamp(hr, SENSOR_RANGES.hrBpm.min, SENSOR_RANGES.hrBpm.max)),
    hrv_sdnn: round1(
      clamp(
        Number.isFinite(hrv) ? hrv : 0,
        SENSOR_RANGES.hrvSdnn.min,
        SENSOR_RANGES.hrvSdnn.max
      )
    ),
    temp_mean: round1(clamp(temp, SENSOR_RANGES.tempC.min, SENSOR_RANGES.tempC.max)),
    eda_peaks: Math.round(
      clamp(edaPeaks, SENSOR_RANGES.edaPeaks.min, SENSOR_RANGES.edaPeaks.max)
    ),
  };
};

export const createInitialData = () => ({
  timestamp: null,
  metrics: {
    hr_mean: null,
    hrv_sdnn: null,
    temp_mean: null,
    eda_peaks: null,
  },
  ml_prediction: {
    state: "-",
    confidence: null,
    rf_confidence: null,
    lstm_confidence: null,
    fused_score: null,
  },
});

export const buildPrediction = (metrics, prevTemp) => {
  const hr = toFiniteNumber(metrics?.hr_mean);
  const hrv = toFiniteNumber(metrics?.hrv_sdnn);
  const temp = normalizeTemperatureCelsius(metrics?.temp_mean);
  const edaPeaks = toFiniteNumber(metrics?.eda_peaks);
  const baselineTemp =
    Number.isFinite(prevTemp) || prevTemp === 0
      ? normalizeTemperatureCelsius(prevTemp)
      : temp;

  if (
    ![hr, hrv, temp, edaPeaks, baselineTemp].every((value) =>
      Number.isFinite(value)
    )
  ) {
    return {
      state: "-",
      confidence: null,
      rf_confidence: null,
      lstm_confidence: null,
      fused_score: null,
    };
  }

  const tempDropped = temp < baselineTemp;
  const stressed =
    hr > STRESS_THRESHOLD_HR && (tempDropped || edaPeaks >= 4 || hrv < 35);

  const rfConfidence = stressed
    ? clamp(0.68 + (hr - 90) / 40, 0.68, 0.96)
    : clamp(0.84 - Math.max(edaPeaks - 1, 0) * 0.04, 0.62, 0.92);
  const lstmConfidence = stressed
    ? clamp(0.66 + (34 - Math.min(temp, 34)) * 0.12, 0.67, 0.95)
    : clamp(0.83 - Math.max(32 - hrv / 2, 0) * 0.02, 0.64, 0.93);
  const fusedScore = round2((rfConfidence + lstmConfidence) / 2);

  return {
    state: stressed ? "Stressed" : "Relaxed",
    confidence: fusedScore,
    rf_confidence: round2(rfConfidence),
    lstm_confidence: round2(lstmConfidence),
    fused_score: fusedScore,
  };
};

export const mergeMetrics = (currentMetrics, nextMetrics) => ({
  hr_mean: nextMetrics.hr_mean ?? currentMetrics.hr_mean,
  hrv_sdnn: nextMetrics.hrv_sdnn ?? currentMetrics.hrv_sdnn,
  temp_mean:
    normalizeTemperatureCelsius(nextMetrics.temp_mean) ?? currentMetrics.temp_mean,
  eda_peaks: nextMetrics.eda_peaks ?? currentMetrics.eda_peaks,
});

const toWindowTimestampMs = (reading) => {
  const parsed = Date.parse(reading?.timestamp ?? "");
  return Number.isFinite(parsed) ? parsed : Date.now();
};

export const appendBleWindowSample = (
  samples,
  reading,
  windowMs = REMOTE_PREDICTION_WINDOW_MS
) => {
  const raw = reading?.raw;
  const metrics = reading?.metrics;

  if (!raw || !metrics) {
    return samples;
  }

  const timestampMs = toWindowTimestampMs(reading);
  const sample = {
    timestampMs,
    acc_x: Number(raw.acc_x),
    acc_y: Number(raw.acc_y),
    acc_z: Number(raw.acc_z),
    temp: Number(normalizeTemperatureCelsius(metrics.temp_mean)),
    hr: Number(metrics.hr_mean),
    bvp: Number(raw.ir_value),
    ppg_samples: Array.isArray(raw.ppg_samples)
      ? raw.ppg_samples.map(Number).filter((value) => Number.isFinite(value))
      : [],
    eda: Number(raw.eda_raw ?? metrics.eda_peaks),
    eda_display: Number(metrics.eda_peaks ?? raw.eda_raw),
  };

  if (
    ![
      sample.acc_x,
      sample.acc_y,
      sample.acc_z,
      sample.temp,
      sample.hr,
      sample.bvp,
      sample.eda,
      sample.eda_display,
    ].every((value) => Number.isFinite(value))
  ) {
    return samples;
  }

  if (
    !isFiniteWithin(sample.temp, SENSOR_RANGES.tempC.min, SENSOR_RANGES.tempC.max) ||
    !isFiniteWithin(sample.hr, SENSOR_RANGES.hrBpm.min, SENSOR_RANGES.hrBpm.max) ||
    !isFiniteWithin(sample.eda, SENSOR_RANGES.edaRaw.min, SENSOR_RANGES.edaRaw.max) ||
    !isFiniteWithin(
      sample.eda_display,
      SENSOR_RANGES.edaPeaks.min,
      SENSOR_RANGES.edaPeaks.max
    )
  ) {
    return samples;
  }

  const nextSamples = [...samples, sample];
  const cutoffMs = timestampMs - windowMs;
  return nextSamples.filter((entry) => entry.timestampMs >= cutoffMs);
};

export const buildStressPayloadFromBleWindow = (
  samples,
  windowMs = REMOTE_PREDICTION_WINDOW_MS
) => {
  if (!Array.isArray(samples) || samples.length < 2) {
    return null;
  }

  const nowMs = Date.now();
  const windowStartedAtCutoff = nowMs - windowMs;
  const windowSamples = samples.filter(
    (sample) => sample.timestampMs >= windowStartedAtCutoff
  );

  if (windowSamples.length < 2) {
    return null;
  }

  const windowStartedAt = windowSamples[0]?.timestampMs ?? 0;
  const windowEndedAt = windowSamples[windowSamples.length - 1]?.timestampMs ?? 0;
  const minCoverageMs = windowMs * 0.85;
  if (windowEndedAt - windowStartedAt < minCoverageMs) {
    return null;
  }

  const accX = windowSamples.map((sample) => sample.acc_x);
  const accY = windowSamples.map((sample) => sample.acc_y);
  const accZ = windowSamples.map((sample) => sample.acc_z);
  const temp = windowSamples.map((sample) => sample.temp);
  const hr = windowSamples.map((sample) => sample.hr);
  const ppgSamples = windowSamples.flatMap((sample) => sample.ppg_samples);
  const bvp = ppgSamples.length
    ? ppgSamples
    : windowSamples.map((sample) => sample.bvp);
  const eda = windowSamples.map((sample) => sample.eda);

  return {
    acc_x_raw: accX,
    acc_y_raw: accY,
    acc_z_raw: accZ,
    temp_raw: temp,
    hr_raw: hr,
    bvp_raw: bvp,
    eda_raw: eda,
    acc_x_mean: average(accX),
    acc_y_mean: average(accY),
    acc_z_mean: average(accZ),
    temp_mean: average(temp),
    hr_mean: average(hr),
    bvp_mean: average(bvp),
    eda_mean: average(eda),
    sample_count: windowSamples.length,
    window_seconds: windowMs / 1000,
    window_started_at: new Date(windowStartedAt).toISOString(),
    window_ended_at: new Date(windowEndedAt).toISOString(),
  };
};

export const buildBiometricWindowFromBleWindow = (
  samples,
  fallbackMetrics,
  userId,
  windowMs = REMOTE_PREDICTION_WINDOW_MS
) => {
  const payload = buildStressPayloadFromBleWindow(samples, windowMs);
  if (!payload) {
    return null;
  }

  const windowStartedAtCutoff = Date.parse(payload.window_started_at);
  const windowSamples = samples.filter(
    (sample) => sample.timestampMs >= windowStartedAtCutoff
  );
  const edaDisplayMean = average(
    windowSamples.map((sample) => sample.eda_display)
  );

  return sanitizeBiometricWindowForDb({
    user_id: userId,
    timestamp: payload.window_ended_at,
    hr_mean: round1(payload.hr_mean),
    hrv_sdnn: fallbackMetrics?.hrv_sdnn ?? 0,
    temp_mean: round1(payload.temp_mean),
    eda_peaks: Math.max(0, Math.round(edaDisplayMean)),
  });
};

export const mapSnapshotToData = (snapshot) => {
  const biometricWindow = snapshot?.biometricWindow ?? null;
  const prediction = snapshot?.prediction ?? null;

  if (!biometricWindow && !prediction) {
    return createInitialData();
  }

  const metrics = {
    hr_mean: toFiniteNumber(biometricWindow?.hr_mean),
    hrv_sdnn: toFiniteNumber(biometricWindow?.hrv_sdnn),
    temp_mean: normalizeTemperatureCelsius(biometricWindow?.temp_mean),
    eda_peaks: toFiniteNumber(biometricWindow?.eda_peaks),
  };

  const fusedScore = toFiniteNumber(prediction?.fused_score);
  const rfConfidence = toFiniteNumber(prediction?.rf_confidence);
  const lstmConfidence = toFiniteNumber(prediction?.lstm_confidence);
  const currentPrediction =
    prediction?.final_state && typeof prediction.final_state === "string"
      ? prediction.final_state
      : "-";

  return {
    timestamp: biometricWindow?.timestamp ?? prediction?.created_at ?? null,
    metrics,
    ml_prediction: {
      state: currentPrediction,
      confidence: fusedScore,
      rf_confidence: rfConfidence,
      lstm_confidence: lstmConfidence,
      fused_score: fusedScore,
    },
  };
};
