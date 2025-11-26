CuraScan — AI Blood Report Analyzer

CuraScan is an end-to-end system that automates interpretation of blood test reports (PDFs / images) and generates actionable, explainable recommendations. It combines rule-based parsing, machine learning (stacked XGBoost / RF / LR), and the Gemini API (OCR + generative recommendations) to convert unstructured lab data into a structured report, risk classification (Low/Normal/High), and patient-oriented advice.

Table of Contents

Project Overview

Key Features

Architecture & Workflow

Quick Start (Developer)

Environment Variables

API Endpoints (examples)

ML Artifacts & Training

Data Models (MongoDB)

Frontend (Expo React Native)

Testing & QA

Deployment & Operational Notes

Security, Privacy & Ethics

Project Structure (suggested)

Contributing

Acknowledgements & References

License

Project Overview

CuraScan ingests a PDF or image of a blood report, extracts and cleans text, parses lab tests into structured records, predicts whether each test is Low/Normal/High using an ensemble ML model, and produces human-readable recommendations via the Gemini API (with a local fallback). Results are persisted in MongoDB and surfaced through an Expo React Native app.

Key Features

Upload PDF / image (mobile).

Text extraction with PyPDF (machine-readable) + Gemini OCR fallback for scanned reports.

Robust regex-based parsing into {test, value, ref_lower, ref_upper, unit}.

Feature engineering (pct_of_range, distance_from_bounds) for ML inference.

Stacked ML model (XGBoost + RandomForest + LogisticRegression) saved as model.pkl.

Domain rules (e.g., sex-specific Hemoglobin thresholds, critical thresholds).

Gemini-based natural language recommendations with JSON output; local fallback if API unavailable.

MongoDB persistence and secure access (Clerk for auth).

Frontend: Expo React Native app with upload, processing status, and visualizations.

Architecture & Workflow

High-level stages:

Input — user uploads PDF / image.

Extraction — extract_text_pypdf() for text PDFs; convert pages → images → call_gemini_with_image() if needed.

Parsing — parse_extracted.py uses regex to create structured items.

Feature engineering — compute numeric features for model.

Prediction — load model.pkl, scaler.pkl, label_encoder.pkl and predict Low/Normal/High.

Recommendation — send structured summary to Gemini for JSON suggestions; or use fallback_recommendations().

Storage & Display — update MongoDB Report document and notify/poll from frontend.

Diagrams referenced in the codebase (e.g., Figure 5.1, 6.1) should be added under docs/ as PNGs or embedded in repository README wiki.

Quick Start (Developer)
Prerequisites

Node.js (v18+ recommended)

Python 3.10+ (virtualenv)

MongoDB (local or Atlas)

Expo CLI (for frontend)

Optional: Docker

Backend (Express + Multer)
# from repo root
cd backend
cp .env.example .env
npm install
npm run dev    # or `pm2 start` for production

ML Worker (Python)
cd ml-worker
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# test scripts
python predict_model.py --input sample_items.json

Frontend (Expo)
cd frontend
npm install
expo start

Environment Variables

Add these to .env (or secrets manager):

PORT=4000
UPLOAD_DIR=/path/to/uploads
MONGO_URI=mongodb+srv://<user>:<pw>@cluster.mongodb.net/curascan
JWT_SECRET=your_jwt_secret
CLERK_API_KEY=...
GEMINI_API_KEY=...
NODE_ENV=development
MAX_PDF_SIZE=52428800       # 50MB
MAX_IMAGE_SIZE=10485760     # 10MB

API Endpoints (examples)
Upload (PDF)

POST /api/upload (multipart/form-data: file, optional userId, clerkUserId)
Response:

{ "ok": true, "reportId": "<id>", "filename": "..." }

Upload (Image)

POST /api/uploadimage — same shape as above.

Trigger processing (sync)

POST /api/process/:reportId

Synchronous processing: extraction → parse → predict → recommend.

For heavy loads, change to async: return 202 Accepted and process in worker queue.

Get report

GET /api/reports/:id
Response includes extractedText, parsedItems, mlPredictions, recommendations, processed.

Example curl (upload)
curl -X POST "https://api.example.com/api/upload" \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/report.pdf"

ML Artifacts & Training

Artifacts: model.pkl, label_encoder.pkl, scaler.pkl (store under ml-worker/artifacts/).

Training process:

Use who_ranges.csv as base reference ranges.

Synthetic sample generation to balance Low/Normal/High classes.

Stratified 80/20 split, SMOTE for class imbalance.

Hyperparameter search via RandomizedSearchCV for RF & XGB.

Stack final estimators with Logistic Regression.

Achieved (example): 98.7% accuracy, F1 > 0.95 (use these reported metrics with caution; include test set details).

Retraining: schedule quarterly; log model version in Report.audit for traceability.

Data Models (MongoDB)

Report (example schema)

{
  "_id": "...",
  "clerkUserId": "...",
  "userId": "...",
  "filename": "...",
  "originalName": "...",
  "storagePath": "...",
  "fileType": "pdf|image",
  "extractedText": "...",
  "parsedItems": [
    { "test": "Hemoglobin", "value": 13.6, "unit": "g/dL", "ref_lower": 12, "ref_upper": 16, "raw_text": "..." }
  ],
  "mlPredictions": [
    { "test": "Hemoglobin", "prediction": "normal", "confidence": 0.98, "rule_overridden": false }
  ],
  "recommendations": { "overall_risk": "low", "suggestions": [...], "specialist_referrals":[...] },
  "processed": true,
  "createdAt": "...",
  "updatedAt": "..."
}


Also include users, who_ranges, and optional audit_logs collections.

Frontend (Expo React Native)

Key screens:

Upload screen (file picker, progress bar).

Processing status (Uploaded → Extracting → Parsing → Predicting → Recommending → Done).

Report list + detail view (test table with badges, recommendations, original file preview).

Authentication via Clerk; JWT stored in AsyncStorage.

Helpful utility files: app/utils/api.ts, authSync.ts.

Testing & QA

Unit tests for extraction functions and regex parsing (fixtures).

Integration tests simulate upload → process → DB update.

Manual clinician review for first N reports.

CI: run lint, unit tests, build step in GH Actions.

Track metrics: extraction success rate, average pipeline time, Gemini fail rate, model confidence distribution.

Deployment & Operational Notes

Use separate environments: dev / staging / prod.

Containerize components:

api-server (Node/Express)

ml-worker (Python)

Recommended orchestration: Kubernetes or Docker Compose for small workloads.

Use task queue (Redis + Bull / RabbitMQ) for scaling off heavy jobs.

Secrets management: use Vault / AWS Secrets Manager.

Rate limit upload endpoints and throttle Gemini usage.

Security, Privacy & Ethics

Mark outputs as assistive (not clinical diagnosis).

Use HTTPS (TLS 1.2+).

Store secrets outside repo; do not commit .env.

Data retention policy and user consent for reusing data in retraining.

Encryption at rest (DB provider) and AES for sensitive fields if needed.

Audit logs for ML model versions and prediction changes.

Project Structure (suggested)
/curascan
├─ backend/                 # Node/Express API
│  ├─ routes/
│  ├─middleware
│  ├─ models/               # Mongoose schemas
│          
├─ ml              # Python scripts and models
│  ├─ extractors/
│  ├─ parsing/
│  ├─ predict_model.py
│  ├─ gemini_recommendations.py
│  └─ artifacts/            # model.pkl, scaler.pkl, label_encoder.pkl
├─ frontend/                # Expo React Native app
├─ docs/                    # figures, sequence diagrams, sample reports
├─ scripts/                 # training scripts, data generation
├─ .github/                 # workflows
└─ README.md

Contributing

Fork repo → create feature branch.

Run linters & tests before PR.

Add unit tests for new features.

Use clear commit messages and reference issues.

Acknowledgements & References

PyPDF, pdf2image, XGBoost, scikit-learn, MongoDB, Expo, Clerk.

Gemini API (used for OCR & generative recommendations).

WHO reference ranges (who_ranges.csv).

License

Specify license (e.g., MIT) — replace with your preferred project license.

Appendix — Useful Examples
Example: POST upload (Postman)

Method: POST

URL: {{API_BASE}}/api/upload

Headers: Authorization: Bearer {{token}}

Body: form-data → key file (file), optional fields userId, clerkUserId.

Example: GET processed report

GET {{API_BASE}}/api/reports/{{reportId}} → returns final JSON with mlPredictions and recommendations
