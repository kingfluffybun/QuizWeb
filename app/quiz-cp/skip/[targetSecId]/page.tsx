import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CodeProblemRunner } from "../../CodeProblemRunner";
import CpSuspenseShell from "../../components/CpSuspenseShell";

interface SkipQuizCPPageProps {
  params: Promise<{ targetSecId: string }>;
}

export default async function SkipQuizCPPage({ params }: SkipQuizCPPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/learn");
  }

  const { targetSecId } = await params;
  const parsedTargetSecId = Number(targetSecId);

  // Section 1 is the starting level and cannot be skipped; minimum skip target is Section 3
  if (!Number.isFinite(parsedTargetSecId) || parsedTargetSecId <= 2) {
    redirect("/learn");
  }

  return (
    <Suspense fallback={<CpSuspenseShell label="Loading Section Skip Challenge..." />}>
      <CodeProblemRunner skipTargetSecId={parsedTargetSecId} />
    </Suspense>
  );
}
