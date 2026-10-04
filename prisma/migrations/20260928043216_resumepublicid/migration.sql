/*
  Warnings:

  - The `additionalFiles` column on the `doctors` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable: safe add (skip if already exists)
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "resumePublicId" TEXT;

-- Drop and recreate additionalFiles as JSONB (safe)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'doctors' 
        AND column_name = 'additionalFiles'
        AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE "doctors" DROP COLUMN "additionalFiles";
        ALTER TABLE "doctors" ADD COLUMN "additionalFiles" JSONB;
    END IF;
END $$;

ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "additionalFiles" JSONB;
