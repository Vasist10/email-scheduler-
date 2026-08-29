import { Router } from "express";
import {
  scheduleEmail,
  getScheduledEmails,
  getSentEmails,
  getFailedEmails,
} from "../controllers/email.controller";
import { searchEmailsHandler } from "../controllers/search.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate";

const router = Router();

// ── Write ──────────────────────────────────────────────────────────────────
router.post(
  "/schedule",
  authMiddleware,
  validate({
    recipients: { type: "array" },
    subject:    { type: "string" },
    body:       { type: "string" },
    startTime:  { type: "string" },
  }),
  scheduleEmail
);

// ── Read ───────────────────────────────────────────────────────────────────
router.get("/scheduled", authMiddleware, getScheduledEmails);
router.get("/sent",      authMiddleware, getSentEmails);
router.get("/failed",    authMiddleware, getFailedEmails);

// ── Search (Elasticsearch) ─────────────────────────────────────────────────
// Must be defined BEFORE any :id param routes to avoid routing conflicts
router.get("/search",    authMiddleware, searchEmailsHandler);

export default router;
