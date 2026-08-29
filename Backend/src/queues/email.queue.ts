import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";
import { env } from "../config/env";

/**
 * The central BullMQ queue for all email send jobs.
 *
 * defaultJobOptions apply to every job added through this queue
 * unless the individual job call overrides them.
 *
 * attempts: total number of times BullMQ will try to process the job.
 *   - Attempt 1 is the initial run.
 *   - Retries 2..N happen after failures according to the backoff strategy.
 *
 * backoff.type "exponential": delay doubles with each retry.
 *   - Retry 1 waits WORKER_BACKOFF_MS
 *   - Retry 2 waits WORKER_BACKOFF_MS * 2
 *   - Retry 3 waits WORKER_BACKOFF_MS * 4
 *   etc.
 *
 * removeOnComplete / removeOnFail control how many finished job
 * records BullMQ keeps in Redis (avoids unbounded memory growth).
 */
export const emailQueue = new Queue("email-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: env.WORKER_MAX_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: env.WORKER_BACKOFF_MS,
    },
    removeOnComplete: { count: 500 }, // keep last 500 completed jobs
    removeOnFail:     { count: 500 }, // keep last 500 failed jobs
  },
});
