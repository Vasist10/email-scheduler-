-- Add nullable jobId column to Email for storing BullMQ job references
ALTER TABLE "Email" ADD COLUMN "jobId" TEXT;
