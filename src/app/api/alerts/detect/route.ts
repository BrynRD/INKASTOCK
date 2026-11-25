import { withApiAuth } from '@/lib/auth/api'
import { ADMIN_ONLY } from '@/lib/auth/permissions'
import { successResponse } from '@/lib/api-utils'
import { detectAlerts } from '@/services/alert.service'

export const POST = withApiAuth(ADMIN_ONLY, async () => {
  const created = await detectAlerts()
  return successResponse({ created }, 201, 'Operación realizada correctamente')
})
