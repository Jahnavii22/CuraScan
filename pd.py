#!/usr/bin/env python3
"""
pd.py - Simple PDF extractor + optional Groq summarization.

Usage:
  # extract and print text
  .\.venv\Scripts\python.exe pd.py "C:\Users\jahna\Internship-BAA\CuraScan\backend\pdf\BR100001.pdf"

  # extract + summarize using Groq (requires GROQ_API_KEY in .env)
  .\.venv\Scripts\python.exe pd.py "C:\Users\jahna\Internship-BAA\CuraScan\backend\pdf\BR100001.pdf" --summarize
"""
import os
import sys
import argparse
import json
from dotenv import load_dotenv
from pypdf import PdfReader

# Optional imports (OCR + Groq). We'll import lazily to keep errors clear.
def try_imports():
    pdf2image_fn = None
    pytesseract_mod = None
    PIL_Image = None
    GroqClass = None

    try:
        from pdf2image import convert_from_path
        pdf2image_fn = convert_from_path
    except Exception:
        pdf2image_fn = None

    try:
        import pytesseract
        from PIL import Image as PIL_Image
    except Exception:
        pytesseract_mod = None
        PIL_Image = None
    else:
        pytesseract_mod = pytesseract

    try:
        from groq import Groq
        GroqClass = Groq
    except Exception:
        GroqClass = None

    return pdf2image_fn, pytesseract_mod, PIL_Image, GroqClass

def extract_text_pypdf(path: str) -> str:
    text = []
    reader = PdfReader(path)
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text.append(page_text)
    return "\n".join(text).strip()

def ocr_pdf(path: str, convert_from_path_fn, pytesseract_mod, PIL_Image) -> str:
    text = []
    try:
        images = convert_from_path_fn(path, dpi=300)
    except Exception as e:
        print("[WARN] pdf2image.convert_from_path failed:", e)
        return ""
    for img in images:
        try:
            page_text = pytesseract_mod.image_to_string(img)
        except Exception:
            try:
                page_text = pytesseract_mod.image_to_string(PIL_Image.fromarray(img))
            except Exception:
                page_text = ""
        text.append(page_text)
    return "\n".join(text).strip()

def summarize_with_groq(text: str, GroqClass, api_key: str) -> str:
    if not text.strip():
        return "No text to summarize."
    client = GroqClass(api_key=api_key)
    prompt = (
        "You are a concise summarizer. Read the following extracted PDF text and "
        "produce a short bulleted summary of the key findings/values.\n\n"
        f"{text[:8000]}"
    )
    try:
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        return f"[Groq error] {e}"

def main():
    parser = argparse.ArgumentParser(description="Simple PDF text extractor with optional Groq summarization.")
    parser.add_argument("pdf_path", help="Path to the PDF file")
    parser.add_argument("--summarize", action="store_true", help="Send extracted text to Groq for a short summary (requires GROQ_API_KEY in .env)")
    args = parser.parse_args()

    pdf_path = args.pdf_path
    if not os.path.exists(pdf_path):
        print(f"❌ PDF not found: {pdf_path}")
        sys.exit(1)

    # lazy imports
    convert_from_path_fn, pytesseract_mod, PIL_Image, GroqClass = try_imports()

    # Step 1: Try pypdf extraction
    print("[INFO] Trying native extraction with pypdf...")
    extracted = extract_text_pypdf(pdf_path)
    print(f"[INFO] Extracted {len(extracted)} characters via pypdf.")

    # Step 2: Fallback to OCR if very little text
    if len(extracted.strip()) < 120:
        if convert_from_path_fn and pytesseract_mod:
            print("[INFO] Very little text found — falling back to OCR using pdf2image + pytesseract...")
            ocr_text = ocr_pdf(pdf_path, convert_from_path_fn, pytesseract_mod, PIL_Image)
            if ocr_text:
                extracted = ocr_text
                print(f"[INFO] Extracted {len(extracted)} characters via OCR.")
            else:
                print("[WARN] OCR attempted but returned no text.")
        else:
            print("[WARN] pdf2image or pytesseract not available; skipping OCR fallback.")
    else:
        print("[INFO] Native extraction seems sufficient; skipping OCR.")

    # Normalize whitespace a bit
    extracted = " ".join(extracted.split())

    # Print result
    print("\n======= Extracted Text (truncated to 3000 chars) =======\n")
    print(extracted[:3000] + ("\n\n...[truncated]" if len(extracted) > 3000 else ""))
    print("\n======= End Extracted Text =======\n")

    # Optional: summarize with Groq if requested
    if args.summarize:
        load_dotenv()
        GROQ_API_KEY = os.getenv("GROQ_API_KEY")
        if not GROQ_API_KEY:
            print("[WARN] GROQ_API_KEY not found in .env; cannot summarize.")
        elif GroqClass is None:
            print("[WARN] groq SDK not installed in this environment. Install it with `pip install groq`.")
        else:
            print("[INFO] Summarizing using Groq...")
            summary = summarize_with_groq(extracted, GroqClass, GROQ_API_KEY)
            print("\n======= Groq Summary =======\n")
            print(summary)
            print("\n======= End Summary =======\n")

    # Also save to file
    out_file = os.path.splitext(os.path.basename(pdf_path))[0] + "_extracted.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"file": pdf_path, "extracted_text": extracted}, f, ensure_ascii=False, indent=2)
    print(f"[INFO] Saved extracted text to {out_file}")

if __name__ == "__main__":
    main()
