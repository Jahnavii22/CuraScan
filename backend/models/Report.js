// backend/models/Report.js
import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema({
  clerkUserId: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  filename: { type: String },
  originalName: { type: String },
  storagePath: { type: String },
  fileType: { type: String }, 
  extractedText: { type: String, default: "" },
  extractedValues: { type: Array, default: [] }, 
  mlPredictions: { type: Array, default: [] }, 
  recommendations: { type: Object, default: {} },
  processed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const Report = mongoose.model("Report", ReportSchema);
