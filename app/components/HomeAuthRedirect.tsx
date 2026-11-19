"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function HomeAuthRedirect() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    const signedOut =
      new URLSearchParams(window.location.search).get("signedOut") === "1";
    if (!signedOut && status === "authenticated") {
      router.replace("/home");
    }
  }, [status, router]);

  return null;
}
