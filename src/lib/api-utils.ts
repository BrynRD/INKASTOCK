export type ApiResponse<T = unknown> = {
  success: true
  data: T
  message: string
}

export type ApiErrorResponse = {
  success: false
  error: {
    code: string
    message: string
  }
}

export const successResponse = <T>(
  data: T,
  status = 200,
  message = 'Operación realizada correctamente',
): Response => {
  return Response.json({ success: true, data, message } satisfies ApiResponse<T>, {
    status,
  })
}

export const errorResponse = (status: number, code: string, message: string): Response => {
  return Response.json(
    { success: false, error: { code, message } },
    { status },
  )
}

export const isBearerKeyAuthorized = (request: Request, apiKey: string | undefined): boolean => {
  if (!apiKey) {
    return false
  }

  return request.headers.get('authorization') === `Bearer ${apiKey}`
}

export const isOpenRpaAuthorized = (request: Request): boolean => {
  return isBearerKeyAuthorized(request, process.env.OPENRPA_API_KEY)
}

export const isPowerAutomateAuthorized = (request: Request): boolean => {
  return isBearerKeyAuthorized(request, process.env.POWER_AUTOMATE_API_KEY)
}
