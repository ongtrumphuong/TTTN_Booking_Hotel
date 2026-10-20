-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "refundNote" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;
