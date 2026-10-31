import { auth } from "@/auth";
import { getAvailableUnitsForUser } from "@/app/actions/progress";
import LearnUnitsClient from "../learn/LearnUnitsClient";

export default async function LearnOldPage() {
    const session = await auth();
    const userId = session?.user?.id ? Number(session.user.id) : undefined;
    const units = await getAvailableUnitsForUser(userId);
    return <LearnUnitsClient units={units} />;
}
