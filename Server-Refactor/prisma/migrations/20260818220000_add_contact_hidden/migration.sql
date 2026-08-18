-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Contact_userId_hidden_idx" ON "Contact"("userId", "hidden");
