import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  // 1. Extend the User interface returned in the callbacks/session
  interface User {
    role?: string;
    user_role?: string;
  }

  // 2. Extend the Session interface so session.user includes these properties
  interface Session {
    user: {
      role?: string;
      user_role?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  // 3. Optional: Extend the JWT interface if you use JWT strategies
  interface JWT {
    role?: string;
    user_role?: string;
  }
}
