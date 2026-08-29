-- Add nullable campaignId column to Email for grouping bulk-scheduled batches
ALTER TABLE "Email" ADD COLUMN "campaignId" TEXT;

-- Index for fast campaign lookups
CREATE INDEX "Email_campaignId_idx" ON "Email"("campaignId");
