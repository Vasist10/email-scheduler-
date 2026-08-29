import { redisConnection } from "../config/redis";
import { env } from "../config/env";

/**
 * Lua script that atomically:
 *   1. Increments the per-user hourly counter
 *   2. Sets a 3600-second expiry on the key ONLY when the key is first created
 *      (i.e. when INCR returns 1), preventing a race between INCR and EXPIRE.
 *
 * Returns the new counter value as a number.
 *
 * Why Lua?  Redis executes Lua scripts atomically — no other command can
 * interleave between the INCR and the EXPIRE, so:
 *   - Multiple concurrent workers cannot double-count or miss the expiry.
 *   - A crash between increment and expiry is impossible.
 */
const INCR_WITH_EXPIRE_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`;

/**
 * Build the Redis key for a given user + UTC hour bucket.
 * Format: email_rate:<userEmail>:<YYYY>-<MM>-<DD>-<HH>
 */
function buildRateKey(userEmail: string, now: Date): string {
  const year  = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0"); // 0-indexed → 1-indexed
  const day   = String(now.getUTCDate()).padStart(2, "0");
  const hour  = String(now.getUTCHours()).padStart(2, "0");
  return `email_rate:${userEmail}:${year}-${month}-${day}-${hour}`;
}

/**
 * Atomically checks and increments the per-user hourly send counter.
 *
 * @returns
 *   allowed  – true when the user is within their hourly limit
 *   count    – counter value after this increment
 *   maxPerHour
 *   resetAt  – Unix ms timestamp of the start of the next UTC hour
 */
export const checkHourlyLimit = async (
  userEmail: string
): Promise<{
  allowed: boolean;
  count: number;
  maxPerHour: number;
  resetAt: number;
}> => {
  const maxPerHour = env.MAX_EMAILS_PER_HOUR;
  const now = new Date();

  const redisKey = buildRateKey(userEmail, now);

  // Single atomic operation: increment + conditional expire
  const count = (await redisConnection.eval(
    INCR_WITH_EXPIRE_SCRIPT,
    1,          // number of KEYS
    redisKey,   // KEYS[1]
    "3600"      // ARGV[1] — TTL in seconds
  )) as number;

  // Start of the next UTC hour
  const resetAt = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours() + 1,
    0, 0, 0
  );

  return {
    allowed: count <= maxPerHour,
    count,
    maxPerHour,
    resetAt,
  };
};

/**
 * Returns the current hourly counter for a user without incrementing.
 * Useful for diagnostics / admin endpoints.
 */
export const getHourlyCount = async (userEmail: string): Promise<number> => {
  const now = new Date();
  const redisKey = buildRateKey(userEmail, now);
  const val = await redisConnection.get(redisKey);
  return val ? parseInt(val, 10) : 0;
};
