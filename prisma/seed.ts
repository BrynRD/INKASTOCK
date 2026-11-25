import { config } from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import {
  AlertPriority,
  AlertStatus,
  AlertType,
  MovementType,
  ReplenishmentStatus,
  UserRole,
} from '../src/generated/prisma/enums'

config()

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const startOfToday = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const addDays = (days: number) => {
  const date = startOfToday()
  date.setDate(date.getDate() + days)
  return date
}

const id = (group: string, number: number) =>
  `00000000-0000-4000-8000-${group}${String(number).padStart(11, '0')}`

const users = [
  {
    id: id('0', 1),
    name: 'Administrador Demo',
    email: 'admin@inka.dev',
    role: UserRole.ADMIN,
    active: true,
  },
  {
    id: id('0', 2),
    name: 'Supervisor Demo',
    email: 'sup@inka.dev',
    role: UserRole.SUPERVISOR,
    active: true,
  },
  {
    id: id('0', 3),
    name: 'Gestor de Inventario Demo',
    email: 'inv@inka.dev',
    role: UserRole.INVENTORY_MANAGER,
    active: true,
  },
]

const branches = [
  { id: id('1', 1), code: 'SUC-001', name: 'Sucursal Centro', address: 'Av. Demo 101', city: 'Lima', active: true },
  { id: id('1', 2), code: 'SUC-002', name: 'Sucursal Norte', address: 'Av. Demo 202', city: 'Lima', active: true },
  { id: id('1', 3), code: 'SUC-003', name: 'Sucursal Sur', address: 'Av. Demo 303', city: 'Lima', active: true },
]

const productNames = [
  'Paracetamol 500 mg',
  'Ibuprofeno 400 mg',
  'Amoxicilina 500 mg',
  'Cetirizina 10 mg',
  'Vitamina C 1 g',
  'Metformina 850 mg',
  'Losartán 50 mg',
  'Atorvastatina 20 mg',
  'Omeprazol 20 mg',
  'Salbutamol 100 mcg',
  'Azitromicina 500 mg',
  'Diclofenaco 75 mg',
  'Loratadina 10 mg',
  'Enalapril 10 mg',
  'Insulina glargina',
  'Amoxicilina 250 mg',
  'Ciprofloxacino 500 mg',
  'Anticonceptivo oral',
  'Suero fisiológico 500 ml',
  'Alcohol isopropílico 70%',
]

const categories = ['Analgésico', 'Antibiótico', 'Antihistamínico', 'Vitaminas', 'Cuidado']

const products = productNames.map((name, index) => ({
  id: id('2', index + 1),
  sku: `MED-${String(index + 1).padStart(4, '0')}`,
  barcode: `7700${String(index + 1).padStart(9, '0')}`,
  name,
  description: `Producto ficticio de demostración ${index + 1}`,
  category: categories[index % categories.length],
  unit: 'unidad',
  active: true,
}))

const lots = Array.from({ length: 30 }, (_, index) => {
  const scenario = index % 6
  const quantity = scenario === 0 ? 0 : scenario === 1 ? 15 : 120
  const expirationDays = scenario === 2 ? -10 : scenario === 3 ? 5 : scenario === 4 ? 30 : 180

  return {
    id: id('3', index + 1),
    productId: products[index % products.length].id,
    branchId: branches[index % branches.length].id,
    lotNumber: `LOT-${String(index + 1).padStart(4, '0')}`,
    quantity,
    expirationDate: addDays(expirationDays),
  }
})

const settings = products.map((product, index) => ({
  id: id('4', index + 1),
  productId: product.id,
  branchId: branches[index % branches.length].id,
  minimumStock: 50,
  targetStock: 200,
}))

const movements = Array.from({ length: 15 }, (_, index) => {
  const lot = lots[index]
  const types = [MovementType.ENTRY, MovementType.EXIT, MovementType.ADJUSTMENT]

  return {
    id: id('5', index + 1),
    productId: lot.productId,
    branchId: lot.branchId,
    lotId: lot.id,
    type: types[index % types.length],
    quantity: index % 3 === 0 ? 120 : 10,
    reason: 'Movimiento ficticio de demostración',
    createdAt: addDays(-index),
  }
})

const replenishmentStatuses = [
  ReplenishmentStatus.PENDING,
  ReplenishmentStatus.APPROVED,
  ReplenishmentStatus.RECEIVED,
  ReplenishmentStatus.REJECTED,
  ReplenishmentStatus.PENDING,
]

const replenishments = replenishmentStatuses.map((status, index) => ({
  id: id('6', index + 1),
  code: `REP-${String(index + 1).padStart(5, '0')}`,
  productId: products[index].id,
  branchId: branches[index % branches.length].id,
  requestedQuantity: 60 + index * 10,
  receivedQuantity: status === ReplenishmentStatus.RECEIVED ? 60 + index * 10 : 0,
  status,
  reason: 'Reposición ficticia de demostración',
  requestedBy: 'admin@inka.dev',
  approvedBy: status === ReplenishmentStatus.APPROVED || status === ReplenishmentStatus.RECEIVED ? 'supervisor.demo' : null,
  requestedAt: addDays(-index - 1),
}))

const alerts = [
  {
    id: id('7', 1),
    fingerprint: `STOCK:${products[0].id}:${branches[0].id}:OUT_OF_STOCK`,
    productId: products[0].id,
    branchId: branches[0].id,
    lotId: null,
    type: AlertType.OUT_OF_STOCK,
    priority: AlertPriority.CRITICAL,
    message: `Producto ${products[0].name} sin stock disponible en ${branches[0].name}`,
  },
  {
    id: id('7', 2),
    fingerprint: `STOCK:${products[1].id}:${branches[1].id}:LOW`,
    productId: products[1].id,
    branchId: branches[1].id,
    lotId: null,
    type: AlertType.STOCK_LOW,
    priority: AlertPriority.HIGH,
    message: `Producto ${products[1].name} con stock por debajo del mínimo en ${branches[1].name}`,
  },
  {
    id: id('7', 3),
    fingerprint: `STOCK:${products[2].id}:${branches[2].id}:LOW`,
    productId: products[2].id,
    branchId: branches[2].id,
    lotId: null,
    type: AlertType.STOCK_LOW,
    priority: AlertPriority.MEDIUM,
    message: `Producto ${products[2].name} con stock por debajo del mínimo en ${branches[2].name}`,
  },
  {
    id: id('7', 4),
    fingerprint: `STOCK:${products[3].id}:${branches[0].id}:LOW`,
    productId: products[3].id,
    branchId: branches[0].id,
    lotId: null,
    type: AlertType.STOCK_LOW,
    priority: AlertPriority.MEDIUM,
    message: `Producto ${products[3].name} con stock por debajo del mínimo en ${branches[0].name}`,
  },
  ...[2, 3, 4, 5].map((lotIndex, index) => {
    const lot = lots[lotIndex]
    return {
      id: id('7', index + 5),
      fingerprint: `EXP:${lot.id}`,
      productId: lot.productId,
      branchId: lot.branchId,
      lotId: lot.id,
      type: lot.expirationDate < startOfToday() ? AlertType.EXPIRED : AlertType.EXPIRING,
      priority: AlertPriority.CRITICAL,
      message: `Lote ${lot.lotNumber} requiere revisión por vencimiento`,
    }
  }),
]

async function main() {
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: user,
      update: { name: user.name, email: user.email, role: user.role, active: user.active },
    })
  }

  for (const email of ['admin@inka.test', 'sup@inka.test', 'inv@inka.test']) {
    await prisma.user.updateMany({ where: { email }, data: { active: false } })
  }

  for (const branch of branches) {
    await prisma.branch.upsert({
      where: { code: branch.code },
      create: branch,
      update: { name: branch.name, address: branch.address, city: branch.city, active: branch.active },
    })
  }

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      create: product,
      update: { name: product.name, category: product.category, unit: product.unit, active: product.active },
    })
  }

  for (const lot of lots) {
    await prisma.inventoryLot.upsert({
      where: {
        productId_branchId_lotNumber: {
          productId: lot.productId,
          branchId: lot.branchId,
          lotNumber: lot.lotNumber,
        },
      },
      create: lot,
      update: { quantity: lot.quantity, expirationDate: lot.expirationDate },
    })
  }

  for (const setting of settings) {
    await prisma.inventorySettings.upsert({
      where: {
        productId_branchId: {
          productId: setting.productId,
          branchId: setting.branchId,
        },
      },
      create: setting,
      update: { minimumStock: setting.minimumStock, targetStock: setting.targetStock },
    })
  }

  for (const movement of movements) {
    await prisma.inventoryMovement.upsert({
      where: { id: movement.id },
      create: movement,
      update: { quantity: movement.quantity, type: movement.type },
    })
  }

  for (const replenishment of replenishments) {
    await prisma.replenishment.upsert({
      where: { id: replenishment.id },
      create: {
        ...replenishment,
        items: {
          create: {
            productId: replenishment.productId,
            currentStock: 0,
            minimumStock: 10,
            targetStock: replenishment.requestedQuantity,
            requestedQuantity: replenishment.requestedQuantity,
            receivedQuantity: replenishment.receivedQuantity,
          },
        },
      },
      update: {
        code: replenishment.code,
        status: replenishment.status,
        receivedQuantity: replenishment.receivedQuantity,
        items: {
          upsert: {
            where: {
              replenishmentId_productId: {
                replenishmentId: replenishment.id,
                productId: replenishment.productId,
              },
            },
            create: {
              productId: replenishment.productId,
              currentStock: 0,
              minimumStock: 10,
              targetStock: replenishment.requestedQuantity,
              requestedQuantity: replenishment.requestedQuantity,
              receivedQuantity: replenishment.receivedQuantity,
            },
            update: {
              requestedQuantity: replenishment.requestedQuantity,
              receivedQuantity: replenishment.receivedQuantity,
            },
          },
        },
      },
    })
  }

  for (const alert of alerts) {
    await prisma.alert.upsert({
      where: { fingerprint: alert.fingerprint },
      create: { ...alert, status: AlertStatus.PENDING },
      update: { status: AlertStatus.PENDING, message: alert.message, priority: alert.priority, type: alert.type },
    })
  }

  console.log('Seed completado: 3 sucursales, 20 productos, 30 lotes, 20 configuraciones, 15 movimientos, 5 reposiciones y 8 alertas.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
