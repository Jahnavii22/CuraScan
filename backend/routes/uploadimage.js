// backend/routes/uploadimage.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import dotenv from "dotenv";
import { Report } from "../models/Report.js";

dotenv.config();
const router = express.Router();

// uploads folder - adjust if your uploads root is different
const uploadDir = path.join(process.cwd(), "backend", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${unique}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// POST /api/uploadimage
// multipart/form-data: file + optional clerkUserId (or other fields)
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const clerkUserId = req.body?.clerkUserId ?? req.body?.userId ?? null;

    if (!file) return res.status(400).json({ ok: false, msg: "No file uploaded" });

    const PYTHON_PATH = process.env.PYTHON_PATH || "python";
    const pipelineScript = path.join(process.cwd(), "ml", "gemini_blood_pipeline.py");
    const csvPath = path.join(process.cwd(), "ml", "dataset", "who_ranges.csv");
    const recommendScript = path.join(process.cwd(), "ml", "gemini_recommendations.py");

    console.log("[uploadimage] running pipeline for:", file.path);

    // Run image pipeline script (should print JSON)
    const pipelineProc = spawnSync(PYTHON_PATH, [pipelineScript, "--image", file.path, "--csv", csvPath], {
      encoding: "utf-8",
      maxBuffer: 80 * 1024 * 1024,
    });

    if (pipelineProc.error) throw pipelineProc.error;
    if (pipelineProc.status !== 0) {
      console.error("[uploadimage] pipeline stderr:", pipelineProc.stderr);
      return res.status(500).json({ ok: false, msg: "Pipeline failed", stderr: pipelineProc.stderr });
    }

    const pipelineRaw = pipelineProc.stdout || "";
    let pipelineJson = null;

    try {
      pipelineJson = JSON.parse(pipelineRaw);
    } catch (e) {
      // fallback: extract first JSON block
      const m = pipelineRaw.match(/\{[\s\S]*\}\s*/);
      if (m) {
        try {
          pipelineJson = JSON.parse(m[0]);
        } catch (ee) {
          pipelineJson = null;
        }
      }
    }

    if (!pipelineJson) {
      // return raw output to help debugging
      console.warn("[uploadimage] could not parse pipeline JSON, returning raw output");
      return res.status(500).json({ ok: false, msg: "Could not parse pipeline output", raw: pipelineRaw });
    }

    // Prepare tests JSON file for recommendations script
    const testsInput = pipelineJson.tests || [];
    const tmpTestsPath = path.join(uploadDir, `${path.basename(file.filename)}_tests.json`);
    try {
      fs.writeFileSync(tmpTestsPath, JSON.stringify({ tests: testsInput }, null, 2), "utf-8");
    } catch (e) {
      console.warn("[uploadimage] write tmp tests file failed:", e.message || e);
    }

    // Attempt to run recommendations script (gemini or local)
    let recJson = null;
    try {
      const recProc = spawnSync(PYTHON_PATH, [recommendScript, tmpTestsPath], {
        encoding: "utf-8",
        maxBuffer: 30 * 1024 * 1024,
      });
      if (recProc && recProc.stdout) {
        try {
          recJson = JSON.parse(recProc.stdout);
        } catch (e) {
          const mm = (recProc.stdout || "").match(/\{[\s\S]*\}/);
          if (mm) {
            try { recJson = JSON.parse(mm[0]); } catch { recJson = null; }
          }
        }
      }
    } catch (e) {
      console.warn("[uploadimage] recommendations script failed:", e.message || e);
    }

    // fallback simple recommendations if recJson still null
    if (!recJson) {
      recJson = { overall_risk: (pipelineJson?.summary?.toLowerCase?.().includes("warning") ? "high" : "unknown"), suggestions: [], specialist_referrals: [] };
      for (const t of testsInput) {
        const name = (t.name || t.test || "").toLowerCase();
        const val = t.value;
        if (name.includes("glucose") && val && Number(val) > 99) {
          recJson.suggestions.push(`${t.name}: Reduce sugar intake and check HbA1c.`);
          recJson.specialist_referrals.push({ test: t.name, specialist: "Endocrinologist", urgency: "moderate" });
        }
        if (name.includes("creatinine") && val && Number(val) > 1.4) {
          recJson.suggestions.push(`${t.name}: Check kidney function and stay hydrated.`);
          recJson.specialist_referrals.push({ test: t.name, specialist: "Nephrologist", urgency: "moderate" });
        }
      }
    }

    // Save Report to DB using your existing schema
    let savedReport = null;
    try {
      savedReport = await Report.create({
        clerkUserId: clerkUserId ?? undefined,
        filename: file.filename,
        originalName: file.originalname,
        storagePath: path.resolve(file.path),
        fileType: file.mimetype || "image",
        extractedText: pipelineJson.raw_output ?? JSON.stringify(pipelineJson),
        extractedValues: pipelineJson.tests || [],
        mlPredictions: pipelineJson.tests || [],
        recommendations: recJson,
        processed: true,
      });
      console.log("[uploadimage] saved report id:", savedReport._id);
    } catch (dbErr) {
      console.warn("[uploadimage] failed saving Report to DB:", dbErr?.message || dbErr);
      savedReport = null;
    }

    // cleanup tmp file if exists
    try { if (fs.existsSync(tmpTestsPath)) fs.unlinkSync(tmpTestsPath); } catch (e) {}

    // Build response
    const payload = {
      ok: true,
      file: { name: file.filename, original: file.originalname, path: file.path },
      pipeline: pipelineJson,
      recommendations: recJson,
    };

    if (savedReport) {
      payload.report = savedReport;
      payload.reportId = savedReport._id;
    }

    return res.json(payload);
  } catch (err) {
    console.error("[uploadimage] error:", err);
    return res.status(500).json({ ok: false, msg: err.message || "Server error", stack: err.stack });
  }
});

export default router;
