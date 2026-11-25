import { Suspense } from 'react'
import ChatbotWidget from '@/components/chatbot/chatbot-widget'
import DashboardNav from '@/components/auth/dashboard-nav'
import DashboardUserMenu from '@/components/auth/dashboard-user-menu'
import { requireUser } from '@/lib/auth/dal'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout(props: LayoutProps<'/dashboard'>) {
  const { children } = props
  const user = await requireUser()

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col bg-[#116638] text-white lg:w-64">
        <div className="flex h-14 items-center px-6 lg:h-16">
          <span className="text-xl font-bold">InkaStock</span>
        </div>
        <Suspense fallback={<div className="h-10 px-3 py-3 text-sm text-white/60 lg:h-full">Cargando menú…</div>}>
          <DashboardNav user={user} />
        </Suspense>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-[#E2E8F0] bg-white px-4 sm:px-6 lg:h-16 lg:px-8">
          <h1 className="text-base font-semibold text-[#17211B] sm:text-lg">Panel de control</h1>
          <Suspense fallback={<div className="text-sm text-[#64748B]">Cargando…</div>}>
            <DashboardUserMenu />
          </Suspense>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        <ChatbotWidget />
      </div>
    </div>
  )
}
