// backend/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  clerkId: { type: String, index: true, unique: true, sparse: true },
  name: { type: String, required: false },
  email: { type: String, required: false, unique: true, sparse: true },
  password: { type: String, required: false }, 
  role: { type: String, default: "user" },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model("User", userSchema);
