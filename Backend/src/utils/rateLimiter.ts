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
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day   = String(now.getUTCDate()).padStart(2, "0");
  const hour  = String(now.getUTCHours()).padStart(2, "0");
  return `email_rate:${userEmail}:${year}-${month}-${day}-${hour}`;
}

/**
 * Atomically checks and increments the per-user hourly send counter.
 *
 * @param userEmail   The user whose quota to check
 * @param maxOverride If provided, overrides env.MAX_EMAILS_PER_HOUR for this
 *                    specific campaign. This is the value the user set in the
 *                    compose modal (hourlyLimit). Defaults to env.MAX_EMAILS_PER_HOUR.
 *
 * @returns
 *   allowed    – true when the user is within their hourly limit
 *   count      – counter value after this increment
 *   maxPerHour – the effective limit that was used
 *   resetAt    – Unix ms timestamp of the start of the next UTC hour
 *   redisKey   – the Redis key used (for logging/debugging)
 */
export const checkHourlyLimit = async (
  userEmail: string,
  maxOverride?: number
): Promise<{
  allowed:    boolean;
  count:      number;
  maxPerHour: number;
  resetAt:    number;
  redisKey:   string;
}> => {
  // Use the per-campaign override if provided, otherwise fall back to the
  // global env setting. This is the critical fix: previously only the global
  // default was ever used, meaning the compose-modal hourlyLimit was ignored.
  const maxPerHour = (maxOverride !== undefined && maxOverride > 0)
    ? maxOverride
    : env.MAX_EMAILS_PER_HOUR;

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

  const allowed = count <= maxPerHour;

  // ── Detailed rate-limit logging ────────────────────────────────────────
  console.log(
    `[RateLimit] user=${userEmail} key=${redisKey} ` +
    `count=${count} max=${maxPerHour} ` +
    `allowed=${allowed} resetAt=${new Date(resetAt).toISOString()}`
  );

  return { allowed, count, maxPerHour, resetAt, redisKey };
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
