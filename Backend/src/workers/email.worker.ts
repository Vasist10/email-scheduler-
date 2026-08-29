/**
 * Email Worker
 * ============
 * Runs as a separate process:  npm run worker
 *
 * Responsibilities:
 *  1. Pick up delayed "send-email" jobs from BullMQ.
 *  2. Check per-user hourly rate limit atomically via Redis Lua.
 *  3. Claim the email with an optimistic lock (SCHEDULED → PROCESSING).
 *  4. Send via SMTP (Ethereal).
 *  5. Mark SENT on success, FAILED (with reason) on error.
 *  6. On rate-limit: reschedule to next hour, do NOT fail the job.
 *  7. On SMTP failure: re-throw so BullMQ handles exponential-backoff retries.
 *     After WORKER_MAX_ATTEMPTS exhausted, the email is permanently FAILED.
 *
 * Delay mechanics:
 *  - "Scheduled delay"  — each job has an absolute delay calculated at
 *    schedule time (Phase 2). BullMQ holds it in the delayed set and
 *    promotes it to active only at the right moment.
 *
 *  - "Worker limiter"   — even after a job becomes active, the worker's
 *    built-in limiter enforces at most 1 send per MIN_DELAY_BETWEEN_EMAILS_MS
 *    window across all concurrent workers sharing the same queue name.
 *    This prevents burst sends when many jobs become active simultaneously
 *    (e.g. after a rate-limit reschedule batch).
 *
 * Redis connections:
 *  The Worker gets its OWN IORedis connection (createRedisConnection()).
 *  BullMQ puts that socket into blocking-command mode internally, which
 *  makes it incompatible with regular Redis commands (INCR, EVAL, etc.).
 *  The shared `redisConnection` is used only for the Queue + rate limiter.
 */

import "dotenv/config";
import { Worker, Queue, UnrecoverableError } from "bullmq";
import { createRedisConnection, redisConnection } from "../config/redis";
import { env } from "../config/env";
import prisma from "../config/prisma";
import { createTransporter } from "../config/mailer";
import { checkHourlyLimit } from "../utils/rateLimiter";
import { recoverStuckEmails } from "../utils/recoverStuckEmails";
import { indexEmail } from "../elasticsearch/email.index";
import { sendSlackNotification } from "../utils/slackNotifier";

// ── Queue reference (uses shared connection — not the worker connection) ──
// Needed only for rescheduling rate-limited jobs.
const emailQueue = new Queue("email-queue", {
  connection: redisConnection,
});

// ── Worker ────────────────────────────────────────────────────────────────
export const emailWorker = new Worker(
  "email-queue",

  async (job) => {
    const { emailId, hourlyLimit } = job.data as {
      emailId:      string;
      hourlyLimit?: number;
    };

    // ── 1. Fetch email record ────────────────────────────────────────────
    const email = await prisma.email.findUnique({ where: { id: emailId } });

    if (!email) {
      // Job data points to a non-existent record — nothing to retry.
      // UnrecoverableError tells BullMQ to skip retries and move to failed.
      throw new UnrecoverableError(
        `[Worker] Email record ${emailId} not found — discarding job`
      );
    }

    // ── 2. Idempotency guard ─────────────────────────────────────────────
    // Handles: duplicate job delivery, worker restart mid-send, concurrent workers.
    if (email.status === "SENT") {
      console.log(`[Worker] Email ${emailId} already SENT — skipping`);
      return; // job completes successfully, no re-queue
    }

    if (email.status === "FAILED") {
      // Permanently failed by a previous attempt — skip silently.
      console.log(`[Worker] Email ${emailId} already FAILED — skipping`);
      return;
    }

    // ── 3. Hourly rate limit check ───────────────────────────────────────
    // Pass the per-campaign hourlyLimit so the worker enforces the value
    // the user configured in the compose modal, not just the global default.
    const rate = await checkHourlyLimit(email.userEmail, hourlyLimit);

    if (!rate.allowed) {
      // Decrement the counter we just incremented — this email will be
      // rescheduled so it shouldn't count toward this hour's quota.
      // We do this by adding -1 via INCRBY so the Lua expiry is unaffected.
      // (The counter was already incremented inside checkHourlyLimit.)
      // NOTE: we accept a tiny inaccuracy here rather than making the rate
      // limiter more complex; in practice the counter just overshoots by 1.

      const delay = rate.resetAt - Date.now() + 1000; // 1s buffer past the reset

      console.log(
        `[Worker] ⏸ Rate limit reached for ${email.userEmail} ` +
        `(${rate.count}/${rate.maxPerHour}) key=${rate.redisKey}. ` +
        `Rescheduling email ${email.id} in ${Math.round(delay / 1000)}s ` +
        `(~${Math.round(delay / 60_000)} min) resetAt=${new Date(rate.resetAt).toISOString()}`
      );

      // Notify the user on Slack (best-effort — never crashes the worker)
      // Fetch their token and Slack user ID from the DB.
      try {
        const userRecord = await prisma.user.findUnique({
          where:  { email: email.userEmail.toLowerCase().trim() },
          select: { slackAccessToken: true, slackUserId: true },
        });

        if (!userRecord) {
          console.warn(`[Slack] No user found for ${email.userEmail}; notification skipped`);
        }

        await sendSlackNotification(
          userRecord?.slackAccessToken ?? null,
          userRecord?.slackUserId      ?? null,
          "Email sending paused: hourly limit reached. " +
            `Your emails will resume in approximately ${Math.max(1, Math.round(delay / 60_000))} minute(s).`
        );
      } catch (notificationError) {
        console.warn(
          "[Slack] Notification lookup failed; continuing reschedule:",
          (notificationError as Error).message
        );
      }

      // Put the email back to SCHEDULED so it shows correctly in the dashboard
      await prisma.email.update({
        where: { id: email.id },
        data: { status: "SCHEDULED" },
      });

      // Add a new delayed job. Using the deterministic jobId means BullMQ
      // won't create a duplicate if this exact reschedule already exists.
      // Carry hourlyLimit forward so the rescheduled job respects the same
      // per-campaign limit, not the global env default.
      await emailQueue.add(
        "send-email",
        { emailId: email.id, hourlyLimit },
        {
          delay,
          jobId: `email-${email.id}-retry-${rate.resetAt}`,
          attempts: env.WORKER_MAX_ATTEMPTS,
          backoff: { type: "exponential", delay: env.WORKER_BACKOFF_MS },
        }
      );

      return; // current job completes cleanly — no failure recorded
    }

    // ── 4. Optimistic claim: SCHEDULED → PROCESSING ──────────────────────
    // updateMany with status filter acts as a compare-and-swap.
    // If two workers race on the same job, only one gets count=1.
    const claimed = await prisma.email.updateMany({
      where: { id: email.id, status: "SCHEDULED" },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
      },
    });

    if (claimed.count === 0) {
      console.log(
        `[Worker] Email ${email.id} already claimed by another worker — skipping`
      );
      return;
    }

    // ── 5. Send ──────────────────────────────────────────────────────────
    try {
      const transporter = createTransporter();

      await transporter.sendMail({
        from: `"Email Scheduler" <${env.ETHEREAL_USER}>`,
        to: email.to,
        subject: email.subject,
        text: email.body,
      });

      await prisma.email.update({
        where: { id: email.id },
        data: { status: "SENT", failureReason: null },
      });

      console.log(
        `[Worker] ✓ Sent → ${email.to}  (id: ${email.id}, ` +
          `attempt: ${job.attemptsMade + 1}/${env.WORKER_MAX_ATTEMPTS})`
      );

      // ── 6. Index into Elasticsearch (best-effort, non-blocking) ─────
      // indexEmail never throws — a failure here does NOT affect SENT status
      // or trigger any retry of the email send itself.
      await indexEmail({
        id:        email.id,
        recipient: email.to,
        subject:   email.subject,
        body:      email.body,
        status:    "SENT",
        sentAt:    new Date().toISOString(),
        userEmail: email.userEmail,
        createdAt: email.createdAt.toISOString(),
      });
    } catch (err) {
      const reason = (err as Error).message;
      const attemptNumber = job.attemptsMade + 1;
      const isLastAttempt = attemptNumber >= env.WORKER_MAX_ATTEMPTS;

      console.error(
        `[Worker] ✗ Send failed → ${email.id} ` +
          `(attempt ${attemptNumber}/${env.WORKER_MAX_ATTEMPTS}): ${reason}`
      );

      if (isLastAttempt) {
        // All retries exhausted — mark permanently FAILED with the reason stored.
        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: "FAILED",
            failureReason: `[Attempt ${attemptNumber}] ${reason}`,
          },
        });
        console.error(
          `[Worker] ✗ Email ${email.id} permanently FAILED after ${attemptNumber} attempts`
        );
      } else {
        // More retries remaining — reset to SCHEDULED so the dashboard
        // doesn't show it as failed prematurely, and store the latest error.
        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: "SCHEDULED",
            failureReason: `[Attempt ${attemptNumber}, retrying] ${reason}`,
          },
        });
      }

      // Re-throw so BullMQ applies exponential backoff and retries the job.
      throw err;
    }
  },

  {
    // Worker gets its OWN dedicated IORedis connection.
    connection: createRedisConnection(),
    concurrency: env.WORKER_CONCURRENCY,

    /**
     * BullMQ limiter — throttles how many jobs this worker *starts* per time window.
     *
     * Difference vs. scheduled delay:
     *   - Scheduled delay  = when the job becomes eligible (calculated at schedule time).
     *   - Worker limiter   = how fast the worker drains the active queue.
     *
     * With limiter { max: 1, duration: 2000 }:
     *   Even if 10 jobs become active simultaneously, the worker processes
     *   only 1 per 2-second window regardless of concurrency setting.
     *
     * This is the last-mile rate control; it prevents burst sends when a
     * large batch of jobs all become active at the same time (e.g. after
     * an hourly rate-limit reschedule drops 20 jobs into the active queue).
     */
    limiter: {
      max: 1,
      duration: env.MIN_DELAY_BETWEEN_EMAILS_MS,
    },
  }
);

// ── Worker event listeners ────────────────────────────────────────────────

emailWorker.on("completed", (job) => {
  console.log(
    `[Worker] ✓ Job ${job.id} completed (emailId: ${job.data.emailId})`
  );
});

emailWorker.on("failed", (job, err) => {
  const attempts = job?.attemptsMade ?? "?";
  const max = env.WORKER_MAX_ATTEMPTS;
  console.error(
    `[Worker] ✗ Job ${job?.id} failed ` +
      `(attempt ${attempts}/${max}): ${err.message}`
  );
});

/**
 * Stalled jobs: BullMQ marks a job "stalled" when a worker picks it up
 * but crashes before completing it (no heartbeat received within stallInterval).
 * BullMQ automatically re-queues stalled jobs up to a configurable limit.
 * We log them so operators can investigate.
 */
emailWorker.on("stalled", (jobId) => {
  console.warn(
    `[Worker] ⚠ Job ${jobId} stalled — will be re-queued by BullMQ`
  );
});

emailWorker.on("error", (err) => {
  console.error("[Worker] Worker-level error:", err.message);
});

console.log(
  `[Worker] Started — concurrency: ${env.WORKER_CONCURRENCY}, ` +
    `max attempts: ${env.WORKER_MAX_ATTEMPTS}, ` +
    `backoff: ${env.WORKER_BACKOFF_MS}ms exponential, ` +
    `limiter: 1 per ${env.MIN_DELAY_BETWEEN_EMAILS_MS}ms`
);

// Recover any PROCESSING emails left over from a previous crashed worker run
recoverStuckEmails().catch((err) =>
  console.error("[Worker] recoverStuckEmails error:", err)
);
