import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";
import { logger } from "@/lib/logger";

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
        if (!credentials?.username || !credentials?.password) return null;

        try {
          // Call Central Auth API instead of local DB
          const authApiUrl =
            process.env.AUTH_API_URL || "http://localhost:3100";

          const response = await fetch(`${authApiUrl}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
              app_source: "fixlo", // Identify which app is logging in
            }),
          });

          const result = await response.json();

          if (!response.ok || !!!result.accessToken) {
            logger.error("Auth:authorize", "Auth API rejected login", result);
            // Throwing an error here makes NextAuth pass the error to the frontend
            throw new Error(
              result.message || "รหัสผ่านไม่ถูกต้อง หรือถูกระงับการใช้งาน",
            );
          }

          const { user, access_token, refresh_token } = result.data;

          return {
            id: user.id,
            username: user.username,
            role: user.roles?.[0] || "VIEWER", // Fallback role if array
            roles: user.roles || [],
            accessToken: access_token,
            refreshToken: refresh_token,
          };
        } catch (error: any) {
          logger.error("Auth:authorize", "Failed to authenticate user", error);
          // If it's a known error from the API, throw it directly
          if (error.message) throw new Error(error.message);
          return null;
        }
      },
    }),
  ],
});
