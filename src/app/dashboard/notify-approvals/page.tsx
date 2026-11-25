import { Suspense } from 'react'
import { connection } from 'next/server'
import { SessionGuard } from '@/components/auth/session-guard'
import { ALL_ROLES } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/dal'
import NotificationsCenter from '@/components/notifications/notifications-center'

export default function NotifyApprovalsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando centro de aprobaciones…</div>}>
      <SessionGuard roles={ALL_ROLES}>
        <NotificationsCenterContent />
      </SessionGuard>
    </Suspense>
  )
}

async function NotificationsCenterContent() {
  await connection()
  await requireUser()
  return <NotificationsCenter />
}
