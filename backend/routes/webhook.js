// backend/routes/webhook.js
import express from "express";
import { Webhook } from "svix";
import dotenv from "dotenv";
import { User } from "../models/User.js";

dotenv.config();
const router = express.Router();

/**
 * POST /webhook/clerk-webhook
 * - express.raw ensures we get the raw bytes for signature verification
 * - SKIP_WEBHOOK_VERIFY is supported for local dev (optional), but remove for production
 */
router.post(
  "/clerk-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!req.body || !(req.body instanceof Buffer)) {
      console.error("Webhook: missing raw body buffer");
      return res.status(400).send("Bad request");
    }

    // Dev mode: skip verification (useful locally) but still upsert user for testing
    if (process.env.SKIP_WEBHOOK_VERIFY === "true") {
      try {
        const bodyJson = JSON.parse(req.body.toString("utf8"));
        console.warn("⚠️ Dev mode: skipping verify — received event:", bodyJson.type || "(no type)");
        console.log("Dev payload:", bodyJson);

        if (bodyJson.type === "user.created" && bodyJson.data) {
          const u = bodyJson.data;
          const email = u.email_addresses?.[0]?.email_address ?? null;
          const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
          try {
            const upserted = await User.findOneAndUpdate(
              { clerkId: u.id },
              { clerkId: u.id, name, email },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            console.log("Dev webhook: upserted user:", upserted?.email || upserted?._id);
          } catch (e) {
            console.error("Dev webhook upsert error:", e);
          }
        }

        return res.status(200).json({ received: true, dev: true });
      } catch (err) {
        console.error("Dev webhook parse error:", err);
        return res.status(400).send("Invalid JSON");
      }
    }

    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      console.error("Webhook: CLERK_WEBHOOK_SECRET not set");
      return res.status(500).send("Webhook secret not configured");
    }

    try {
      const wh = new Webhook(secret);
      const evt = wh.verify(req.body, req.headers); // throws on invalid signature
      console.log("✅ Verified Clerk webhook event:", evt.type);

      // Handle events
      if (evt.type === "user.created") {
        const u = evt.data;
        const email = u.email_addresses?.[0]?.email_address ?? null;
        const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
        try {
          const upserted = await User.findOneAndUpdate(
            { clerkId: u.id },
            { clerkId: u.id, name, email },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          console.log("Webhook: upserted user:", upserted?.email || upserted?._id);
        } catch (e) {
          console.error("Webhook upsert error:", e);
        }
      }

      // handle other events if desired (user.updated, user.deleted, etc.)

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("❌ Webhook verification failed:", err?.message || err);
      return res.status(400).send("Invalid signature");
    }
  }
);

export default router;
