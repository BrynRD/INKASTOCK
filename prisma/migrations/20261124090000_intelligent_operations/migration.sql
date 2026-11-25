-- AlterTable
ALTER TABLE "AutomationLog" ADD COLUMN     "operationId" UUID,
ADD COLUMN     "operationType" TEXT;

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "notificationEmail" TEXT;

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'WEB',
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "activeIngredient" TEXT,
ADD COLUMN     "concentration" TEXT,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "presentation" TEXT;

-- AlterTable
ALTER TABLE "Replenishment" ADD COLUMN     "authorizedById" UUID,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "orderedAt" TIMESTAMP(3),
ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "requestedById" UUID,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" UUID,
ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL',
ALTER COLUMN "requestedBy" DROP NOT NULL;

UPDATE "Replenishment"
SET "code" = 'REP-' || upper(substr(md5("id"::text), 1, 10))
WHERE "code" IS NULL;

ALTER TABLE "Replenishment" ALTER COLUMN "code" SET NOT NULL;

-- CreateTable
CREATE TABLE "Transfer" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "originBranchId" UUID NOT NULL,
    "destinationBranchId" UUID NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedById" UUID,
    "authorizedById" UUID,
    "originConfirmedById" UUID,
    "dispatchedById" UUID,
    "receivedById" UUID,
    "notes" TEXT,
    "evidence" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorizedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferItem" (
    "id" UUID NOT NULL,
    "transferId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "requestedQuantity" INTEGER NOT NULL,
    "approvedQuantity" INTEGER NOT NULL DEFAULT 0,
    "dispatchedQuantity" INTEGER NOT NULL DEFAULT 0,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferLot" (
    "id" UUID NOT NULL,
    "transferItemId" UUID NOT NULL,
    "inventoryLotId" UUID NOT NULL,
    "plannedQuantity" INTEGER NOT NULL,
    "dispatchedQuantity" INTEGER NOT NULL DEFAULT 0,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "receivedLotId" UUID,

    CONSTRAINT "TransferLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplenishmentItem" (
    "id" UUID NOT NULL,
    "replenishmentId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "currentStock" INTEGER NOT NULL,
    "minimumStock" INTEGER NOT NULL,
    "targetStock" INTEGER NOT NULL,
    "requestedQuantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReplenishmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplenishmentLot" (
    "id" UUID NOT NULL,
    "replenishmentItemId" UUID NOT NULL,
    "inventoryLotId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplenishmentLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBranch" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'RESPONSIBLE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInteractionAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TelegramAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLinkCode" (
    "id" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousData" JSONB,
    "newData" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" UUID NOT NULL,
    "operationType" TEXT NOT NULL,
    "operationId" UUID NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "operationType" TEXT NOT NULL,
    "operationId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "size" INTEGER,
    "sha256" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_code_key" ON "Transfer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_idempotencyKey_key" ON "Transfer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transfer_status_idx" ON "Transfer"("status");

-- CreateIndex
CREATE INDEX "Transfer_originBranchId_idx" ON "Transfer"("originBranchId");

-- CreateIndex
CREATE INDEX "Transfer_destinationBranchId_idx" ON "Transfer"("destinationBranchId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferItem_transferId_productId_key" ON "TransferItem"("transferId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferLot_transferItemId_inventoryLotId_key" ON "TransferLot"("transferItemId", "inventoryLotId");

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentItem_replenishmentId_productId_key" ON "ReplenishmentItem"("replenishmentId", "productId");

-- CreateIndex
CREATE INDEX "UserBranch_branchId_idx" ON "UserBranch"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBranch_userId_branchId_key" ON "UserBranch"("userId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAccount_userId_key" ON "TelegramAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAccount_telegramUserId_key" ON "TelegramAccount"("telegramUserId");

-- CreateIndex
CREATE INDEX "TelegramAccount_telegramChatId_idx" ON "TelegramAccount"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLinkCode_codeHash_key" ON "TelegramLinkCode"("codeHash");

-- CreateIndex
CREATE INDEX "TelegramLinkCode_userId_idx" ON "TelegramLinkCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_idempotencyKey_key" ON "AuditLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_idempotencyKey_key" ON "EmailLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailLog_operationType_operationId_idx" ON "EmailLog"("operationType", "operationId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_idempotencyKey_key" ON "Document"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Document_operationType_operationId_idx" ON "Document"("operationType", "operationId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_operationType_operationId_fileName_key" ON "Document"("operationType", "operationId", "fileName");

-- CreateIndex
CREATE INDEX "AutomationLog_operationType_operationId_idx" ON "AutomationLog"("operationType", "operationId");

-- CreateIndex
CREATE INDEX "ChatMessage_channel_idx" ON "ChatMessage"("channel");

-- CreateIndex
CREATE INDEX "InventoryMovement_referenceId_idx" ON "InventoryMovement"("referenceId");

-- CreateIndex
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Replenishment_code_key" ON "Replenishment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Replenishment_idempotencyKey_key" ON "Replenishment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Replenishment_branchId_idx" ON "Replenishment"("branchId");

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_originBranchId_fkey" FOREIGN KEY ("originBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_destinationBranchId_fkey" FOREIGN KEY ("destinationBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_originConfirmedById_fkey" FOREIGN KEY ("originConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferItem" ADD CONSTRAINT "TransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferItem" ADD CONSTRAINT "TransferItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLot" ADD CONSTRAINT "TransferLot_transferItemId_fkey" FOREIGN KEY ("transferItemId") REFERENCES "TransferItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLot" ADD CONSTRAINT "TransferLot_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLot" ADD CONSTRAINT "TransferLot_receivedLotId_fkey" FOREIGN KEY ("receivedLotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replenishment" ADD CONSTRAINT "Replenishment_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replenishment" ADD CONSTRAINT "Replenishment_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replenishment" ADD CONSTRAINT "Replenishment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentItem" ADD CONSTRAINT "ReplenishmentItem_replenishmentId_fkey" FOREIGN KEY ("replenishmentId") REFERENCES "Replenishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentItem" ADD CONSTRAINT "ReplenishmentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentLot" ADD CONSTRAINT "ReplenishmentLot_replenishmentItemId_fkey" FOREIGN KEY ("replenishmentItemId") REFERENCES "ReplenishmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentLot" ADD CONSTRAINT "ReplenishmentLot_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentLot" ADD CONSTRAINT "ReplenishmentLot_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramAccount" ADD CONSTRAINT "TelegramAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLinkCode" ADD CONSTRAINT "TelegramLinkCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_transfer_fk" FOREIGN KEY ("operationId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_replenishment_fk" FOREIGN KEY ("operationId") REFERENCES "Replenishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_transfer_fk" FOREIGN KEY ("operationId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_replenishment_fk" FOREIGN KEY ("operationId") REFERENCES "Replenishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
