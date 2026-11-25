import { Suspense } from 'react'
import { connection } from 'next/server'
import { listBranches } from '@/services/branch.service'
import { SessionGuard } from '@/components/auth/session-guard'
import { ADMIN_ONLY } from '@/lib/auth/permissions'

export default function BranchesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando…</div>}>
      <SessionGuard roles={ADMIN_ONLY}>
        <Suspense
          fallback={
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B] shadow-sm">
              Cargando sucursales...
            </div>
          }
        >
          <BranchesContent />
        </Suspense>
      </SessionGuard>
    </Suspense>
  )
}

async function BranchesContent() {
  await connection()
  const result = await listBranches({ search: undefined, page: 1, pageSize: 50 })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#17211B]">Sucursales</h2>
        <p className="text-sm text-[#64748B]">Red de sucursales farmacéuticas.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Dirección</th>
              <th className="px-4 py-3">Ciudad</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((branch) => (
              <tr key={branch.id} className="border-t border-[#E2E8F0]">
                <td className="px-4 py-3 font-medium text-[#17211B]">{branch.code}</td>
                <td className="px-4 py-3 text-[#17211B]">{branch.name}</td>
                <td className="px-4 py-3 text-[#64748B]">{branch.address}</td>
                <td className="px-4 py-3 text-[#64748B]">{branch.city}</td>
                <td className="px-4 py-3 text-[#64748B]">{branch.active ? 'Activa' : 'Inactiva'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
