import { auth } from "@/auth";
import { getCurriculumRoadmapData } from "@/app/actions/curriculum-roadmap";
import LearnRoadmapClient from "./LearnRoadmapClient";

export const dynamic = "force-dynamic";

export default async function LearnPage() {
    const session = await auth();
    const userId = session?.user?.id ? Number(session.user.id) : undefined;
    const roadmapData = await getCurriculumRoadmapData(userId);

    return (
        <LearnRoadmapClient
            roadmapData={roadmapData}
            userRole={session?.user?.role}
            username={session?.user?.name ?? undefined}
        />
    );
}
