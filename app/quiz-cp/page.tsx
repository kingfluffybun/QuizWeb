import { Suspense } from "react";
import { CodeProblemRunner } from "./CodeProblemRunner";
import CpSuspenseShell from "./components/CpSuspenseShell";

export default function QuizCPPage() {
  return (
    <Suspense fallback={<CpSuspenseShell />}>
      <CodeProblemRunner />
    </Suspense>
  );
}
