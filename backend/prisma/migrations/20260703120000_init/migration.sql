CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "Instrument" AS ENUM ('mic', 'guitar', 'bass', 'drums', 'synth', 'teacher');
CREATE TYPE "MusicianStatus" AS ENUM ('active', 'archived');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'overdue', 'failed');
CREATE TYPE "DeferralStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "musicians" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "telegram_id" BIGINT NOT NULL,
  "username" TEXT,
  "full_name" TEXT,
  "is_admin" BOOLEAN NOT NULL DEFAULT false,
  "monthly_price" INTEGER NOT NULL DEFAULT 5000,
  "payment_day" INTEGER NOT NULL DEFAULT 25,
  "grace_period_days" INTEGER,
  "grace_period_hours" INTEGER,
  "instruments" "Instrument"[] NOT NULL DEFAULT ARRAY[]::"Instrument"[],
  "status" "MusicianStatus" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "musicians_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "musician_id" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "period" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  "yookassa_payment_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paid_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deferral_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "musician_id" UUID NOT NULL,
  "period" TEXT NOT NULL,
  "status" "DeferralStatus" NOT NULL DEFAULT 'pending',
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "admin_comment" TEXT,
  CONSTRAINT "deferral_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "settings" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "default_payment_day" INTEGER NOT NULL DEFAULT 25,
  "default_grace_period_days" INTEGER NOT NULL DEFAULT 3,
  "default_grace_period_hours" INTEGER NOT NULL DEFAULT 0,
  "reminder_days_before" INTEGER NOT NULL DEFAULT 3,
  "reminder_time" TEXT NOT NULL DEFAULT '10:00',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "musicians_telegram_id_key" ON "musicians"("telegram_id");
CREATE UNIQUE INDEX "payments_yookassa_payment_id_key" ON "payments"("yookassa_payment_id");
CREATE UNIQUE INDEX "payments_musician_id_period_key" ON "payments"("musician_id", "period");
CREATE INDEX "payments_period_status_idx" ON "payments"("period", "status");
CREATE UNIQUE INDEX "deferral_requests_musician_id_period_key" ON "deferral_requests"("musician_id", "period");
CREATE INDEX "deferral_requests_status_period_idx" ON "deferral_requests"("status", "period");

ALTER TABLE "payments" ADD CONSTRAINT "payments_musician_id_fkey" FOREIGN KEY ("musician_id") REFERENCES "musicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deferral_requests" ADD CONSTRAINT "deferral_requests_musician_id_fkey" FOREIGN KEY ("musician_id") REFERENCES "musicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "settings" ("id") VALUES ('global') ON CONFLICT ("id") DO NOTHING;
