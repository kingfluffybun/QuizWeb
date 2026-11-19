export async function verifyRecaptchaToken(
  token: string | null | undefined,
): Promise<{ success: boolean; score?: number }> {
  if (!token || typeof token !== "string" || !token.trim()) {
    return { success: false };
  }

  const trimmed = token.trim();

  if (process.env.NODE_ENV !== "production") {
    const testBypass =
      process.env.RECAPTCHA_BYPASS_TOKEN || "test-bypass-recaptcha-token";
    if (trimmed === testBypass || trimmed === "test-bypass-token") {
      return { success: true, score: 1.0 };
    }
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    if (process.env.NODE_ENV === "test") {
      return { success: true, score: 1.0 };
    }
    console.error("Missing RECAPTCHA_SECRET_KEY in server environment.");
    return { success: false };
  }

  try {
    const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey,
        response: trimmed,
      }),
    });

    if (!response.ok) {
      return { success: false };
    }

    const data = await response.json();
    if (!data.success || (typeof data.score === "number" && data.score < 0.5)) {
      return { success: false };
    }

    return { success: true, score: data.score };
  } catch (err) {
    console.error("reCAPTCHA siteverify error:", err);
    return { success: false };
  }
}
