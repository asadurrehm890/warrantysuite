-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WarrantySettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "marketingText" TEXT,
    "claimMarketingText" TEXT
);
INSERT INTO "new_WarrantySettings" ("marketingText", "shop") SELECT "marketingText", "shop" FROM "WarrantySettings";
DROP TABLE "WarrantySettings";
ALTER TABLE "new_WarrantySettings" RENAME TO "WarrantySettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
