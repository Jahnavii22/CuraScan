// backend/routes/profile.js
import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { User } from "../models/User.js";

const router = express.Router();


router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;
