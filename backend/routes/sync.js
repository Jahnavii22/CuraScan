// backend/routes/sync.js
import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../models/User.js";

dotenv.config();
const router = express.Router();

/**
 * POST /api/users/sync
 * Body: { clerkUserId?, email?, name? }
 * Upserts user and returns a JWT
 */
router.post("/users/sync", async (req, res) => {
  try {
    // defensive: handle when req.body is undefined
    const body = req.body || {};
    const { clerkUserId, email, name } = body;

    if (!clerkUserId && !email) {
      console.warn("sync error: missing clerkUserId and email. body:", body);
      return res.status(400).json({ ok: false, msg: "clerkUserId or email required" });
    }

    // Build update doc
    const update = {};
    if (clerkUserId) update.clerkId = clerkUserId;
    if (email) update.email = email;
    if (name) update.name = name;

    const query = clerkUserId ? { clerkId: clerkUserId } : { email };

    const user = await User.findOneAndUpdate(
      query,
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // sign a JWT
    const payload = { id: user._id, clerkId: user.clerkId ?? null, email: user.email ?? null };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    console.log("sync success:", { clerkUserId, email, userId: user._id });

    return res.json({ ok: true, user, token });
  } catch (err) {
    console.error("sync error", err);
    return res.status(500).json({ ok: false, msg: "Server error" });
  }
});

export default router;
