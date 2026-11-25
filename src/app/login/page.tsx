import { Suspense } from 'react'
import LoginForm from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-[#F8FAFC] px-6">
      <div className="w-full max-w-[1440px] font-nunito grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-0 lg:min-h-[80vh] rounded-[18px] border-2 border-[var(--line)] bg-[var(--sf)] shadow-none overflow-hidden">
        {/* Columna izquierda: fondo amarillo con marca y estantes decorativos */}
        <div className="lg:flex bg-[var(--yellow)] p-6 lg:p-10 flex flex-col justify-between hidden lg:block">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[var(--gd)] font-bold text-lg">
              I
            </div>
            <div>
              <p className="font-bold text-[var(--gd)] text-sm uppercase tracking-wider">InkaStock</p>
              <p className="text-[var(--gd)] text-xs font-semibold uppercase tracking-wider">Control farmacéutico</p>
            </div>
          </div>
          <div className="mt-auto flex flex-col gap-4">
            <h2 className="text-[28px] font-[900] text-[var(--gd)] leading-tight tracking-[-0.5px]">
              Cada botica, con su stock al día.
            </h2>
            <p className="text-[var(--ink)] text-sm font-medium max-w-xs">
              Gestiona transferencias, reposiciones y recepciones de inventario desde un solo lugar.
            </p>
            <div className="flex gap-2 h-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex-1 rounded-full border-2 border-[var(--yd)]"
                  style={{
                    backgroundColor:
                      i % 3 === 0 ? '#FFFFFF' : i % 2 === 0 ? '#1FA463' : '#D7263D',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Columna derecha: formulario de acceso */}
        <div className="flex flex-col justify-center p-6 lg:p-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--green)] text-white font-bold text-lg">
              I
            </div>
            <div>
              <p className="font-bold text-[var(--gd)] text-xs uppercase tracking-wider">InkaStock</p>
              <p className="text-[var(--mute)] text-xs font-semibold uppercase tracking-wider">Control farmacéutico</p>
            </div>
          </div>

          <h1 className="text-[30px] font-[900] text-[var(--ink)] leading-tight tracking-[-0.5px] mb-2">
            Ingresa a tu cuenta
          </h1>
          <p className="text-[var(--mute)] text-sm mb-8">
            Usa tu usuario de Supabase para acceder al panel.
          </p>

          <Suspense fallback={<p className="text-sm text-[var(--mute)]">Cargando…</p>}>
            <LoginForm />
          </Suspense>

          <div className="mt-8 rounded-lg border-2 border-[var(--yd)] bg-[var(--warn)] px-4 py-3">
            <p className="text-xs font-semibold text-[var(--ink)] mb-2 uppercase tracking-wider">
              Usuarios demo
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded-full border border-[var(--gd)] text-[var(--gd)] text-[10px] font-bold">
                Admin
              </span>
              <span className="px-2 py-1 rounded-full border border-[var(--gd)] text-[var(--gd)] text-[10px] font-bold">
                Supervisor
              </span>
              <span className="px-2 py-1 rounded-full border border-[var(--gd)] text-[var(--gd)] text-[10px] font-bold">
                Inventario
              </span>
            </div>
            <p className="mt-2 text-[var(--mute)] text-[10px]">
              Contraseña demo: 123456
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
