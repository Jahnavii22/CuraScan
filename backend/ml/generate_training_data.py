# backend/ml/generate_training_data.py
import pandas as pd
import numpy as np
import os
import sys

# support both file locations
CANDIDATES = [
    os.path.join(os.path.dirname(__file__), "who_ranges.csv"),
    os.path.join(os.path.dirname(__file__), "dataset", "who_ranges.csv"),
    os.path.join(os.path.dirname(__file__), "..", "ml", "who_ranges.csv")
]

DATA_PATH = None
for p in CANDIDATES:
    if os.path.exists(p):
        DATA_PATH = os.path.abspath(p)
        break

if DATA_PATH is None:
    print("❌ who_ranges.csv not found. Tried these locations:")
    for p in CANDIDATES:
        print("  -", os.path.abspath(p))
    sys.exit(1)

OUT_PATH = os.path.join(os.path.dirname(__file__), "synthetic_training.csv")
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

def sample_for_row(row, n_per_class=300):
    lower = float(row["lower_ref"])
    upper = float(row["upper_ref"])
    if upper <= lower:
        upper = lower * 1.05 if lower > 0 else lower + 1.0

    samples = []
    low_min = max(lower - (upper - lower), 0, lower * 0.5)
    low_max = lower * 0.99
    normal_min = lower
    normal_max = upper
    high_min = upper * 1.01
    high_max = upper + (upper - lower) if (upper - lower) > 0 else upper * 1.3

    if normal_max <= normal_min:
        normal_min = lower * 0.95
        normal_max = upper * 1.05

    for _ in range(n_per_class):
        lv = float(np.random.uniform(low_min, low_max))
        samples.append((row["test_name"], row.get("unit", ""), row.get("sex", ""), row.get("category", ""), lv, "low"))
    for _ in range(n_per_class):
        nv = float(np.random.uniform(normal_min, normal_max))
        samples.append((row["test_name"], row.get("unit", ""), row.get("sex", ""), row.get("category", ""), nv, "normal"))
    for _ in range(n_per_class):
        hv = float(np.random.uniform(high_min, high_max))
        samples.append((row["test_name"], row.get("unit", ""), row.get("sex", ""), row.get("category", ""), hv, "high"))

    return samples

def main():
    df = pd.read_csv(DATA_PATH)
    all_samples = []
    for _, row in df.iterrows():
        try:
            _ = float(row["lower_ref"])
            _ = float(row["upper_ref"])
        except Exception:
            continue
        samples = sample_for_row(row, n_per_class=300)
        all_samples.extend(samples)

    df_out = pd.DataFrame(all_samples, columns=["test_name", "unit", "sex", "category", "value", "label"])

    # --- handle duplicates in who_ranges.csv: drop duplicates by test_name when building ref_map
    ref_map = (
        df.drop_duplicates(subset=["test_name"])
          .set_index("test_name")[["lower_ref", "upper_ref"]]
          .to_dict(orient="index")
    )

    lower_list, upper_list = [], []
    for t in df_out["test_name"]:
        info = ref_map.get(t, {"lower_ref": None, "upper_ref": None})
        lower = float(info["lower_ref"]) if info["lower_ref"] not in (None, "") else float("nan")
        upper = float(info["upper_ref"]) if info["upper_ref"] not in (None, "") else float("nan")
        lower_list.append(lower)
        upper_list.append(upper)
    df_out["ref_lower"] = lower_list
    df_out["ref_upper"] = upper_list

    df_out["pct_of_range"] = (df_out["value"] - df_out["ref_lower"]) / (df_out["ref_upper"] - df_out["ref_lower"] + 1e-8)
    df_out["distance_lower"] = df_out["value"] - df_out["ref_lower"]
    df_out["distance_upper"] = df_out["ref_upper"] - df_out["value"]

    df_out.to_csv(OUT_PATH, index=False)
    print(f"✅ Saved synthetic dataset to {OUT_PATH}. Rows: {len(df_out)}")

if __name__ == "__main__":
    main()
