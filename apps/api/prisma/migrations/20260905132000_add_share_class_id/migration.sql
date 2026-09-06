-- AlterTable
ALTER TABLE "assets" ADD COLUMN "share_class_id" TEXT;

-- Backfill Instant X-Ray IDs already stored as morningstar_id (F…)
UPDATE "assets"
SET "share_class_id" = "morningstar_id"
WHERE "type" IN ('FUND', 'ETF', 'ETC')
  AND "morningstar_id" ~ '^F0[A-Z0-9]{8,12}$'
  AND "share_class_id" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "assets_share_class_id_key" ON "assets"("share_class_id");
