"use client";

import type { ReactNode } from "react";
import Sidebar from "@/app/components/Sidebar";
import type { AnimatedStats } from "./useAnimatedStats";

interface DailyGoalSummary {
  todayXp: number;
  dailyGoal: number;
}

interface CompletionScreenProps {
  isPassed: boolean;
  title: string;
  submessage: string;
  animatedStats: AnimatedStats;
  dailyGoalStats?: DailyGoalSummary | null;
  nextLevelSlot?: ReactNode;
  statusSlot?: ReactNode;
  actionsSlot: ReactNode;
}

export default function CompletionScreen({
  isPassed,
  title,
  submessage,
  animatedStats,
  dailyGoalStats,
  nextLevelSlot,
  statusSlot,
  actionsSlot,
}: CompletionScreenProps) {
  return (
    <div className="quiz-page quiz-no-footer-page">
      <Sidebar />
      <main className="quiz-completion-main">
        <div className="completion-content">
          <div className="quiz-complete-message">
            {isPassed ? (
              <div className="complete-check">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
            ) : (
              <div
                className="complete-check"
                style={{ backgroundColor: "#EF4444", borderBottomColor: "#DC2626" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </div>
            )}
            <h1>{title}</h1>
            <div className="quiz-complete-submessage">
              <p>{submessage}</p>
            </div>
          </div>

          <div className="quiz-summary-stats">
            <div className="stats-card">
              <div id="xp">
                <div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-zap preview-icon"
                  >
                    <path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />
                  </svg>
                  <h2>{animatedStats.xp}</h2>
                </div>
                <p>XP Gained</p>
              </div>
              <div id="accuracy">
                <div>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path
                      d="M11 12C11 12.2652 11.1054 12.5196 11.2929 12.7071C11.4804 12.8946 11.7348 13 12 13C12.2652 13 12.5196 12.8946 12.7071 12.7071C12.8946 12.5196 13 12.2652 13 12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12Z"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 7C11.0111 7 10.0444 7.29324 9.22215 7.84265C8.39991 8.39206 7.75904 9.17295 7.3806 10.0866C7.00217 11.0002 6.90315 12.0055 7.09608 12.9755C7.289 13.9454 7.76521 14.8363 8.46447 15.5355C9.16373 16.2348 10.0546 16.711 11.0246 16.9039C11.9945 17.0969 12.9998 16.9978 13.9134 16.6194C14.827 16.241 15.6079 15.6001 16.1574 14.7779C16.7068 13.9556 17 12.9889 17 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13 3.05514C11.1461 2.84715 9.2733 3.22042 7.64079 4.12331C6.00827 5.0262 4.69667 6.41409 3.88743 8.095C3.07818 9.77591 2.81128 11.6667 3.12365 13.506C3.43601 15.3452 4.31221 17.0419 5.63103 18.3614C6.94985 19.6809 8.64611 20.5579 10.4852 20.8712C12.3242 21.1845 14.2152 20.9186 15.8965 20.1102C17.5779 19.3018 18.9664 17.9909 19.8701 16.3588C20.7738 14.7267 21.148 12.8542 20.941 11.0001"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M15 6V9H18L21 6H18V3L15 6Z"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M15 9L12 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <h2>{animatedStats.accuracy}%</h2>
                </div>
                <p>Accuracy</p>
              </div>
              <div id="time">
                <div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-timer preview-icon"
                  >
                    <line x1="10" x2="14" y1="2" y2="2" />
                    <line x1="12" x2="15" y1="14" y2="11" />
                    <circle cx="12" cy="14" r="8" />
                  </svg>
                  <h2>{`${Math.floor(animatedStats.seconds / 60)}:${String(animatedStats.seconds % 60).padStart(2, "0")}`}</h2>
                </div>
                <p>Time Spent</p>
              </div>
            </div>

            {dailyGoalStats && (
              <div className="daily-goal-stats">
                <div className="daily-goal-progress-bar">
                  <span
                    className="daily-goal-progress-bar-fill"
                    style={{
                      width: `${Math.min(
                        100,
                        (dailyGoalStats.todayXp / dailyGoalStats.dailyGoal) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <div className="daily-goal-progress-bar-label">
                  <p>Daily Goal</p>
                  <p>
                    {dailyGoalStats.todayXp}/{dailyGoalStats.dailyGoal} XP
                  </p>
                </div>
              </div>
            )}
          </div>

          {nextLevelSlot}
          {statusSlot}
          <div className="completion-action">{actionsSlot}</div>
        </div>
      </main>
    </div>
  );
}
