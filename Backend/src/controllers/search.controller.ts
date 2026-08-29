import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { searchEmails } from "../elasticsearch/email.index";

/**
 * GET /api/emails/search?q=<query>&from=<offset>&size=<limit>
 *
 * Searches the requesting user's sent emails via Elasticsearch.
 * Matches against: recipient (exact), subject (full-text), body (full-text).
 *
 * Query params:
 *   q     – required, minimum 1 character
 *   from  – pagination offset, default 0
 *   size  – page size, default 20, max 100
 *
 * User isolation: the `userEmail` filter is applied inside searchEmails()
 * using the value from the verified JWT — clients cannot override it.
 */
export const searchEmailsHandler = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const query = (req.query.q as string | undefined)?.trim();

    if (!query || query.length === 0) {
      return res.status(400).json({
        message: 'Query parameter "q" is required',
      });
    }

    const from = Math.max(0, parseInt((req.query.from as string) ?? "0", 10));
    const size = Math.min(
      100,
      Math.max(1, parseInt((req.query.size as string) ?? "20", 10))
    );

    const results = await searchEmails(
      (req.user.email as string)?.toLowerCase().trim(),
      query, from, size
    );

    return res.json({
      query,
      total: results.length,
      from,
      size,
      results: results.map((doc) => ({
        id:        doc.id,
        recipient: doc.recipient,
        subject:   doc.subject,
        status:    doc.status,
        sentAt:    doc.sentAt,
        userEmail: doc.userEmail,
      })),
    });
  } catch (err) {
    const message = (err as Error).message;

    // Detect "index not found" — ES is running but has no data yet
    if (message.includes("index_not_found_exception")) {
      return res.json({ query: req.query.q, total: 0, results: [] });
    }

    // Detect ES connection refused — ES is not running
    if (
      message.includes("ECONNREFUSED") ||
      message.includes("ConnectionError") ||
      message.includes("Not Found")
    ) {
      return res.status(503).json({
        message:
          "Search is temporarily unavailable — Elasticsearch is not reachable",
      });
    }

    console.error("[searchEmails]", err);
    return res.status(500).json({ message: "Search failed" });
  }
};
