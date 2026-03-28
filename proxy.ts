import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function proxy(req) {
    const token = req.nextauth.token
    const isOnboarding = req.nextUrl.pathname === '/onboarding'

    if (token && !token.onboarded && !isOnboarding) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }

    if (token && token.onboarded && isOnboarding) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const publicPaths = ['/login', '/register']
        if (publicPaths.some((path) => req.nextUrl.pathname.startsWith(path))) return true
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
