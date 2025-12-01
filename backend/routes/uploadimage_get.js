// backend/routes/uploadimage_get.js
import express from "express";
import { Report } from "../models/Report.js";

const router = express.Router();

// GET /api/uploadimage/:id → returns the saved report from MongoDB
router.get("/:id", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).lean();
    if (!report) {
      return res.status(404).json({ ok: false, msg: "Report not found" });
    }
    return res.json({ ok: true, report });
  } catch (err) {
    console.error("[uploadimage_get] error:", err);
    return res.status(500).json({ ok: false, msg: err.message });
  }
});

export default router;
