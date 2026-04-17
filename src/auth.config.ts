import type { NextAuthConfig, DefaultSession } from "next-auth"

// Augment NextAuth types to include custom fields
declare module "next-auth" {
  interface User {
    id?: string
    username?: string
    role?: string
  }
  interface Session {
    user: {
      id: string
      username: string
      role: string
    } & DefaultSession["user"]
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string
    role: string
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role as string
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
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
