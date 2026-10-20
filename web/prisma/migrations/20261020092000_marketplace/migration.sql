-- CreateEnum
CREATE TYPE "HotelApproval" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'HOST';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "commissionPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payoutId" TEXT;

-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN     "approval" "HotelApproval" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "approvalNote" TEXT,
ADD COLUMN     "commissionPercent" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "ownerId" TEXT;

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "gross" INTEGER NOT NULL,
    "commission" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "bookingCount" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payout_ownerId_createdAt_idx" ON "Payout"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
