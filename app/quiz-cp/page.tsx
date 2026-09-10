import { redirect } from "next/navigation";

export default function QuizCPPage() {
    redirect("/quiz?type=CP");
}