import sys
import os
import re
import json
import argparse
from pathlib import Path
from typing import Dict, Any, Optional

import pandas as pd
MIN_TESTED = (3, 10)
MAX_TESTED = (3, 12) 

PY = sys.version_info[:2]

if PY < MIN_TESTED:
    raise RuntimeError(
        f"This script requires Python >= {MIN_TESTED[0]}.{MIN_TESTED[1]}; "
        f"you are running {sys.version.split()[0]}"
    )

if PY > MAX_TESTED:
    print(
        "WARNING: Tested on Python 3.10/3.11. Running on "
        f"{sys.version.split()[0]} may cause import errors "
        "(grpcio / pydantic-core / google-generativeai)."
    )

try:
    import google.generativeai as genai
except Exception as e:
    genai = None
    _genai_import_error = e


try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass 


def _raise_genai_import_error():
    """
    Raise a helpful error describing steps to fix import problems
    (missing grpcio/pydantic-core wheels on Python 3.12).
    """
    msg = (
        "Failed to import google.generativeai or one of its dependencies.\n\n"
        "Common causes on Python 3.12:\n"
        "- Missing prebuilt wheels for grpcio or pydantic-core\n"
        "- Using a Python version without compatible wheels\n\n"
        "Fix suggestions:\n"
        "  1) Use Python 3.10 or 3.11 (recommended)\n"
        "  2) Or run in a Docker container pinned to Python 3.10\n"
        "  3) If using Python 3.12, upgrade pip and rebuild:\n"
        "       python -m pip install --upgrade pip setuptools wheel\n"
        "       python -m pip install --upgrade grpcio pydantic-core pydantic google-generativeai\n"
        "\n"
        f"Original import error: {repr(_genai_import_error)}\n"
        "See https://pyreadiness.org/3.12/ for 3.12 readiness.\n"
    )
    raise RuntimeError(msg)

def configure_api():
    if genai is None:
        _raise_genai_import_error()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        if sys.stdin is None or not sys.stdin.isatty():
            raise RuntimeError(
                "GEMINI_API_KEY not set. Add it to .env or environment variables."
            )
        api_key = input("Enter your Gemini API key: ").strip()
        os.environ["GEMINI_API_KEY"] = api_key

    genai.configure(api_key=api_key)


MODEL_NAME = "gemini-2.5-flash"

# ===================== LOAD REFERENCE RANGES =====================

def load_reference_ranges(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path, dtype=str).fillna("")
    col_map = {c.lower().strip(): c for c in df.columns}

    def find_col(*names):
        for n in names:
            if n in col_map:
                return col_map[n]
        return None

    test_col = find_col("test_name", "test", "name")
    lower_col = find_col("lower", "lower_ref", "min", "reference_low", "ref_low")
    upper_col = find_col("upper", "upper_ref", "max", "reference_high", "ref_high")
    range_col = find_col("range", "ref_range", "reference_range", "normal_range")
    unit_col = find_col("unit", "units")
    sex_col = find_col("sex")

    if test_col is None:
        raise RuntimeError(
            "CSV must contain a test name column (test_name / test / name). "
            f"Found: {', '.join(df.columns.tolist())}"
        )

    out = pd.DataFrame()
    out["test_name"] = df[test_col].astype(str).str.strip()
    out["test_name_norm"] = out["test_name"].str.lower().str.strip()

    out["sex"] = (
        df[sex_col].astype(str).str.strip().replace({"": "All"}).fillna("All")
        if sex_col
        else "All"
    )

    if unit_col:
        s = df[unit_col].astype(str).str.strip().replace("", None)
        out["unit"] = s.where(s.notna(), None)
    else:
        out["unit"] = None

    def to_num(x):
        try:
            return float(str(x).strip())
        except Exception:
            return pd.NA

    if lower_col and upper_col:
        out["lower"] = df[lower_col].apply(to_num)
        out["upper"] = df[upper_col].apply(to_num)
    elif range_col:
        lowers, uppers = [], []
        for v in df[range_col].astype(str):
            s = v.strip()
            m = re.search(r"([0-9.]+)\s*[-–—]\s*([0-9.]+)", s)
            if not m:
                m = re.search(r"\(([0-9.]+)\s*[-–—]\s*([0-9.]+)\)", s)
            if m:
                lowers.append(to_num(m.group(1)))
                uppers.append(to_num(m.group(2)))
            else:
                lowers.append(pd.NA)
                uppers.append(pd.NA)
        out["lower"], out["upper"] = lowers, uppers
    else:
        out["lower"] = pd.NA
        out["upper"] = pd.NA

    out["lower"] = pd.to_numeric(out["lower"], errors="coerce")
    out["upper"] = pd.to_numeric(out["upper"], errors="coerce")

    return out

def find_reference_row(name: str, ref_df: pd.DataFrame) -> Optional[pd.Series]:
    if not name:
        return None

    n = name.lower().strip()
    exact = ref_df[ref_df["test_name_norm"] == n]
    if not exact.empty:
        return exact.iloc[0]

    contains = ref_df[ref_df["test_name_norm"].str.contains(n, na=False)]
    if not contains.empty:
        return contains.iloc[0]

    return None

def classify_value(val, lower, upper):
    try:
        v = float(val)
    except Exception:
        return "unknown"

    if pd.isna(lower) or pd.isna(upper):
        return "no_reference"
    if v >= 2 * upper:
        return "critical_high"
    if v <= 0.5 * lower:
        return "critical_low"
    if lower <= v <= upper:
        return "normal"
    if v < lower:
        return "low"
    if v > upper:
        return "high"
    return "unknown"


SPECIALIST_MAP = {
    "lipid": ("Cardiologist / Dietitian", ["Reduce fats, exercise daily."]),
    "glucose": ("Endocrinologist", ["Reduce sugar intake, check HbA1c."]),
    "creatinine": ("Nephrologist", ["Check kidney function, stay hydrated."]),
    "hemoglobin": ("Physician", ["Increase iron intake if low."]),
    "default": ("General Physician", ["Consult your doctor for review."]),
}


def suggest_specialist(test_name):
    n = (test_name or "").lower()
    for key, val in SPECIALIST_MAP.items():
        if key in n:
            return val
    return SPECIALIST_MAP["default"]


# ===================== GEMINI PROMPT =====================

def build_prompt() -> str:
    return (
        "You are a medical report parsing assistant. "
        "Given a lab report image, extract test details in strict JSON:\n"
        "{\n"
        '  "sex": "Male"|"Female"|null,\n'
        '  "tests": [{"name": string, "value": number|null, "unit": string|null, "raw_text": string}],\n'
        '  "notes": string|null\n'
        "}\n"
        "Output ONLY JSON."
    )


# ===================== GEMINI CALL =====================

def call_gemini_with_image(image_path: str, prompt: str, model_name: str = MODEL_NAME) -> str:
    if genai is None:
        _raise_genai_import_error()

    try:
        model = genai.GenerativeModel(model_name)
    except AttributeError:
        try:
            response = genai.generate_text(
                model=model_name, prompt=prompt, images=[image_path]
            )
            return getattr(response, "text", str(response))
        except Exception as e:
            raise RuntimeError("Failed to call Google GenAI SDK: " + str(e))

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    response = model.generate_content(
        [prompt, {"mime_type": "image/png", "data": image_bytes}]
    )
    return getattr(response, "text", str(response))


# ===================== PARSE GEMINI OUTPUT =====================

def extract_json_from_text(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    try:
        match = re.search(r"(\{.*\})", text, re.S)
        if match:
            return json.loads(match.group(1))
        return json.loads(text)
    except Exception:
        return None


# ===================== MAIN ANALYSIS =====================

def analyze_report(image_path, csv_path, model_name=MODEL_NAME):
    configure_api()
    prompt = build_prompt()
    model_output = call_gemini_with_image(image_path, prompt, model_name)
    parsed = extract_json_from_text(model_output)

    if parsed is None:
        raise RuntimeError(
            f"ERROR: Could not parse JSON from model output:\n{model_output[:500]}"
        )

    ref_df = load_reference_ranges(csv_path)
    report = {"sex": parsed.get("sex"), "tests": [], "flags": [], "raw_output": model_output}

    for t in parsed.get("tests", []):
        name = t.get("name", "")
        val = t.get("value")
        unit = t.get("unit")
        ref = find_reference_row(name, ref_df)

        if ref is not None:
            lower, upper = ref["lower"], ref["upper"]
            status = classify_value(val, lower, upper)
        else:
            lower = upper = None
            status = "no_reference"

        specialist, adv = suggest_specialist(name)
        entry = {
            "name": name,
            "value": val,
            "unit": unit,
            "status": status,
            "reference_lower": lower,
            "reference_upper": upper,
            "specialist": specialist,
            "advice": adv,
        }

        report["tests"].append(entry)
        if status not in ("normal", "no_reference"):
            report["flags"].append(entry)

    report["summary"] = (
        "OK: All values are within normal range."
        if not report["flags"]
        else f"WARNING: {len(report['flags'])} abnormal value(s) detected."
    )

    return report


def human_summary(report):
    lines = [
        "=== BLOOD REPORT SUMMARY ===",
        f"Sex: {report.get('sex', 'N/A')}",
        report["summary"],
        "",
    ]
    for f in report["flags"]:
        lines.append(f"- {f['name']}: {f['value']} {f.get('unit', '')} -> {f['status']} ({f['specialist']})")
        for tip in f["advice"]:
            lines.append(f"    - {tip}")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="Path to report image")
    parser.add_argument("--csv", required=True, help="Path to WHO ranges CSV")
    parser.add_argument("--model", default=MODEL_NAME)
    args = parser.parse_args()

    result = analyze_report(args.image, args.csv, args.model)
    print(json.dumps(result, indent=2))
    print("\n" + human_summary(result))


if __name__ == "__main__":
    main()
