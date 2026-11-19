import Sidebar from "@/app/components/Sidebar";

export default function CpSuspenseShell({
  label = "Loading coding assessment...",
}: {
  label?: string;
}) {
  return (
    <div className="quiz-page" id="code-problem">
      <Sidebar />
      <main style={{ justifyContent: "center", alignItems: "center" }}>
        <p>{label}</p>
      </main>
    </div>
  );
}
