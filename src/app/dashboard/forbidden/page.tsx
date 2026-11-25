import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-[#64748B]">403</p>
      <h1 className="mt-3 text-2xl font-semibold text-[#17211B]">Acceso denegado</h1>
      <p className="mt-2 max-w-md text-sm text-[#64748B]">
        Tu rol no tiene permisos para ver esta sección.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-lg bg-[#116638] px-4 py-2 text-sm font-semibold text-white"
      >
        Volver al panel
      </Link>
    </div>
  )
}
