/**
 * Manual verification script for Phase 3
 * Run with:  npx ts-node-dev src/scripts/verifyWorker.ts
 *
 * Covers:
 *   Scenario 1 — Schedule 5 emails, verify all send successfully
 *   Scenario 2 — Hourly limit = 2, verify first 2 send and remaining 3 reschedule
 *   Scenario 3 — Force SMTP failure (bad credentials), verify status becomes FAILED
 *
 * Requires a running PostgreSQL + Redis and a populated .env file.
 * The script does NOT start the worker — run `npm run worker` in a separate terminal first.
 */

import "dotenv/config";
import prisma from "../config/prisma";
import { emailQueue } from "../queues/email.queue";
import { redisConnection } from "../config/redis";
import { getHourlyCount } from "../utils/rateLimiter";

const TEST_USER = "test@example.com";
const PAUSE_MS  = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function printEmailStatuses(ids: string[], label: string) {
  const emails = await prisma.email.findMany({ where: { id: { in: ids } } });
  console.log(`\n── ${label} ──`);
  for (const e of emails) {
    console.log(
      `  ${e.id.slice(0, 8)}  to=${e.to}  status=${e.status}` +
        (e.failureReason ? `  reason="${e.failureReason}"` : "")
    );
  }
}

// ── Scenario 1: 5 emails, all should send ────────────────────────────────
async function scenario1() {
  console.log("\n═══ Scenario 1: 5 emails — expect all SENT ═══");

  const startTime = new Date(Date.now() + 3000); // 3 seconds from now
  const ids: string[] = [];

  for (let i = 0; i < 5; i++) {
    const email = await prisma.email.create({
      data: {
        to: `recipient${i + 1}@example.com`,
        subject: "Scenario 1 test",
        body: `This is test email ${i + 1}`,
        sendAt: new Date(startTime.getTime() + i * 2000),
        status: "SCHEDULED",
        userEmail: TEST_USER,
        campaignId: "scenario-1",
      },
    });

    const delay = Math.max(0, startTime.getTime() - Date.now() + i * 2000);
    const job = await emailQueue.add(
      "send-email",
      { emailId: email.id },
      { delay, jobId: `email-${email.id}` }
    );

    await prisma.email.update({
      where: { id: email.id },
      data: { jobId: job.id ?? null },
    });

    ids.push(email.id);
    console.log(`  Scheduled email ${i + 1} (delay ${delay}ms)`);
  }

  console.log("  Waiting 20s for all jobs to complete...");
  await PAUSE_MS(20_000);
  await printEmailStatuses(ids, "Results after 20s");

  const rateCount = await getHourlyCount(TEST_USER);
  console.log(`  Hourly counter for ${TEST_USER}: ${rateCount}`);
}

// ── Scenario 2: hourly limit = 2, 3 emails should reschedule ─────────────
async function scenario2() {
  console.log("\n═══ Scenario 2: limit=2, 5 emails — expect 2 SENT, 3 rescheduled ═══");
  console.log("  NOTE: To test this accurately, set MAX_EMAILS_PER_HOUR=2 in .env");
  console.log("  and restart the worker before running this scenario.");

  // Check current rate count to see how many slots remain
  const alreadySent = await getHourlyCount(TEST_USER);
  console.log(`  Current hourly count for ${TEST_USER}: ${alreadySent}`);

  const startTime = new Date(Date.now() + 3000);
  const ids: string[] = [];

  for (let i = 0; i < 5; i++) {
    const email = await prisma.email.create({
      data: {
        to: `s2recipient${i + 1}@example.com`,
        subject: "Scenario 2 test",
        body: `Rate limit test email ${i + 1}`,
        sendAt: new Date(startTime.getTime() + i * 1000),
        status: "SCHEDULED",
        userEmail: TEST_USER,
        campaignId: "scenario-2",
      },
    });

    const delay = Math.max(0, startTime.getTime() - Date.now() + i * 1000);
    const job = await emailQueue.add(
      "send-email",
      { emailId: email.id },
      { delay, jobId: `email-${email.id}` }
    );

    await prisma.email.update({
      where: { id: email.id },
      data: { jobId: job.id ?? null },
    });
    ids.push(email.id);
  }

  console.log("  Waiting 15s for rate limit to trigger...");
  await PAUSE_MS(15_000);
  await printEmailStatuses(ids, "Status after 15s (rate limited emails should be SCHEDULED again)");

  const jobCounts = await emailQueue.getJobCounts(
    "delayed", "active", "waiting", "completed", "failed"
  );
  console.log("  Queue counts:", jobCounts);
}

// ── Scenario 3: SMTP failure → FAILED status ─────────────────────────────
async function scenario3() {
  console.log("\n═══ Scenario 3: SMTP failure — expect status FAILED ═══");
  console.log(
    "  To trigger this: temporarily set ETHEREAL_USER=invalid@bad.com " +
      "ETHEREAL_PASS=wrongpass in .env, restart the worker, then run this."
  );

  const email = await prisma.email.create({
    data: {
      to: "victim@example.com",
      subject: "Scenario 3 SMTP failure test",
      body: "This should fail",
      sendAt: new Date(Date.now() + 2000),
      status: "SCHEDULED",
      userEmail: TEST_USER,
      campaignId: "scenario-3",
    },
  });

  const job = await emailQueue.add(
    "send-email",
    { emailId: email.id },
    {
      delay: 2000,
      jobId: `email-${email.id}`,
      attempts: 2, // override to 2 so failure is fast
    }
  );

  await prisma.email.update({
    where: { id: email.id },
    data: { jobId: job.id ?? null },
  });

  console.log(`  Scheduled email ${email.id}`);
  console.log("  Waiting 30s for all retries to exhaust...");
  await PAUSE_MS(30_000);
  await printEmailStatuses([email.id], "Result after retries");
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  try {
    console.log("Phase 3 Verification Script");
    console.log("Make sure the worker is running: npm run worker\n");

    await scenario1();
    // Uncomment to run the other scenarios:
    // await scenario2();
    // await scenario3();
  } finally {
    await prisma.$disconnect();
    await redisConnection.quit();
    process.exit(0);
  }
})();
