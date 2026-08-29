import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import prisma from "../config/prisma";
import { emailQueue } from "../queues/email.queue";
import { v4 as uuidv4 } from "uuid";

// Simple RFC-5322-friendly email regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate a list of recipient email addresses.
 * Returns an array of invalid addresses (empty means all valid).
 */
function findInvalidEmails(recipients: unknown[]): string[] {
  return recipients
    .filter((r): r is string => typeof r === "string")
    .filter((r) => !EMAIL_REGEX.test(r.trim()));
}

// ---------------------------------------------------------------------------
// POST /api/emails/schedule
// ---------------------------------------------------------------------------
/**
 * Schedule one email per recipient.
 *
 * Body:
 *   recipients  string[]   – list of recipient addresses
 *   subject     string
 *   body        string
 *   startTime   string     – ISO-8601 datetime for the first email
 *   delayMs     number     – milliseconds gap between consecutive emails (default: env)
 *   hourlyLimit number     – max emails per hour override (informational; enforced by worker)
 *
 * Each email gets its own DB record and its own BullMQ delayed job.
 * Email i is delayed by: max(0, startTime - now) + i * delayMs
 */
export const scheduleEmail = async (req: AuthRequest, res: Response) => {
  try {
    const {
      recipients,
      subject,
      body,
      startTime,
      delayMs = 2000,
      hourlyLimit,
    } = req.body as {
      recipients: string[];
      subject: string;
      body: string;
      startTime: string;
      delayMs?: number;
      hourlyLimit?: number;
    };

    const user = req.user;

    // ── Validate recipients ──────────────────────────────────────────────
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        message: "recipients must be a non-empty array",
      });
    }

    const invalidAddresses = findInvalidEmails(recipients);
    if (invalidAddresses.length > 0) {
      return res.status(400).json({
        message: "Invalid email addresses in recipients",
        invalid: invalidAddresses,
      });
    }

    // ── Validate startTime ───────────────────────────────────────────────
    const startDate = new Date(startTime);
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ message: "Invalid startTime date" });
    }

    if (startDate.getTime() <= Date.now()) {
      return res.status(400).json({
        message: "startTime must be a future date",
      });
    }

    // ── Validate delayMs ─────────────────────────────────────────────────
    const parsedDelay = Number(delayMs);
    if (isNaN(parsedDelay) || parsedDelay < 0) {
      return res.status(400).json({ message: "delayMs must be a non-negative number" });
    }

    // ── Create DB records + BullMQ jobs ──────────────────────────────────
    const baseDelay = startDate.getTime() - Date.now(); // ms until the first email fires

    const campaignId = uuidv4(); // groups this batch together logically

    const scheduledEmails = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i].trim();

      // Each email fires at: startTime + (index * delayMs)
      const emailSendAt = new Date(startDate.getTime() + i * parsedDelay);
      const jobDelay = Math.max(0, baseDelay + i * parsedDelay);

      // 1. Persist the email record (without jobId first — we get jobId after adding to queue)
      const email = await prisma.email.create({
        data: {
          to: recipient,
          subject,
          body,
          sendAt: emailSendAt,
          status: "SCHEDULED",
          userEmail: user.email,
          campaignId,
        },
      });

      // 2. Add a delayed BullMQ job for this specific email
      const job = await emailQueue.add(
        "send-email",
        { emailId: email.id },
        {
          delay: jobDelay,
          jobId: `email-${email.id}`, // deterministic jobId prevents duplicates on restart
        }
      );

      // 3. Store the BullMQ job ID back onto the email record
      const updatedEmail = await prisma.email.update({
        where: { id: email.id },
        data: { jobId: job.id ?? null },
      });

      scheduledEmails.push(updatedEmail);
    }

    return res.status(201).json({
      message: "Emails scheduled successfully",
      campaignId,
      totalEmails: scheduledEmails.length,
      scheduledEmails,
    });
  } catch (error) {
    console.error("[scheduleEmail]", error);
    return res.status(500).json({ message: "Failed to schedule emails" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/emails/scheduled
// ---------------------------------------------------------------------------
export const getScheduledEmails = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;

    const emails = await prisma.email.findMany({
      where: {
        userEmail: user.email,
        status: { in: ["SCHEDULED", "PROCESSING"] },
      },
      orderBy: { sendAt: "asc" },
    });

    return res.json({ emails });
  } catch (error) {
    console.error("[getScheduledEmails]", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch scheduled emails" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/emails/sent
// ---------------------------------------------------------------------------
export const getSentEmails = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;

    const emails = await prisma.email.findMany({
      where: { userEmail: user.email, status: "SENT" },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ emails });
  } catch (error) {
    console.error("[getSentEmails]", error);
    return res.status(500).json({ message: "Failed to fetch sent emails" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/emails/failed
// ---------------------------------------------------------------------------
export const getFailedEmails = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;

    const emails = await prisma.email.findMany({
      where: { userEmail: user.email, status: "FAILED" },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ emails });
  } catch (error) {
    console.error("[getFailedEmails]", error);
    return res.status(500).json({ message: "Failed to fetch failed emails" });
  }
};
