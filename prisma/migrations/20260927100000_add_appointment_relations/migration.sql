-- CreateEnum: ScheduleStatus only (DoctorVerificationStatus handled in 20260927180458_doctor)
DO $$ BEGIN
    CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Delete existing incomplete appointment rows
DELETE FROM "appointments";

-- AlterTable appointments: add required columns with temp defaults
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "doctorId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "joiningTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "patientId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "scheduleId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "serialNumber" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "recordUrl" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "recordPublicId" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "prescriptionUrl" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "prescriptionPublicId" TEXT;

-- Remove temp defaults
ALTER TABLE "appointments" ALTER COLUMN "doctorId" DROP DEFAULT;
ALTER TABLE "appointments" ALTER COLUMN "joiningTime" DROP DEFAULT;
ALTER TABLE "appointments" ALTER COLUMN "patientId" DROP DEFAULT;
ALTER TABLE "appointments" ALTER COLUMN "scheduleId" DROP DEFAULT;
ALTER TABLE "appointments" ALTER COLUMN "serialNumber" DROP DEFAULT;

-- CreateTable: schedules (depends on doctors table which is in 20260927180458_doctor)
-- schedules table will be created after doctors table exists

-- CreateIndex for appointments
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_patientId_doctorId_scheduleId_key" ON "appointments"("patientId", "doctorId", "scheduleId");
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_scheduleId_serialNumber_joiningTime_key" ON "appointments"("scheduleId", "serialNumber", "joiningTime");
