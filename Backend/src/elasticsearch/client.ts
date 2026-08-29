import { Client } from "@elastic/elasticsearch";
import { env } from "../config/env";

/**
 * Singleton Elasticsearch client.
 *
 * The client is lazy-by-design: it does not attempt a connection on import.
 * The first actual operation (index creation check, search, index) triggers
 * the connection. This means the server can start even if Elasticsearch is
 * temporarily unreachable — it will fail gracefully on the first ES call
 * rather than crashing at boot.
 */
export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
  // Retry up to 3 times on transient errors before throwing
  maxRetries: 3,
  // Per-request timeout — keeps a flaky ES from blocking the worker indefinitely
  requestTimeout: 10_000,
});

/**
 * Ping Elasticsearch and log the result.
 * Called once at startup. Does NOT throw — a failed ping is logged as a warning
 * so the rest of the application continues to work without Elasticsearch.
 */
export const pingElasticsearch = async (): Promise<boolean> => {
  try {
    await esClient.ping();
    console.log(`[Elasticsearch] Connected at ${env.ELASTICSEARCH_URL}`);
    return true;
  } catch (err) {
    console.warn(
      `[Elasticsearch] Not reachable at ${env.ELASTICSEARCH_URL} — ` +
        `search will be unavailable until Elasticsearch is running. ` +
        `Error: ${(err as Error).message}`
    );
    return false;
  }
};
