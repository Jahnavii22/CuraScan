// backend/routes/upload.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Report } from "../models/Report.js";

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random()*1e6)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

// POST /api/upload (multipart form-data: file, userId)
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const { userId } = req.body;
    if (!file) return res.status(400).json({ ok: false, msg: "No file uploaded" });

    // if userId is not a valid ObjectId you either need to remove the type requirement
    // or pass a valid Mongo ObjectId. For testing you can omit userId or set to undefined.
    const report = await Report.create({
      userId: userId || undefined,
      filename: file.filename,
      originalName: file.originalname,
      fileType: (file.mimetype === "application/pdf") ? "pdf" : "image",
      storagePath: path.resolve(file.path),
      processed: false
    });

    res.json({ ok: true, reportId: report._id, filename: file.filename });
  } catch (err) {
    console.error("upload error", err);
    res.status(500).json({ ok: false, msg: "Server error", error: err.message });
  }
});

export default router;
