import prisma from "../config/prisma";

/**
 * On server/worker startup, reset any emails stuck in PROCESSING back to
 * SCHEDULED so they can be re-processed.
 *
 * Why they get stuck:
 *   The worker marks an email PROCESSING before sending. If the worker
 *   process dies between that update and the subsequent SENT/FAILED update,
 *   the email is left in PROCESSING forever — it won't be retried because
 *   BullMQ considers the job complete (or stalled, which BullMQ re-queues,
 *   but our worker skips PROCESSING emails by default).
 *
 * Safety:
 *   We only reset emails that have been in PROCESSING for more than
 *   STUCK_THRESHOLD_MS (default 10 minutes) to avoid resetting an email
 *   that is actively being processed by a concurrent worker right now.
 */
const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export const recoverStuckEmails = async (): Promise<void> => {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

  const result = await prisma.email.updateMany({
    where: {
      status: "PROCESSING",
      updatedAt: { lt: cutoff },
    },
    data: {
      status: "SCHEDULED",
      failureReason: "Reset from PROCESSING on startup (worker likely crashed)",
    },
  });

  if (result.count > 0) {
    console.log(
      `[Startup] Recovered ${result.count} stuck PROCESSING email(s) → SCHEDULED`
    );
  }
};
