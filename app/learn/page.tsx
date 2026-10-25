import { auth } from "@/auth";
import { getAvailableUnitsForUser } from "@/app/actions/progress";
import LearnUnitsClient from "./LearnUnitsClient";

export default async function LearnPage() {
    const session = await auth();
    const userId = session?.user?.id ? Number(session.user.id) : undefined;
    const units = await getAvailableUnitsForUser(userId);
    return <LearnUnitsClient units={units} />;
}
