# Base de datos

## Modelos

- `User`, `Branch`, `Product`.
- `InventoryLot`: lotes con cantidad, recepción y vencimiento.
- `InventorySettings`: mínimo y objetivo por producto/sucursal.
- `InventoryMovement`: entradas, salidas, ajustes y reposiciones.
- `Replenishment`, `ReplenishmentItem`, `ReplenishmentLot`: solicitudes, items y lotes recibidos.
- `Transfer`, `TransferItem`, `TransferLot`: propuesta, reserva FEFO y recepción entre sucursales.
- `Alert`: eventos con `fingerprint` único.
- `AutomationLog`: ejecuciones de OpenRPA y vínculo opcional a operación.
- `ChatMessage`: historial de conversación por canal.
- `AuditLog`: auditoría de acciones e idempotencia.
- `EmailLog`, `Document`: correos y PDFs privados por operación.
- `UserBranch`, `TelegramAccount`, `TelegramLinkCode`: alcance por sucursal y vinculación de Telegram.

## Reglas

- `InventoryLot` es único por `(productId, branchId, lotNumber)`.
- `InventorySettings` es único por `(productId, branchId)`.
- `Alert.fingerprint` es único.
- Las cantidades se validan antes de persistir.
- `TransferItem` es único por `(transferId, productId)`; `TransferLot` por `(transferItemId, inventoryLotId)`.
- `ReplenishmentItem` es único por `(replenishmentId, productId)`.
- Los códigos `TRF-*` y `REP-*`, `idempotencyKey`, `AuditLog.idempotencyKey` y `EmailLog.idempotencyKey` son únicos.
- No se almacena stock total como segunda fuente de verdad; el stock cambia al recepcionar.

## Índices

`Product.sku`, `Product.name`, `Product.barcode`, `InventoryLot.productId`, `InventoryLot.branchId`, `InventoryLot.expirationDate`, `InventoryMovement.createdAt`, `InventoryMovement.referenceId`, `Alert.status`, `Alert.priority`, `Replenishment.status`, `Replenishment.branchId`, `Transfer.status`, `Transfer.originBranchId`, `Transfer.destinationBranchId`, `AuditLog.entityType/entityId`, `AutomationLog.executionId`.

## Migraciones y seed

```bash
npx prisma migrate deploy
npx prisma db seed
```

Las migraciones se probaron desde una base vacía y el esquema resultante no tiene diferencias con `prisma/schema.prisma`. El seed usa fechas relativas al día de ejecución e identificadores deterministas, por lo que es repetible. Incluye stock normal, bajo, agotado, próximos a vencer y vencidos, además de reposiciones en distintos estados.
