// backend/server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db.js";

import webhookRoutes from "./routes/webhook.js";
import authRoutes from "./routes/auth.js";
import syncRoutes from "./routes/sync.js";
import profileRoutes from "./routes/profile.js";
import uploadRoutes from "./routes/upload.js";
import processRoutes from "./routes/process.js";
import reportRoutes from "./routes/reports.js";
import uploadImagePost from "./routes/uploadimage.js";
import uploadImageGet from "./routes/uploadimage_get.js";
import path from "path";
dotenv.config();

const app = express();

// raw webhook first
app.use("/webhook", express.raw({ type: "application/json" }), webhookRoutes);

app.use(cors());
app.use(express.json());

connectDB();

app.use("/api", authRoutes);
app.use("/api", syncRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/process", processRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/uploadimage", uploadImagePost);
app.use("/api/uploadimage", uploadImageGet);
app.get("/", (req, res) => res.send("CuraScan backend running ✅"));


const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on port ${PORT}`));