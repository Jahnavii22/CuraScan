# backend/ml/predict_model.py
import sys
import json
import os
import joblib
import numpy as np

BASE = os.path.dirname(__file__)
MODEL_P = os.path.join(BASE, "model.pkl")
ENC_P = os.path.join(BASE, "label_encoder.pkl")
SCALER_P = os.path.join(BASE, "scaler.pkl")

def load_artifacts():
    if not (os.path.exists(MODEL_P) and os.path.exists(ENC_P) and os.path.exists(SCALER_P)):
        raise FileNotFoundError("Model artifacts missing. Run train_model.py first.")
    model = joblib.load(MODEL_P)
    le = joblib.load(ENC_P)
    scaler = joblib.load(SCALER_P)
    return model, le, scaler

def prepare_features(items):
    rows = []
    for it in items:
        value = float(it.get("value", 0))
        low = float(it.get("ref_lower") if it.get("ref_lower") is not None else float("nan"))
        up = float(it.get("ref_upper") if it.get("ref_upper") is not None else float("nan"))
        pct_of_range = (value - low) / (up - low + 1e-8) if not (np.isnan(low) or np.isnan(up)) else 0.0
        dist_low = value - low
        dist_up = up - value
        rows.append([value, low, up, pct_of_range, dist_low, dist_up])
    return np.array(rows, dtype=float)

def read_input():
    if len(sys.argv) > 1:
        fp = sys.argv[1]
        with open(fp, "r", encoding="utf-8") as f:
            return json.load(f)
    raw = sys.stdin.read()
    if not raw.strip():
        print(json.dumps({"error":"no input provided"}, ensure_ascii=False))
        sys.exit(0)
    return json.loads(raw)

def main():
    data = read_input()
    items = data.get("items") if isinstance(data, dict) and data.get("items") else data
    if not isinstance(items, list):
        print(json.dumps({"error":"expected a list of items or {items:[...]}"}, ensure_ascii=False))
        return
    model, le, scaler = load_artifacts()
    X = prepare_features(items)
    X_scaled = scaler.transform(X)
    preds = model.predict(X_scaled)
    labels = le.inverse_transform(preds)
    out = []
    for it, lab in zip(items, labels):
        out.append({
            "test": it.get("test"),
            "value": it.get("value"),
            "ref_lower": it.get("ref_lower"),
            "ref_upper": it.get("ref_upper"),
            "prediction": lab
        })
    print(json.dumps({"ok": True, "predictions": out}, ensure_ascii=False))

if __name__ == "__main__":
    main()
