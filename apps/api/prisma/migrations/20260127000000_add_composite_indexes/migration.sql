-- CreateIndex
CREATE INDEX "assets_isin_isin_pending_idx" ON "assets"("isin", "isin_pending");

-- CreateIndex
CREATE INDEX "assets_morningstar_id_type_idx" ON "assets"("morningstar_id", "type");
