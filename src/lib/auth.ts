import { auth } from "@/auth";

export async function getServerAuthSession() {
  return await auth();
}
