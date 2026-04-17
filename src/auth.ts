import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { query } from "@/lib/db"
import bcrypt from "bcryptjs"
import authConfig from "./auth.config"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        try {
          // Query user from DB
          const result = await query(
            "SELECT id, username, password_hash, role FROM users WHERE username = $1",
            [credentials.username]
          )
          
          const user = result.rows[0]

          if (!user) return null

          // Compare password with hash
          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password_hash
          )

          if (!isPasswordValid) return null

          return {
            id: user.id,
            username: user.username,
            role: user.role,
          }
        } catch (error) {
          console.error("Auth authorize error:", error)
          return null
        }
      },
    }),
  ],
})
