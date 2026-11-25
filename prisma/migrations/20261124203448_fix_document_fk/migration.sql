-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_replenishment_fk";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_transfer_fk";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "replenishmentId" UUID,
ADD COLUMN     "transferId" UUID;

-- CreateIndex
CREATE INDEX "Document_transferId_idx" ON "Document"("transferId");

-- CreateIndex
CREATE INDEX "Document_replenishmentId_idx" ON "Document"("replenishmentId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_replenishmentId_fkey" FOREIGN KEY ("replenishmentId") REFERENCES "Replenishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
