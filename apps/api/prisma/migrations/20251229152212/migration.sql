-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('ETF', 'FUND', 'STOCK', 'ETC');

-- CreateEnum
CREATE TYPE "AssetSource" AS ENUM ('manual', 'web_search', 'imported');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "isin" TEXT NOT NULL,
    "morningstar_id" TEXT NOT NULL,
    "ticker" TEXT,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "url" TEXT NOT NULL,
    "source" "AssetSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_isin_key" ON "assets"("isin");

-- CreateIndex
CREATE UNIQUE INDEX "assets_morningstar_id_key" ON "assets"("morningstar_id");
