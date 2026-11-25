import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

const hasAuthCookie = (request: NextRequest) =>
  request.cookies
    .getAll()
    .some(({ name }) => name.startsWith('sb-') && name.endsWith('-auth-token'))

const redirectWithSession = (url: URL, sessionResponse: NextResponse) => {
  const response = NextResponse.redirect(url)
  sessionResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie)
  })

  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = sessionResponse.headers.get(header)
    if (value) response.headers.set(header, value)
  }

  return response
}

export async function proxy(request: NextRequest) {
  const sessionResponse = await updateSession(request)
  const { pathname } = request.nextUrl
  const signedIn = hasAuthCookie(request)

  if (pathname.startsWith('/dashboard') && !signedIn) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return redirectWithSession(url, sessionResponse)
  }

  if (pathname === '/login' && signedIn) {
    return redirectWithSession(new URL('/dashboard', request.url), sessionResponse)
  }

  if (pathname === '/') {
    return redirectWithSession(
      new URL(signedIn ? '/dashboard' : '/login', request.url),
      sessionResponse,
    )
  }

  if (
    pathname.startsWith('/api') &&
    pathname !== '/api/health' &&
    pathname !== '/api/telegram/webhook' &&
    !pathname.startsWith('/api/auth') &&
    !pathname.startsWith('/api/integrations/openrpa') &&
    !pathname.startsWith('/api/integrations/power-automate') &&
    !signedIn
  ) {
    const response = Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
      { status: 401 },
    )
    sessionResponse.headers.getSetCookie().forEach((cookie) => {
      response.headers.append('set-cookie', cookie)
    })
    return response
  }

  return sessionResponse
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*', '/api/:path*'],
}
