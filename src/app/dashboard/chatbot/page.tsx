import { Suspense } from 'react'
import { Bot } from 'lucide-react'
import ChatbotWidget from '@/components/chatbot/chatbot-widget'
import { SessionGuard } from '@/components/auth/session-guard'
import { ALL_ROLES } from '@/lib/auth/permissions'

export default function ChatbotPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando…</div>}>
      <SessionGuard roles={ALL_ROLES}>
        <Suspense
          fallback={
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B] shadow-sm">
              Cargando asistente...
            </div>
          }
        >
          <div className="flex h-[36rem] flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
            <div className="flex items-center justify-between rounded-t-2xl bg-[#168447] px-4 py-3 text-white">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Bot className="h-4 w-4" />
                Asistente InkaStock
              </span>
            </div>
            <div className="flex-1 p-4">
              <ChatbotWidget />
            </div>
          </div>
        </Suspense>
      </SessionGuard>
    </Suspense>
  )
}
