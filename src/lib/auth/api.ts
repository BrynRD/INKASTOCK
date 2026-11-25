import type { UserRole } from '@/generated/prisma/enums'
import { errorResponse } from '@/lib/api-utils'
import { getAuthUser, type AuthUser } from '@/lib/auth/dal'

type ApiHandler<TContext> = (
  request: Request,
  context: TContext | undefined,
  user: AuthUser,
) => Promise<Response> | Response

export function withApiAuth<TContext = unknown>(
  roles: UserRole[] | undefined,
  handler: ApiHandler<TContext>,
) {
  return async (request: Request, context?: TContext): Promise<Response> => {
    const user = await getAuthUser()

    if (!user) {
      return errorResponse(401, 'UNAUTHORIZED', 'No autorizado')
    }

    if (roles && !roles.includes(user.role)) {
      return errorResponse(403, 'FORBIDDEN', 'Acceso denegado')
    }

    return handler(request, context, user)
  }
}
