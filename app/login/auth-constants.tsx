export const passwordRules = [
  { key: "length", label: "8+ characters", test: (pw: string) => pw.length >= 8 },
  { key: "maxlength", label: "24 max characters", test: (pw: string) => pw.length <= 24 },
  { key: "upper", label: "uppercase", test: (pw: string) => /[A-Z]/.test(pw) },
  { key: "lower", label: "lowercase", test: (pw: string) => /[a-z]/.test(pw) },
  { key: "number", label: "number", test: (pw: string) => /[0-9]/.test(pw) },
  { key: "special", label: "symbol", test: (pw: string) => /[!@#$%^&*]/.test(pw) },
];

export const strengthLevels = [
  "#333333",
  "#e5484d",
  "#e5484d",
  "#f5a623",
  "#f5c518",
  "#8bc34a",
  "#34c759",
];

export const REMEMBERED_EMAIL_KEY = "quizweb-remembered-email";

export function sanitizeRedirectUrl(url: string | null): string {
  if (!url || typeof url !== "string") return "/post-login";
  const trimmed = url.trim();
  // Allow only internal relative paths starting with '/' but not protocol-relative '//' or backslashes
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return trimmed;
  }
  return "/post-login";
}

export function EmailFieldIcon() {
  return (
    <span className="field-icon" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
        <rect x="2" y="4" width="20" height="16" rx="2" />
      </svg>
    </span>
  );
}

export function LockFieldIcon() {
  return (
    <span className="field-icon" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </span>
  );
}

export function UserFieldIcon() {
  return (
    <span className="field-icon" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </span>
  );
}
