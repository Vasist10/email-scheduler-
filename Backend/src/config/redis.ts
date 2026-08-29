import IORedis, { RedisOptions } from "ioredis";
import { env } from "./env";

/**
 * Base Redis connection options shared across all connections.
 * BullMQ requires maxRetriesPerRequest: null on every connection it uses.
 */
const redisOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
};

/**
 * Primary shared connection — used by:
 *   - BullMQ Queue (adding jobs)
 *   - Rate limiter (INCR / EXPIRE commands via Lua)
 *
 * Do NOT pass this directly to a BullMQ Worker.
 * BullMQ Workers must have their own dedicated connection
 * because the Worker puts IORedis into blocking/subscriber mode
 * which is incompatible with regular Redis commands on the same socket.
 */
export const redisConnection = new IORedis(redisOptions);

redisConnection.on("connect", () =>
  console.log(`[Redis] Connected at ${env.REDIS_HOST}:${env.REDIS_PORT}`)
);
redisConnection.on("error", (err) =>
  console.error("[Redis] Connection error:", err.message)
);

/**
 * Creates a fresh IORedis connection from the same config.
 * Call this once per BullMQ Worker instance so each worker
 * has an isolated connection that BullMQ can freely manage.
 */
export const createRedisConnection = (): IORedis => new IORedis(redisOptions);
