import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { NextResponse } from "next/server"
import { hasRole } from "./lib/rbac"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { nextUrl } = req;
  
  const isDashboardRoute = nextUrl.pathname.startsWith('/dashboard');
  const isAdminRoute = nextUrl.pathname.startsWith('/dashboard/admin');

  if (isDashboardRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  // Example of Specific Access Control / Role Validation (The Gatekeeper)
  if (isAdminRoute && isLoggedIn) {
    const userRoles = req.auth?.user?.roles || [req.auth?.user?.role];
    if (!hasRole(userRoles as string[], ['admin', 'owner'])) {
      // Return 403 or redirect if not authorized
      return NextResponse.redirect(new URL('/dashboard/all', nextUrl));
    }
  }

  return NextResponse.next();
})

export const config = {
  matcher: ["/dashboard/:path*"],
}
