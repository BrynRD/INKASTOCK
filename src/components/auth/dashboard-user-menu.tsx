import { LogOut } from 'lucide-react'
import type { UserRole } from '@/generated/prisma/enums'
import { requireUser } from '@/lib/auth/dal'

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  INVENTORY_MANAGER: 'Gestor de inventario',
}

export default async function DashboardUserMenu() {
  const user = await requireUser()

  return (
    <div className="flex items-center gap-4">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium text-[#17211B]">{user.name}</p>
        <p className="text-xs text-[#64748B]">
          {ROLE_LABELS[user.role]} · {user.email}
        </p>
      </div>
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-medium text-[#475569] transition-colors hover:bg-[#F1F5F9]"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </form>
    </div>
  )
}
