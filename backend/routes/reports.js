// backend/routes/reports.js
import express from "express";
import path from "path";
import fs from "fs";
import { Report } from "../models/Report.js"; // adjust if path differs

const router = express.Router();

/**
 * GET /api/reports
 * List recent reports (demo: no auth filter)
 */
router.get("/", async (req, res) => {
  try {
    const reports = await Report.find({}).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ ok: true, reports });
  } catch (err) {
    console.error("GET /api/reports error:", err);
    res.status(500).json({ ok: false, msg: err.message });
  }
});

/**
 * GET /api/reports/:id
 * Return single Report document
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findById(id).lean();
    if (!report) return res.status(404).json({ ok: false, msg: "Report not found" });

    // OPTIONAL: ownership check if you store `owner`/`userId` on Report
    // if (req.user && report.owner && String(report.owner) !== String(req.user.id)) {
    //   return res.status(403).json({ ok: false, msg: "Forbidden" });
    // }

    res.json({ ok: true, report });
  } catch (err) {
    console.error("GET /api/reports/:id error:", err);
    res.status(500).json({ ok: false, msg: err.message });
  }
});

/**
 * GET /api/reports/:id/file
 * Serve the uploaded file (PDF/image) for viewing.
 * NOTE: For demo, this endpoint is unauthenticated. Add auth checks if required.
 */
router.get("/:id/file", async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findById(id).lean();
    if (!report) return res.status(404).json({ ok: false, msg: "Report not found" });

    // storagePath might contain absolute path or you might store filename only
    const uploadsRoot = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "backend", "uploads"));
    // candidate path: prefer storagePath, else build from filename
    const candidate = report.storagePath || path.join(uploadsRoot, report.filename || "");
    const resolved = path.resolve(candidate);

    // security: ensure file is inside uploads root
    if (!resolved.startsWith(uploadsRoot)) {
      console.warn("Unsafe file path attempted:", resolved);
      return res.status(400).json({ ok: false, msg: "Invalid file path" });
    }

    if (!fs.existsSync(resolved)) return res.status(404).json({ ok: false, msg: "File missing on disk" });

    // send file (express handles content-type)
    return res.sendFile(resolved);
  } catch (err) {
    console.error("GET /api/reports/:id/file error:", err);
    return res.status(500).json({ ok: false, msg: err.message });
  }
});

export default router;
