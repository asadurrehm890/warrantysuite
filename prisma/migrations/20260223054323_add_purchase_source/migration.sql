-- CreateTable
CREATE TABLE "PurchaseSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PurchaseSource_shop_idx" ON "PurchaseSource"("shop");
