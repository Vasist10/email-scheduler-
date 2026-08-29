-- Migration: add User model, add PROCESSING to EmailStatus enum,
-- and add userEmail FK column to Email.

-- Step 1: Add new enum values.
-- PostgreSQL requires these to be committed before they can be used
-- in the same migration, so they run outside any transaction block.
ALTER TYPE "EmailStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

-- Step 2: Create User table
CREATE TABLE "User" (
    "id"        TEXT         NOT NULL,
    "googleId"  TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "email"     TEXT         NOT NULL,
    "avatar"    TEXT         NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX "User_email_key"    ON "User"("email");

-- Step 3: Add userEmail column to Email (needed before the FK constraint)
ALTER TABLE "Email" ADD COLUMN IF NOT EXISTS "userEmail" TEXT NOT NULL DEFAULT '';

-- Step 4: Add foreign key from Email.userEmail → User.email
ALTER TABLE "Email"
    ADD CONSTRAINT "Email_userEmail_fkey"
    FOREIGN KEY ("userEmail") REFERENCES "User"("email")
    ON DELETE RESTRICT ON UPDATE CASCADE;
