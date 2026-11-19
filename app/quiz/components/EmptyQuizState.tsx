import Link from "next/link";

export default function EmptyQuizState() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "32px 16px",
        textAlign: "center",
        gap: "16px",
      }}
    >
      <h2 style={{ fontSize: "1.4rem", color: "var(--text-main)" }}>
        No Quizzes Available
      </h2>
      <p
        style={{
          maxWidth: "420px",
          color: "var(--text-muted)",
          fontSize: "0.95rem",
          lineHeight: "1.5",
        }}
      >
        This unit currently has no questions configured. Check back soon or browse other lessons.
      </p>
      <Link
        href="/learn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "12px 24px",
          borderRadius: "12px",
          background: "var(--primary-color)",
          color: "#ffffff",
          fontWeight: 600,
          textDecoration: "none",
          minHeight: "44px",
        }}
      >
        Back to Curriculum
      </Link>
    </main>
  );
}
