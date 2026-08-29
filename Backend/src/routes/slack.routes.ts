/**
 * Slack OAuth routes
 * ==================
 * Mounted at /auth/slack in server.ts.
 *
 * Flow:
 *   1. GET /auth/slack/connect
 *        → Redirects browser to Slack's OAuth consent screen.
 *          The user approves the requested scopes for their workspace.
 *
 *   2. GET /auth/slack/callback  (Slack redirects here after approval)
 *        → Exchanges the `code` query param for a bot access token.
 *        → Looks up the logged-in user from the JWT Bearer token in the
 *          Authorization header (same auth middleware used by every other
 *          protected route).
 *        → Stores slackAccessToken, slackTeamName, slackUserId on the User row.
 *        → Redirects back to the frontend dashboard.
 *
 *   3. POST /auth/slack/disconnect
 *        → Clears all three Slack fields on the User row.
 *        → Returns 200 JSON.
 *
 *   4. GET /auth/slack/status
 *        → Returns { connected: boolean, teamName: string | null } so the
 *          frontend can render the correct button state on page load.
 *
 * Security:
 *   - /connect, /disconnect, and /status all require a valid JWT
 *     (enforced by `authenticate` middleware).
 *   - /callback is *not* protected by JWT because the browser arrives here
 *     directly from Slack's redirect, without an Authorization header.
 *     Instead it validates the `state` parameter (a signed JWT that embeds
 *     the logged-in user's email) to tie the OAuth response back to the
 *     correct user, preventing CSRF and open-redirect attacks.
 */

import { Router, Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import prisma from "../config/prisma";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// ── Scopes required by the notifier ─────────────────────────────────────────
// chat:write       — post messages
// im:write         — open DM channels (conversations.open)
// users:read       — look up the Slack user id from their email (optional,
//                    kept for future use)
const SLACK_SCOPES = ["chat:write", "im:write", "users:read"].join(",");

// ─────────────────────────────────────────────────────────────────────────────
// 1. Initiate OAuth
// ─────────────────────────────────────────────────────────────────────────────
router.get("/connect", (req: Request, res: Response) => {
  // Accept the JWT from the Authorization header (API clients)
  // or from a ?token= query param (browser redirect after OAuth).
  const tokenFromQuery  = req.query.token as string | undefined;
  const tokenFromHeader = (req.headers.authorization ?? "").replace("Bearer ", "");
  const rawToken        = tokenFromQuery || tokenFromHeader;

  if (!rawToken) {
    return res.status(401).json({ message: "No token provided" });
  }

  let userEmail: string;
  try {
    const payload = jwt.verify(rawToken, env.JWT_SECRET) as { email: string };
    userEmail = payload.email;
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // Embed the user's email in a short-lived JWT used as the OAuth `state`
  // parameter. The callback route verifies this to prevent CSRF.
  const state = jwt.sign({ email: userEmail }, env.JWT_SECRET, {
    expiresIn: "10m",
  });

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", env.SLACK_CLIENT_ID);
  url.searchParams.set("scope", SLACK_SCOPES);
  url.searchParams.set("redirect_uri", env.SLACK_CALLBACK_URL);
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. OAuth callback (Slack redirects here)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  // Slack may send an error if the user denied the app
  if (error || !code || !state) {
    console.warn("[Slack] OAuth denied or missing params:", error);
    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=denied`);
  }

  // Verify the state JWT to get the user's email
  let userEmail: string;
  try {
    const payload = jwt.verify(state, env.JWT_SECRET) as { email: string };
    userEmail = payload.email;
  } catch {
    console.warn("[Slack] Invalid or expired state token");
    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);
  }

  // Exchange the code for a token using Slack's oauth.v2.access endpoint
  try {
    const tokenRes = await axios.post(
      "https://slack.com/api/oauth.v2.access",
      new URLSearchParams({
        code,
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        redirect_uri: env.SLACK_CALLBACK_URL,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const data = tokenRes.data;

    if (!data.ok) {
      console.error("[Slack] oauth.v2.access failed:", data.error);
      return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);
    }

    // data.authed_user.id  → the Slack member ID of the *installing user*
    // data.access_token    → bot token (used for chat.postMessage)
    // data.team.name       → workspace display name
    const accessToken: string = data.access_token;
    const teamName: string    = data.team?.name ?? "";
    const slackUserId: string = data.authed_user?.id ?? "";

    // Persist to database
    await prisma.user.update({
      where: { email: userEmail },
      data: { slackAccessToken: accessToken, slackTeamName: teamName, slackUserId },
    });

    console.log(
      `[Slack] Connected workspace "${teamName}" for user ${userEmail}`
    );

    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (err) {
    console.error("[Slack] Token exchange error:", (err as Error).message);
    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Disconnect
// ─────────────────────────────────────────────────────────────────────────────
router.post("/disconnect", authMiddleware, async (req: Request, res: Response) => {
  const user = req.user as { email: string };

  await prisma.user.update({
    where: { email: user.email },
    data: {
      slackAccessToken: null,
      slackTeamName:    null,
      slackUserId:      null,
    },
  });

  console.log(`[Slack] Disconnected for user ${user.email}`);
  res.json({ ok: true, message: "Slack disconnected" });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Status — lets the frontend know whether Slack is connected
// ─────────────────────────────────────────────────────────────────────────────
router.get("/status", authMiddleware, async (req: Request, res: Response) => {
  const user = req.user as { email: string };

  const record = await prisma.user.findUnique({
    where: { email: user.email },
    select: { slackAccessToken: true, slackTeamName: true },
  });

  res.json({
    connected: !!record?.slackAccessToken,
    teamName:  record?.slackTeamName ?? null,
  });
});

export default router;
