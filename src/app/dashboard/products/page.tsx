import { Suspense } from 'react'
import { connection } from 'next/server'
import ProductForm from '@/components/products/product-form'
import ProductActions from '@/components/products/product-actions'
import { listProducts } from '@/services/product.service'
import { SessionGuard } from '@/components/auth/session-guard'
import { requireUser } from '@/lib/auth/dal'
import { ALL_ROLES } from '@/lib/auth/permissions'

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando…</div>}>
      <SessionGuard roles={ALL_ROLES}>
        <Suspense
          fallback={
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B] shadow-sm">
              Cargando productos...
            </div>
          }
        >
          <ProductsContent />
        </Suspense>
      </SessionGuard>
    </Suspense>
  )
}

async function ProductsContent() {
  await connection()
  const user = await requireUser()
  const result = await listProducts({ search: undefined, category: undefined, page: 1, pageSize: 50 })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#17211B]">Productos</h2>
        <p className="text-sm text-[#64748B]">Catálogo farmacéutico activo.</p>
      </div>

      {user.role === 'ADMIN' ? <ProductForm /> : null}

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-[#64748B]">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Unidad</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((product) => (
              <tr key={product.id} className="border-t border-[#E2E8F0]">
                <td className="px-4 py-3 font-medium text-[#17211B]">{product.sku}</td>
                <td className="px-4 py-3 text-[#17211B]">{product.name}</td>
                <td className="px-4 py-3 text-[#64748B]">{product.category}</td>
                <td className="px-4 py-3 text-[#64748B]">{product.unit}</td>
                <td className="px-4 py-3">
                  {user.role === 'ADMIN' ? <ProductActions id={product.id} /> : <span className="text-xs text-[#94A3B8]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
