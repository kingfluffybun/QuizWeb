import Sidebar from "@/app/components/Sidebar";
import "#css/dashboard.css";
import "#css/sidebar.css";
import "#css/cheatsheet.css";
import CheatSheetClient from "./CheatSheetClient";

export default function CheatSheetPage() {
  return (
    <div className="dashboard-page cheatsheet-page">
      <Sidebar />
      <main>
        <CheatSheetClient />
      </main>
    </div>
  );
}
