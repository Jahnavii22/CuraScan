#!/usr/bin/env python3
# backend/ml/parse_extracted.py
import re, json, sys, os
from typing import List, Dict

# Remove known header pieces that sometimes get concatenated
HEADER_PHRASES = [
    r"Report\s+ID[:\s]*\S+",
    r"Patient\s+Name[:\s]*[A-Za-z0-9\s\.\-]+",
    r"Physician[:\s]*[A-Za-z0-9\.\s\-]+",
    r"Test\s+Result\s+Reference\s+Range",
    r"Report\s+Date[:\s]*\S+",
    r"Sex[:\s]*[MFmf]",
    r"Age[:\s]*\d+"
]

HEADER_RE = re.compile("|".join(HEADER_PHRASES), flags=re.IGNORECASE)

# Pattern: test name (words/spaces + optional paren units) value lower - upper
PATTERN = re.compile(
    r'([A-Za-z][A-Za-z0-9 &\.\%\/\(\)\-]{1,40}?)'   # test name limited to 40 chars (prevents huge prefix)
    r'(?:\s*\([^\)]*\))?'                           # optional unit in parentheses
    r'\s+'                                          # separator
    r'([0-9]+(?:\.[0-9]+)?)'                        # value
    r'\s+'                                          # separator
    r'([0-9]+(?:\.[0-9]+)?)\s*[-–]\s*([0-9]+(?:\.[0-9]+)?)' # lower - upper
)

def clean_text(text: str) -> str:
    t = text.replace('\r', ' ').replace('\n', ' ')
    # remove header phrases
    t = HEADER_RE.sub(' ', t)
    # collapse long whitespace
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def parse_text_to_items(text: str) -> List[Dict]:
    items = []
    if not text or not text.strip():
        return items
    normalized = clean_text(text)
    matches = PATTERN.findall(normalized)
    for m in matches:
        test_raw, value_s, lower_s, upper_s = m
        test = test_raw.strip()
        # remove trailing words that are obviously not tests (like stray "Result" or "Reference")
        test = re.sub(r'\b(Result|Reference|Range|Test)\b', '', test, flags=re.IGNORECASE).strip()
        # drop any leading single-letter tokens (like "M" from Sex)
        if len(test) <= 2 and test.isalpha():
            continue
        try:
            value = float(value_s)
            lower = float(lower_s)
            upper = float(upper_s)
            items.append({
                "test": test,
                "value": value,
                "ref_lower": lower,
                "ref_upper": upper
            })
        except Exception:
            continue

    # dedupe
    seen = set()
    dedup = []
    for it in items:
        key = (it["test"].lower(), it["value"], it["ref_lower"], it["ref_upper"])
        if key not in seen:
            seen.add(key)
            dedup.append(it)
    return dedup

def load_input(fp: str):
    if fp == '-' or not fp:
        raw = sys.stdin.read()
        if not raw.strip():
            raise SystemExit("no stdin input")
        return json.loads(raw)
    with open(fp, 'r', encoding='utf-8-sig') as f:
        return json.load(f)

def main():
    if len(sys.argv) < 2:
        print("Usage: parse_extracted.py <extracted_json_path|-> [out_items.json]")
        sys.exit(2)
    inpath = sys.argv[1]
    outpath = sys.argv[2] if len(sys.argv) > 2 else None

    data = load_input(inpath)
    if isinstance(data, dict):
        text = data.get("extracted_text") or data.get("extractedText") or data.get("extracted") or ""
    elif isinstance(data, str):
        text = data
    else:
        text = ""

    items = parse_text_to_items(text)
    out = {"items": items}
    if outpath:
        with open(outpath, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        print(f"Saved {len(items)} items to {outpath}")
    else:
        print(json.dumps(out, ensure_ascii=False))

if __name__ == "__main__":
    main()
