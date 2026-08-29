import { esClient } from "./client";

export const EMAIL_INDEX = "emails";

/**
 * Elasticsearch document shape stored in the "emails" index.
 * Mirrors the fields needed for search — does NOT duplicate all DB columns.
 */
export interface EmailDocument {
  id:        string;   // Postgres Email.id — used as the ES document _id
  recipient: string;   // Email.to
  subject:   string;
  body:      string;
  status:    string;   // "SENT" at index time, but stored for filtering
  sentAt:    string;   // ISO-8601 — Email.updatedAt at time of send
  userEmail: string;   // owner — used for per-user search filtering
  createdAt: string;   // ISO-8601
}

/**
 * Index mappings.
 *
 * Field type choices:
 *   recipient / status / userEmail → "keyword"
 *     Exact-match only. Used in filter clauses, not full-text search.
 *     Prevents accidental tokenisation (e.g. "alice@example.com" must not
 *     be split into ["alice", "example", "com"]).
 *
 *   subject / body → "text"
 *     Full-text analysed. Supports partial and multi-word queries.
 *     The "english" analyser applies stemming so "scheduling" matches "schedule".
 *
 *   sentAt / createdAt → "date"
 *     Enables range queries and date-histogram aggregations.
 */
const INDEX_MAPPINGS = {
  properties: {
    id:        { type: "keyword" as const },
    recipient: { type: "keyword" as const },
    subject:   { type: "text"    as const, analyzer: "english" },
    body:      { type: "text"    as const, analyzer: "english" },
    status:    { type: "keyword" as const },
    sentAt:    { type: "date"    as const },
    userEmail: { type: "keyword" as const },
    createdAt: { type: "date"    as const },
  },
};

/**
 * Ensure the "emails" index exists with the correct mappings.
 * Safe to call on every startup — does nothing if the index already exists.
 */
export const ensureEmailIndex = async (): Promise<void> => {
  try {
    const exists = await esClient.indices.exists({ index: EMAIL_INDEX });

    if (exists) {
      console.log(`[Elasticsearch] Index "${EMAIL_INDEX}" already exists`);
      return;
    }

    await esClient.indices.create({
      index: EMAIL_INDEX,
      mappings: INDEX_MAPPINGS,
      settings: {
        number_of_shards:   1,  // single-node setup; scale up for production
        number_of_replicas: 0,  // no replicas on a single node
      },
    });

    console.log(`[Elasticsearch] Index "${EMAIL_INDEX}" created`);
  } catch (err) {
    // Log but don't crash — the app works without the index, just without search
    console.error(
      `[Elasticsearch] Failed to ensure index "${EMAIL_INDEX}":`,
      (err as Error).message
    );
  }
};

/**
 * Index a single sent email document.
 *
 * Failure policy: NEVER throws. Elasticsearch indexing failures must not
 * affect the email's SENT status or trigger a re-send. The email was
 * delivered — the search index is a secondary, best-effort feature.
 */
export const indexEmail = async (doc: EmailDocument): Promise<void> => {
  try {
    await esClient.index({
      index: EMAIL_INDEX,
      id:    doc.id,       // use the Postgres UUID as ES _id → idempotent re-indexing
      document: doc,
    });

    console.log(`[Elasticsearch] Indexed email ${doc.id}`);
  } catch (err) {
    // Intentionally swallowed — see failure policy above
    console.error(
      `[Elasticsearch] Failed to index email ${doc.id} (non-fatal):`,
      (err as Error).message
    );
  }
};

/**
 * Search emails by full-text query across subject and body,
 * or exact match on recipient — scoped strictly to one user.
 *
 * @param userEmail  Owner filter — only their emails are returned.
 * @param query      Free-text search term.
 * @param from       Pagination offset (default 0).
 * @param size       Page size (default 20, max 100).
 */
export const searchEmails = async (
  userEmail: string,
  query: string,
  from = 0,
  size = 20
): Promise<EmailDocument[]> => {
  const safeSize = Math.min(size, 100); // hard cap to prevent accidental huge pages

  const response = await esClient.search<EmailDocument>({
    index: EMAIL_INDEX,
    from,
    size: safeSize,
    query: {
      bool: {
        // Hard filter: only the requesting user's emails
        filter: [
          { term: { userEmail } },
        ],
        // At least one of these must match (relevance-scored)
        should: [
          {
            multi_match: {
              query,
              fields: ["subject^2", "body"], // subject weighted 2× more than body
              type: "best_fields",
              fuzziness: "AUTO",             // handles minor typos
            },
          },
          {
            term: { recipient: query },      // exact match on email address
          },
        ],
        minimum_should_match: 1,
      },
    },
    sort: [
      { _score: { order: "desc" } },        // most relevant first
      { sentAt:  { order: "desc" } },       // tie-break by newest
    ],
  });

  return response.hits.hits
    .map((hit) => hit._source)
    .filter((src): src is EmailDocument => src !== undefined);
};
