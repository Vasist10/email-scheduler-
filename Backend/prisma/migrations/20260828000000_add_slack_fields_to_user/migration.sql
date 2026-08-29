-- Add Slack OAuth fields to the User table.
-- All three columns are nullable so existing Google-only users are unaffected.

ALTER TABLE "User"
  ADD COLUMN "slackAccessToken" TEXT,
  ADD COLUMN "slackTeamName"    TEXT,
  ADD COLUMN "slackUserId"      TEXT;
