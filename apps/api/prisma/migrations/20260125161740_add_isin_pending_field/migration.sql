-- DropIndex
DROP INDEX "assets_isin_key";

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "isin_pending" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "isin" DROP NOT NULL;
