import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Gate every page on the server so unauthenticated visitors are redirected to
// /login before any dashboard HTML is sent (no UI flash before the login).
// API routes keep their own cookie checks and answer with 401.
export function proxy(request: NextRequest) {
  const authed = Boolean(request.cookies.get('trading_auth')?.value)
  const { pathname } = request.nextUrl

  if (pathname === '/login') {
    // Already logged in → skip the PIN screen.
    if (authed) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.next()
  }

  if (!authed) return NextResponse.redirect(new URL('/login', request.url))
  return NextResponse.next()
}

export const config = {
  // Pages only: skip API routes, Next internals and public static files.
  matcher: [
    '/((?!api/|_next/|sw\\.js|offline\\.html|manifest\\.webmanifest|favicon|apple-touch-icon|icon-).*)'
  ]
}
