-- AlterTable
ALTER TABLE "PushToken" ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'fcm';

-- CreateIndex
CREATE INDEX "PushToken_platform_idx" ON "PushToken"("platform");
