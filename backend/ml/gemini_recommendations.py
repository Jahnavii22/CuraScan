#!/usr/bin/env python3
"""
Gemini-based recommendations for lab reports.

Usage:
  python gemini_recommendations.py <report_json_path>

Accepts:
 - full report JSON (the object you store in Mongo: contains extractedValues and mlPredictions)
 - OR items JSON produced by parse_extracted.py ({"items":[...]}) or a plain list of items.

Output:
 - Writes a JSON object to stdout:
   { "overall_risk": "...", "suggestions": [...], "specialist_referrals": [...] }
"""
import os
import sys
import json
import re
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

# try import genai (optional)
try:
    import google.generativeai as genai
except Exception:
    genai = None

# minimal specialist mapping for fallback suggestions
FALLBACK_SPECIALIST_MAP = {
    "glucose": ("Endocrinologist", ["Reduce sugar intake; check HbA1c if persistently high."]),
    "creatinine": ("Nephrologist", ["Check kidney function, ensure hydration."]),
    "hemoglobin": ("Physician", ["If low, consider iron studies; do not self-supplement."]),
    "triglyceride": ("Cardiologist / Dietitian", ["Reduce simple carbs/saturated fats; increase activity."]),
    "default": ("General Physician", ["Review results with your physician."])
}


def normalize_tests(input_obj: Any) -> List[Dict[str, Any]]:
    """
    Accepts:
      - full report dict (has 'mlPredictions' or 'extractedValues' or 'extracted_values')
      - or dict {"items": [...]} or {"tests": [...]}
      - or list of either dicts or strings (strings will be ignored)

    Returns standardized list: {name, value, unit, ref_lower, ref_upper, prediction}
    """
    tests: List[Dict[str, Any]] = []

    # helper to add
    def add_test(d):
        if not isinstance(d, dict):
            return
        name = d.get("name") or d.get("test") or d.get("test_name") or d.get("Test") or ""
        # attempt to find a numeric value
        val = d.get("value")
        try:
            if val is not None and val != "":
                val = float(val)
        except Exception:
            val = None
        unit = d.get("unit") or d.get("units") or None
        lower = d.get("ref_lower") or d.get("lower") or d.get("reference_lower")
        upper = d.get("ref_upper") or d.get("upper") or d.get("reference_upper")
        try:
            lower = float(lower) if lower not in (None, "", {}) else None
        except Exception:
            lower = None
        try:
            upper = float(upper) if upper not in (None, "", {}) else None
        except Exception:
            upper = None
        pred = d.get("prediction") or d.get("status") or None
        tests.append({
            "name": str(name).strip(),
            "value": val,
            "unit": unit,
            "ref_lower": lower,
            "ref_upper": upper,
            "prediction": pred
        })

    # If it's a list
    if isinstance(input_obj, list):
        for e in input_obj:
            add_test(e)
        return tests

    # If it's a dict with known keys
    if isinstance(input_obj, dict):
        # full report style (your example)
        if "mlPredictions" in input_obj and isinstance(input_obj["mlPredictions"], list):
            for e in input_obj["mlPredictions"]:
                add_test(e)
            return tests

        if "extractedValues" in input_obj and isinstance(input_obj["extractedValues"], list):
            for e in input_obj["extractedValues"]:
                add_test(e)
            return tests

        # items / tests
        if "items" in input_obj and isinstance(input_obj["items"], list):
            for e in input_obj["items"]:
                add_test(e)
            return tests
        if "tests" in input_obj and isinstance(input_obj["tests"], list):
            for e in input_obj["tests"]:
                add_test(e)
            return tests

        # maybe the file is the top-level report wrapper: {"ok": true, "report": {...}}
        if "report" in input_obj and isinstance(input_obj["report"], dict):
            return normalize_tests(input_obj["report"])

        # fallback: try to parse any list valued fields
        for k, v in input_obj.items():
            if isinstance(v, list):
                for e in v:
                    add_test(e)
                if tests:
                    return tests

    return tests


# small local classifier to determine risk level for fallback
def classify_from_prediction(t: Dict[str, Any]) -> str:
    pred = (t.get("prediction") or "").lower()
    if pred in ("high", "low", "critical_high", "critical_low", "abnormal"):
        # consider critical thresholds if ref bounds available
        low = t.get("ref_lower")
        up = t.get("ref_upper")
        val = t.get("value")
        try:
            if val is not None and up is not None and val >= 2 * float(up):
                return "critical_high"
            if val is not None and low is not None and val <= 0.5 * float(low):
                return "critical_low"
        except Exception:
            pass
        return "abnormal"
    return "normal"


def fallback_recommendations(tests: List[Dict[str, Any]]) -> Dict[str, Any]:
    suggestions = []
    referrals = []
    severity = 0  # 0 normal, 1 moderate, 2 high/critical

    for t in tests:
        name = (t.get("name") or "").lower()
        val = t.get("value")
        pred = (t.get("prediction") or "").lower()
        cls = classify_from_prediction(t)

        if cls in ("critical_high", "critical_low"):
            severity = max(severity, 2)
        elif cls == "abnormal":
            severity = max(severity, 1)

        # choose matching fallback mapping
        for key, (spec, tips) in FALLBACK_SPECIALIST_MAP.items():
            if key in name:
                if cls != "normal":
                    for tip in tips:
                        suggestions.append(f"{t.get('name')}: {tip}")
                    referrals.append({"test": t.get("name"), "specialist": spec, "urgency": "routine" if cls == "abnormal" else "urgent"})
                break
        else:
            if cls != "normal":
                suggestions.append(f"{t.get('name')}: Please review this result with your doctor.")
                referrals.append({"test": t.get("name"), "specialist": FALLBACK_SPECIALIST_MAP["default"][0], "urgency": "routine"})

    overall = "low" if severity == 0 else ("moderate" if severity == 1 else "high")
    # dedupe suggestions/referrals
    suggestions = list(dict.fromkeys(suggestions))
    # ensure referrals unique by test
    seen = set()
    dedup_refs = []
    for r in referrals:
        k = (r.get("test"), r.get("specialist"))
        if k not in seen:
            seen.add(k)
            dedup_refs.append(r)
    return {"overall_risk": overall, "suggestions": suggestions, "specialist_referrals": dedup_refs}


# Build prompt safely (use f-string to avoid .format brace issues)
def build_gemini_prompt(tests: List[Dict[str, Any]]) -> str:
    tests_json = json.dumps(tests, ensure_ascii=False, indent=2)
    prompt = (
        "You are an experienced clinical lab assistant. Given a JSON array of lab results (test name, numeric value, unit, reference range if available),\n"
        "return a JSON object with the following keys:\n"
        " - overall_risk: one of ['low','moderate','high']\n"
        " - suggestions: an array of short actionable bullet suggestions (1-3 per flagged test)\n"
        " - specialist_referrals: an array of objects with keys {\"test\", \"specialist\", \"urgency\"}\n"
        "Return ONLY valid JSON (no surrounding commentary). Input tests JSON follows:\n\n"
        f"{tests_json}\n"
    )
    return prompt


def call_gemini(tests: List[Dict[str, Any]], model_name: str = "gemini-2.5-flash") -> Optional[Dict[str, Any]]:
    """
    Call Gemini (google.generativeai). Returns parsed JSON on success, None on failure.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or genai is None:
        return None

    # configure
    try:
        genai.configure(api_key=api_key)
    except Exception:
        # some versions may not require configure; proceed
        pass

    prompt = build_gemini_prompt(tests)

    try:
        # prefer GenerativeModel if available
        model = getattr(genai, "GenerativeModel", None)
        if model:
            model_obj = genai.GenerativeModel(model_name)
            resp = model_obj.generate_content([prompt])
            text = getattr(resp, "text", str(resp))
        else:
            # fallback to generic generate_text (sdk differences)
            resp = genai.generate_text(model=model_name, prompt=prompt)
            text = getattr(resp, "text", str(resp))
    except Exception as e:
        # SDK failed
        print(f"[WARN] Gemini call failed: {e}", file=sys.stderr)
        return None

    # extract JSON blob
    m = re.search(r"(\{[\s\S]*\})", text)
    if not m:
        # try if output is already pure JSON
        try:
            return json.loads(text)
        except Exception:
            return None
    try:
        return json.loads(m.group(1))
    except Exception:
        return None


def main():
    if len(sys.argv) < 2:
        print("Usage: gemini_recommendations.py <report_or_items_json_path>", file=sys.stderr)
        sys.exit(2)

    fp = sys.argv[1]
    try:
        with open(fp, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading {fp}: {e}", file=sys.stderr)
        sys.exit(3)

    tests = normalize_tests(data)
    if not tests:
        print(json.dumps({"overall_risk": "unknown", "suggestions": [], "specialist_referrals": []}, indent=2, ensure_ascii=False))
        return

    # Attempt to call Gemini
    gemini_result = call_gemini(tests)
    if gemini_result and isinstance(gemini_result, dict):
        print(json.dumps(gemini_result, indent=2, ensure_ascii=False))
        return

    # fallback
    fallback = fallback_recommendations(tests)
    print(json.dumps(fallback, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
