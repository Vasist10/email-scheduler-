import { WebClient } from "@slack/web-api";

/**
 * Send a Slack DM to the user who owns the given token.
 *
 * Design rules:
 *   - If `accessToken` is null/undefined the function is a silent no-op.
 *   - If the Slack API call fails for any reason (revoked token, network error,
 *     rate limit from Slack's side) the error is logged but never re-thrown.
 *     The caller must never crash because of a missing/broken Slack connection.
 *
 * @param accessToken  The bot token stored in User.slackAccessToken (may be null)
 * @param slackUserId  The Slack member ID stored in User.slackUserId   (may be null)
 * @param message      Plain-text message to send
 */
export async function sendSlackNotification(
  accessToken: string | null | undefined,
  slackUserId: string | null | undefined,
  message: string
): Promise<void> {
  // Guard: no token or no user ID — nothing to do
  if (!accessToken || !slackUserId) return;

  try {
    const slack = new WebClient(accessToken);

    // Open a DM channel with the user then post the message
    const dmResult = await slack.conversations.open({ users: slackUserId });

    const channelId = dmResult.channel?.id;
    if (!channelId) {
      console.warn("[Slack] conversations.open returned no channel id — skipping");
      return;
    }

    await slack.chat.postMessage({
      channel: channelId,
      text: message,
    });

    console.log(`[Slack] Notification sent to user ${slackUserId}`);
  } catch (err) {
    // Non-fatal — log and swallow so the worker / caller is never disrupted
    console.warn("[Slack] Failed to send notification:", (err as Error).message);
  }
}
