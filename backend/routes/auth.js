// backend/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

console.log("✅ authRoutes module loaded");

// ========================== REGISTER ==========================
router.post("/register", async (req, res) => {
  console.log("[auth] POST /register body:", req.body);

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ msg: "Please fill all fields" });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      console.log("[auth] User already registered:", email);
      return res.status(400).json({ msg: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    console.log("[auth] New user registered:", email);
    res.status(201).json({ msg: "User registered successfully!" });
  } catch (err) {
    console.error("[auth] Register error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ========================== LOGIN ==========================
router.post("/login", async (req, res) => {
  console.log("[auth] POST /login body:", req.body);

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: "Please enter all fields" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("[auth] No user found for email:", email);
      return res.status(400).json({ msg: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      console.log("[auth] Invalid credentials for:", email);
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id, clerkId: user.clerkId ?? null, email: user.email ?? null }, process.env.JWT_SECRET, { expiresIn: "7d" });

    console.log("[auth] Login successful for:", email);
    res.json({
      msg: "Login successful!",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("[auth] Login error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;
