import type { UserRole } from '@/generated/prisma/enums'
import type { Actor, DbClient } from '@/lib/actor'

export function assertRole(actor: Actor, roles: UserRole[]) {
  if (!roles.includes(actor.role)) {
    throw new Error('FORBIDDEN')
  }
}

export async function assertBranchAccess(client: DbClient, actor: Actor, branchId: string) {
  if (actor.role === 'ADMIN') return

  const links = await client.userBranch.findMany({
    where: { userId: actor.id, active: true },
    select: { branchId: true },
  })

  if (links.length > 0 && !links.some((link) => link.branchId === branchId)) {
    throw new Error('BRANCH_FORBIDDEN')
  }
}
