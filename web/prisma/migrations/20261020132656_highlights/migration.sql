-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN     "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[];
