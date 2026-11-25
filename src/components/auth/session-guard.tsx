import type { ReactNode } from 'react'
import type { UserRole } from '@/generated/prisma/enums'
import { requireUser } from '@/lib/auth/dal'

export async function SessionGuard({
  children,
  roles,
}: {
  children: ReactNode
  roles?: UserRole[]
}) {
  await requireUser(roles)
  return <>{children}</>
}
