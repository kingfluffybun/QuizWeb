import { getAvailableUnits } from "@/app/actions/quiz";
import LearnUnitsClient from "./LearnUnitsClient";

export const revalidate = 3600;

export default async function LearnPage() {
    const units = await getAvailableUnits();
    return <LearnUnitsClient units={units} />;
}
