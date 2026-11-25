import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prismaClientSingleton = () => {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    }),
  })
}

type PrismaSingleton = ReturnType<typeof prismaClientSingleton>

declare global {
  var prisma: PrismaSingleton | undefined
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export { prisma, PrismaClient }
export default prisma
