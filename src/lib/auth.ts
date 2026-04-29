import { auth } from "@/auth";

/**
 * Helper function to get the current server session.
 * Use this in Server Components and Server Actions.
 */
export async function getServerAuthSession() {
  return await auth();
}

/**
 * Helper to check if the current user has a specific role.
 */
export async function hasRole(role: "owner" | "admin" | "staff" | "viewer") {
  const session = await auth();
  if (!session?.user) return false;

  // ADMIN can do everything
  if (session.user.role === "owner") return true;

  return session.user.role === role;
}
