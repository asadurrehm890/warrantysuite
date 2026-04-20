-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WarrantySettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "marketingText" TEXT,
    "claimMarketingText" TEXT,
    "brevoApiKey" TEXT,
    "brevoSenderEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_WarrantySettings" ("claimMarketingText", "marketingText", "shop") SELECT "claimMarketingText", "marketingText", "shop" FROM "WarrantySettings";
DROP TABLE "WarrantySettings";
ALTER TABLE "new_WarrantySettings" RENAME TO "WarrantySettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
