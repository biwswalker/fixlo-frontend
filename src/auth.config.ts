import type { NextAuthConfig, DefaultSession } from "next-auth"

// Augment NextAuth types to include custom fields
declare module "next-auth" {
  interface User {
    id?: string
    username?: string
    role?: string
    roles?: string[]
    accessToken?: string
    refreshToken?: string
  }
  interface Session {
    user: {
      id: string
      username: string
      role: string
      roles: string[]
    } & DefaultSession["user"]
    accessToken: string
    error?: string
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string
    username: string
    role: string
    roles: string[]
    accessToken: string
    refreshToken: string
    error?: string
  }
}

// This configuration is shared between middleware and server initialization.
// It must be Edge-compatible (no DB, no bcrypt).
export default {
  providers: [], // Providers are added in auth.ts
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user) {
        token.id = user.id as string
        token.username = user.username as string
        token.role = user.role as string
        token.roles = user.roles as string[] || []
        token.accessToken = user.accessToken as string
        token.refreshToken = user.refreshToken as string
      }
      
      // Implement Refresh Token logic here if needed for Set 3
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.username = token.username as string
        session.user.role = token.role as string
        session.user.roles = token.roles as string[]
        session.accessToken = token.accessToken as string
        session.error = token.error as string
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard")
      if (isOnDashboard) {
        if (isLoggedIn) return true
        return false // Redirect unauthenticated users to login page
      }
      return true
    },
  },
} satisfies NextAuthConfig
