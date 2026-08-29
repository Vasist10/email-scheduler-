-- Add failureReason (nullable text) to capture SMTP / network error messages
ALTER TABLE "Email" ADD COLUMN "failureReason" TEXT;

-- Add attempts counter (default 0) to track how many send attempts were made
ALTER TABLE "Email" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
