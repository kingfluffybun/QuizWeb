import { signOut } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function checkLoginRateLimitImpl(email: string) {
  return checkRateLimit(`login:${email.toLowerCase().trim()}`);
}

export async function signOutActionImpl() {
  // NextAuth's events.signOut callback atomically increments token_version and evicts cache
  await signOut({ redirectTo: "/?signedOut=1" });
}
