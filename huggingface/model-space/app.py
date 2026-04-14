import json
import os

import gradio as gr
import joblib
import numpy as np
import pandas as pd
from huggingface_hub import hf_hub_download
from scipy import signal as scipy_signal

try:
    import biosppy.signals.bvp as bvp_module
except ImportError:
    bvp_module = None


MODEL_REPO_ID = os.getenv("HF_MODEL_REPO_ID", "Kosanberg/randomforest")
MODEL_FILENAME = os.getenv("HF_MODEL_FILENAME", "mindpulse_rf.joblib")
MODEL_VERSION = os.getenv("MODEL_VERSION", "mindpulse-rf-json-v1")
FEATURE_CONTRACT_ID = "mindpulse-rf-17f-v1"
EXPECTED_FEATURE_COLUMNS = [
    "acc_x_mean",
    "acc_y_mean",
    "acc_z_mean",
    "acc_x_std",
    "acc_y_std",
    "acc_z_std",
    "acc_mag_mean",
    "temp_mean",
    "temp_std",
    "temp_slope",
    "hr_mean",
    "hrv_sdnn",
    "hrv_rmssd",
    "eda_mean",
    "eda_std",
    "eda_slope",
    "eda_peaks",
]

FS = {"eda": 4, "temp": 4, "bvp": 64, "acc": 32}
MIN_WINDOW_SAMPLES = 2
MIN_BVP_HRV_SAMPLES = FS["bvp"] * 10


def load_model_bundle():
    model_path = hf_hub_download(repo_id=MODEL_REPO_ID, filename=MODEL_FILENAME)
    loaded_bundle = joblib.load(model_path)

    model = (
        loaded_bundle.get("primary_model")
        or loaded_bundle.get("rf_model")
        or loaded_bundle.get("model")
    )
    if model is None:
        raise RuntimeError("Model bundle must contain primary_model, rf_model, or model.")

    feature_columns = loaded_bundle.get("feature_columns")
    if not feature_columns:
        raise RuntimeError("Model bundle must contain feature_columns.")

    return loaded_bundle, model, list(feature_columns)


def validate_feature_contract(feature_columns):
    if len(feature_columns) != len(set(feature_columns)):
        raise RuntimeError("Feature contract invalid: duplicate feature names found.")

    if feature_columns == EXPECTED_FEATURE_COLUMNS:
        return

    missing = [f for f in EXPECTED_FEATURE_COLUMNS if f not in feature_columns]
    unexpected = [f for f in feature_columns if f not in EXPECTED_FEATURE_COLUMNS]

    first_mismatch = None
    min_len = min(len(feature_columns), len(EXPECTED_FEATURE_COLUMNS))
    for i in range(min_len):
        if feature_columns[i] != EXPECTED_FEATURE_COLUMNS[i]:
            first_mismatch = (
                i,
                EXPECTED_FEATURE_COLUMNS[i],
                feature_columns[i],
            )
            break

    mismatch_detail = (
        f"first_mismatch_index={first_mismatch[0]} "
        f"expected='{first_mismatch[1]}' got='{first_mismatch[2]}'"
        if first_mismatch is not None
        else "column_count_or_tail_mismatch"
    )

    raise RuntimeError(
        "Feature contract mismatch. "
        f"contract_id={FEATURE_CONTRACT_ID}; "
        f"expected={EXPECTED_FEATURE_COLUMNS}; "
        f"got={feature_columns}; "
        f"missing={missing}; unexpected={unexpected}; {mismatch_detail}"
    )


bundle, model, features = load_model_bundle()
validate_feature_contract(features)
model_name = bundle.get("primary_name", "rf")
label_mapping = bundle.get("label_mapping", {0: "Relaxed", 1: "Stressed"})


def _mean(values):
    return float(np.mean(values)) if len(values) else 0.0


def _std(values):
    return float(np.std(values)) if len(values) > 1 else 0.0


def _slope(values):
    if len(values) < 2:
        return 0.0
    return float(np.polyfit(np.arange(len(values), dtype=float), values, 1)[0])


def _as_json_array(value, field_name, default_value):
    if value is None or value == "":
        source = [default_value]
    elif isinstance(value, str):
        try:
            source = json.loads(value)
        except Exception as exc:
            raise ValueError(f"{field_name} must be a JSON array string.") from exc
    else:
        source = value

    if not isinstance(source, (list, tuple, np.ndarray)):
        source = [source]

    values = np.asarray(source, dtype=float).reshape(-1)
    if len(values) < MIN_WINDOW_SAMPLES:
        raise ValueError(
            f"{field_name} needs at least {MIN_WINDOW_SAMPLES} numeric samples."
        )
    if not np.all(np.isfinite(values)):
        raise ValueError(f"{field_name} contains non-finite values.")

    return values


def _eda_peak_count(window_eda):
    if len(window_eda) < FS["eda"]:
        return 0.0

    prominence = max(float(np.std(window_eda)) * 0.3, 1e-9)
    peaks, _ = scipy_signal.find_peaks(
        window_eda,
        distance=int(FS["eda"] * 1),
        prominence=prominence,
    )
    return float(len(peaks))


def _bvp_cardiac_features(window_bvp, device_hr):
    if len(window_bvp) < MIN_BVP_HRV_SAMPLES:
        return device_hr, 0.0, 0.0, "device_hr_low_rate_bvp"

    if bvp_module is None:
        return device_hr, 0.0, 0.0, "device_hr_biosppy_missing"

    try:
        out = bvp_module.bvp(signal=window_bvp, sampling_rate=FS["bvp"], show=False)
        peaks = np.asarray(out.get("peaks", []))
        heart_rates = np.asarray(out.get("heart_rate", []))

        hr = float(np.mean(heart_rates)) if len(heart_rates) else device_hr
        if len(peaks) >= 2:
            ibi = np.diff(peaks) / FS["bvp"] * 1000
            sdnn = float(np.std(ibi))
            rmssd = (
                float(np.sqrt(np.mean(np.diff(ibi) ** 2)))
                if len(ibi) > 1
                else 0.0
            )
        else:
            sdnn = 0.0
            rmssd = 0.0

        return hr, sdnn, rmssd, "bvp_hrv"
    except Exception:
        return device_hr, 0.0, 0.0, "device_hr_bvp_failed"


def _stress_probability(prediction, probabilities):
    if probabilities is None or not hasattr(model, "classes_"):
        return None

    classes = list(model.classes_)
    if 1 in classes:
        return float(probabilities[classes.index(1)])

    stressed_label = label_mapping.get(1, "Stressed")
    if stressed_label in classes:
        return float(probabilities[classes.index(stressed_label)])

    return None


def _predict_probability(dataframe):
    if not hasattr(model, "predict_proba"):
        return None

    probabilities = model.predict_proba(dataframe)[0]
    return np.asarray(probabilities, dtype=float)


def _label_for_prediction(prediction):
    if isinstance(prediction, str):
        return prediction
    return label_mapping.get(int(prediction), "Stressed" if int(prediction) == 1 else "Relaxed")


def predict(acc_x_raw, acc_y_raw, acc_z_raw, temp_raw, hr_raw, bvp_raw, eda_raw):
    warnings = []

    try:
        acc_x = _as_json_array(acc_x_raw, "acc_x_raw", 0.0)
        acc_y = _as_json_array(acc_y_raw, "acc_y_raw", 0.0)
        acc_z = _as_json_array(acc_z_raw, "acc_z_raw", 1.0)
        temp = _as_json_array(temp_raw, "temp_raw", 32.0)
        hr_device = _as_json_array(hr_raw, "hr_raw", 0.0)
        bvp = _as_json_array(bvp_raw, "bvp_raw", 0.0)
        eda = _as_json_array(eda_raw, "eda_raw", 0.0)
    except ValueError as exc:
        return {"ok": False, "error": str(exc), "model_version": MODEL_VERSION}

    sample_lengths = {
        "acc_x": len(acc_x),
        "acc_y": len(acc_y),
        "acc_z": len(acc_z),
        "temp": len(temp),
        "hr": len(hr_device),
        "bvp": len(bvp),
        "eda": len(eda),
    }
    if len(set(sample_lengths.values())) > 1:
        warnings.append(f"Input arrays have different lengths: {sample_lengths}")

    if len(bvp) < MIN_BVP_HRV_SAMPLES:
        warnings.append(
            "BVP sample count is too low for reliable HRV; using hr_raw for HR and zero HRV."
        )

    acc_len = min(len(acc_x), len(acc_y), len(acc_z))
    mag = np.sqrt(acc_x[:acc_len] ** 2 + acc_y[:acc_len] ** 2 + acc_z[:acc_len] ** 2)
    hr_mean, hrv_sdnn, hrv_rmssd, cardiac_source = _bvp_cardiac_features(
        bvp, _mean(hr_device)
    )

    computed_features = {
        "acc_x_mean": _mean(acc_x),
        "acc_x_std": _std(acc_x),
        "acc_y_mean": _mean(acc_y),
        "acc_y_std": _std(acc_y),
        "acc_z_mean": _mean(acc_z),
        "acc_z_std": _std(acc_z),
        "acc_mag_mean": _mean(mag),
        "acc_mag_std": _std(mag),
        "temp_mean": _mean(temp),
        "temp_std": _std(temp),
        "temp_slope": _slope(temp),
        "hr_mean": hr_mean,
        "hrv_sdnn": hrv_sdnn,
        "hrv_rmssd": hrv_rmssd,
        "bvp_mean": _mean(bvp),
        "bvp_std": _std(bvp),
        "eda_mean": _mean(eda),
        "eda_std": _std(eda),
        "eda_slope": _slope(eda),
        "eda_peaks": _eda_peak_count(eda),
    }

    missing_features = [feature for feature in features if feature not in computed_features]
    if missing_features:
        return {
            "ok": False,
            "error": f"Model expects unsupported features: {missing_features}",
            "model_version": MODEL_VERSION,
        }

    dataframe = pd.DataFrame(
        [{feature: computed_features[feature] for feature in features}],
        columns=features,
    )

    raw_prediction = model.predict(dataframe)[0]
    probabilities = _predict_probability(dataframe)
    stress_probability = _stress_probability(raw_prediction, probabilities)

    label = _label_for_prediction(raw_prediction)
    is_stressed = label.strip().lower().startswith("stress") or raw_prediction == 1
    if stress_probability is None:
        stress_probability = 1.0 if is_stressed else 0.0

    relaxed_probability = 1.0 - stress_probability
    confidence = stress_probability if is_stressed else relaxed_probability

    return {
        "ok": True,
        "label": "Stressed" if is_stressed else "Relaxed",
        "final_state": "Stressed" if is_stressed else "Relaxed",
        "prediction": int(raw_prediction) if not isinstance(raw_prediction, str) else raw_prediction,
        "stress_probability": float(stress_probability),
        "relaxed_probability": float(relaxed_probability),
        "confidence": float(confidence),
        "model_version": MODEL_VERSION,
        "feature_contract_id": FEATURE_CONTRACT_ID,
        "model_name": str(model_name),
        "feature_columns": features,
        "sample_lengths": sample_lengths,
        "cardiac_feature_source": cardiac_source,
        "warnings": warnings,
    }


demo = gr.Interface(
    fn=predict,
    inputs=[
        gr.Textbox(label="ACC X Array", value="[0.5, 0.6, 0.5, 0.4]"),
        gr.Textbox(label="ACC Y Array", value="[0.1, 0.2, 0.1, 0.1]"),
        gr.Textbox(label="ACC Z Array", value="[0.9, 0.8, 0.9, 1.0]"),
        gr.Textbox(label="Temp Array", value="[32.5, 32.6, 32.5, 32.7]"),
        gr.Textbox(label="HR Array", value="[72, 73, 72, 74]"),
        gr.Textbox(label="BVP / IR Array", value="[1.2, 1.3, 1.2, 1.1]"),
        gr.Textbox(label="EDA / GSR Array", value="[0.4, 0.5, 0.4, 0.6]"),
    ],
    outputs=gr.JSON(label="MindPulse Prediction"),
    title="MindPulse Stress Detection API",
    description=(
        "Send raw wearable sensor arrays. Uses hr_raw for HR when BVP is too sparse "
        "for reliable HRV."
    ),
)


demo.launch()
