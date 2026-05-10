import { NextRequest, NextResponse } from 'next/server'

// Routes that require authentication
const MANAGER_ROUTES = ['/dashboard']
const DEVELOPER_ROUTES = ['/me']
// Routes accessible only when NOT logged in
const AUTH_ROUTES = ['/login', '/change-password']

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const refreshToken = req.cookies.get('ds_refresh')?.value
  const role = req.cookies.get('ds_role')?.value as 'MANAGER' | 'DEVELOPER' | undefined

  const isLoggedIn = Boolean(refreshToken)

  const isManagerRoute   = MANAGER_ROUTES.some((r) => pathname.startsWith(r))
  const isDeveloperRoute = DEVELOPER_ROUTES.some((r) => pathname.startsWith(r))
  const isAuthRoute      = AUTH_ROUTES.some((r) => pathname.startsWith(r))

  // ── Unauthenticated access to protected routes ──────────────────────────────
  if ((isManagerRoute || isDeveloperRoute) && !isLoggedIn) {
    const loginUrl = new URL('/login', req.nextUrl)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Wrong role: developer trying to access manager dashboard ───────────────
  if (isManagerRoute && isLoggedIn && role === 'DEVELOPER') {
    return NextResponse.redirect(new URL('/me', req.nextUrl))
  }

  // ── Wrong role: manager trying to access developer routes ──────────────────
  if (isDeveloperRoute && isLoggedIn && role === 'MANAGER') {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  // ── Already logged in, trying to access /login or /change-password ─────────
  if (isAuthRoute && isLoggedIn && pathname === '/login') {
    const dest = role === 'MANAGER' ? '/dashboard' : '/me'
    return NextResponse.redirect(new URL(dest, req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
