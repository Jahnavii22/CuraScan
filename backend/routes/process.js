// backend/routes/process.js
import express from "express";
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { Report } from "../models/Report.js";
import { runExtractor } from "../utils/runExtractor.js";
import { runRecommendations } from "../utils/runRecommendations.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function applyHemoglobinRule(preds, items) {
  return preds.map((p) => {
    if (/hemoglobin/i.test(p.test)) {
      const testItem = items.find((x) => /hemoglobin/i.test(x.test));
      const sex = testItem?.sex || "M";
      const lower = sex === "F" ? 12.0 : 13.0;
      const upper = sex === "F" ? 16.0 : 17.5;
      if (p.value < lower) p.prediction = "low";
      else if (p.value > upper) p.prediction = "high";
      else p.prediction = "normal";
      p.rule_overridden = true;
    }
    return p;
  });
}

router.post("/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await Report.findById(reportId);
    if (!report) return res.status(404).json({ ok: false, msg: "Report not found" });

    const filePath = report.storagePath || path.resolve(process.env.UPLOAD_DIR || "./uploads", report.filename);
    if (!fs.existsSync(filePath)) return res.status(400).json({ ok: false, msg: "File missing" });

    const PYTHON_PATH = process.env.PYTHON_PATH || path.join(process.cwd(), ".venv", "Scripts", "python.exe");

    const extractScript = path.resolve(__dirname, "..", "scripts", "extract_pdf.py");
    const parseScript = path.resolve(__dirname, "..", "ml", "parse_extracted.py");
    const predictScript = path.resolve(__dirname, "..", "ml", "predict_model.py");
    const recScript = path.resolve(__dirname, "..", "ml", "gemini_recommendations.py");

    console.log("🔍 Running PDF Analysis for:", filePath);

    // Step 1️⃣ Extract Text
    const extracted = await runExtractor(PYTHON_PATH, extractScript, filePath);
    const extractedText = extracted.extracted_text || extracted.extractedText || "";
    if (!extractedText) return res.status(500).json({ ok: false, msg: "Extraction failed" });

    // Step 2️⃣ Parse
    const tmpExtracted = path.join(path.dirname(filePath), `${Date.now()}_extracted.json`);
    fs.writeFileSync(tmpExtracted, JSON.stringify({ extracted_text: extractedText }), "utf-8");
    const tmpParsed = path.join(path.dirname(filePath), `${Date.now()}_items.json`);
    const parseOut = spawnSync(PYTHON_PATH, [parseScript, tmpExtracted, tmpParsed], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    if (parseOut.error || parseOut.status !== 0) {
      console.error("Parse stderr:", parseOut.stderr);
      return res.status(500).json({ ok: false, msg: "Parsing failed", error: parseOut.stderr });
    }
    const parsed = JSON.parse(fs.readFileSync(tmpParsed, "utf-8"));
    const items = parsed.items || [];

    // Step 3️⃣ Predict
    const predict = spawnSync(PYTHON_PATH, [predictScript], {
      input: JSON.stringify({ items }),
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    if (predict.error || predict.status !== 0) {
      console.error("Predict stderr:", predict.stderr);
      return res.status(500).json({ ok: false, msg: "Prediction failed", error: predict.stderr });
    }
    const predResult = JSON.parse(predict.stdout || "{}");
    const predictions = predResult.predictions || [];
    const finalPreds = applyHemoglobinRule(predictions, items);

    // Step 4️⃣ Gemini Recommendations
    let recommendations = { overall_risk: "unknown", suggestions: [], specialist_referrals: [] };
    try {
      const recommendInput = { mlPredictions: finalPreds, extractedValues: items, reportId };
      recommendations = await runRecommendations(PYTHON_PATH, recScript, recommendInput, {
        envExtra: { GEMINI_API_KEY: process.env.GEMINI_API_KEY || "" },
      });
    } catch (err) {
      console.error("⚠️ Gemini recommendations failed:", err.message);
    }

    // Step 5️⃣ Save to DB
    report.extractedText = extractedText;
    report.extractedValues = items;
    report.mlPredictions = finalPreds;
    report.recommendations = recommendations;
    report.processed = true;
    await report.save();

    try { fs.unlinkSync(tmpExtracted); fs.unlinkSync(tmpParsed); } catch {}

    res.json({ ok: true, report });
  } catch (err) {
    console.error("Process error:", err);
    res.status(500).json({ ok: false, msg: err.message, stack: err.stack });
  }
});

export default router;
