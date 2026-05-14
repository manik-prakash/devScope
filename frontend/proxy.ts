import { NextRequest, NextResponse } from 'next/server'

// Routes that require authentication
const MANAGER_ROUTES = ['/dashboard']  // both ADMIN and MANAGER can access
const DEVELOPER_ROUTES = ['/me']
// Routes accessible only when NOT logged in
const AUTH_ROUTES = ['/login', '/signup']

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const refreshToken    = req.cookies.get('ds_refresh')?.value
  const role            = req.cookies.get('ds_role')?.value as 'ADMIN' | 'MANAGER' | 'DEVELOPER' | undefined
  const mustChangePass  = req.cookies.get('ds_must_change')?.value === '1'

  const isLoggedIn = Boolean(refreshToken)

  const isManagerRoute   = MANAGER_ROUTES.some((r) => pathname.startsWith(r))
  const isDeveloperRoute = DEVELOPER_ROUTES.some((r) => pathname.startsWith(r))
  const isAuthRoute      = AUTH_ROUTES.some((r) => pathname.startsWith(r))
  const isChangePassword = pathname === '/change-password'

  // ── Forced password change: trap user on /change-password ──────────────────
  // Once mustChangePass is set the user can only reach /change-password until
  // they submit a new password. Anything else (including auth routes) bounces.
  if (isLoggedIn && mustChangePass && !isChangePassword) {
    return NextResponse.redirect(new URL('/change-password', req.nextUrl))
  }

  // ── /change-password requires login but not the mustChangePass flag ────────
  if (isChangePassword && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  // ── Unauthenticated access to protected routes ─────────────────────────────
  if ((isManagerRoute || isDeveloperRoute) && !isLoggedIn) {
    const loginUrl = new URL('/login', req.nextUrl)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Wrong role: developer trying to access manager dashboard ───────────────
  if (isManagerRoute && isLoggedIn && role === 'DEVELOPER') {
    return NextResponse.redirect(new URL('/me', req.nextUrl))
  }

  // ── Wrong role: admin/manager trying to access developer routes ────────────
  if (isDeveloperRoute && isLoggedIn && (role === 'MANAGER' || role === 'ADMIN')) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  // ── Already logged in, trying to access /login or /signup ──────────────────
  if (isAuthRoute && isLoggedIn) {
    const dest = role === 'DEVELOPER' ? '/me' : '/dashboard'
    return NextResponse.redirect(new URL(dest, req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
