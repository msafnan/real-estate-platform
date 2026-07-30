-- AlterTable: date-only stamp for the daily-duplicate constraint (Session 7)
ALTER TABLE "inquiries" ADD COLUMN "created_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex: at most one inquiry per property, per email, per calendar day
CREATE UNIQUE INDEX "uniq_inquiry_per_day" ON "inquiries"("property_id", "inquirer_email", "created_date");
