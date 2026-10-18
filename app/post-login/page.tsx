import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPostLoginRedirect, isStaff, isAdmin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

interface PostLoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function PostLoginPage({ searchParams }: PostLoginPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as { role?: string; user_role?: string; id?: string };
  const role = user.role || user.user_role || "user";
  const defaultWorkspace = getPostLoginRedirect(role);

  const resolvedParams = searchParams ? await searchParams : {};
  const callbackUrl = typeof resolvedParams.callbackUrl === "string" ? resolvedParams.callbackUrl : undefined;

  if (!callbackUrl) {
    redirect(defaultWorkspace);
  }

  // Sanitize: must be relative, not protocol-relative, not login/post-login
  const decoded = decodeURIComponent(callbackUrl).trim();
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.startsWith("/\\")) {
    redirect(defaultWorkspace);
  }
  if (decoded === "/" || decoded.startsWith("/login") || decoded.startsWith("/post-login")) {
    redirect(defaultWorkspace);
  }

  // Validate RBAC permissions for deep link targets
  if (decoded.startsWith("/admin") || decoded.startsWith("/pending")) {
    if (!isAdmin(role)) {
      redirect(defaultWorkspace);
    }
  } else if (decoded.startsWith("/maintainer") || decoded.startsWith("/input")) {
    if (!isStaff(role)) {
      redirect(defaultWorkspace);
    }
  }

  redirect(decoded);
}
