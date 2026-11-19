import type { CPFileBuffers, CPFileKey, PublicCodeProblem } from "@/lib/cp-constants";
import type { DailyGoalData } from "@/lib/daily-goal";
import type { SequentialSkipQueuePayload } from "@/app/actions/section-skip";

export type ConsoleMessage = {
  level: "log" | "warn" | "error";
  text: string;
};

export type StepFeedback = {
  passed: boolean;
  message: string;
  failedTab?: CPFileKey;
  lineNumber?: number;
};

export type PersistedCPSession = {
  currentStepIndex: number;
  code: CPFileBuffers;
  stepSnapshots: Record<number, CPFileBuffers>;
  lives: number;
};

export type MobileTab = "task" | "code" | "preview";

export type CpStatus = "active" | "completed" | "gameover";

export interface NextUnitInfo {
  unit_id: number;
  unit_title: string;
  sec_id: number;
  sec_num: number;
  cat_name: string;
}

export interface CodeProblemRunnerProps {
  unitId?: number;
  skipTargetSecId?: number;
  initialProblem?: PublicCodeProblem | null;
  initialDailyGoal?: DailyGoalData | null;
  initialNextUnit?: NextUnitInfo | null;
  skipPayloadInitial?: SequentialSkipQueuePayload | null;
}

export const CP_FILE_META: Record<
  CPFileKey,
  { label: string; language: "html" | "css" | "javascript" }
> = {
  html: { label: "index.html", language: "html" },
  css: { label: "style.css", language: "css" },
  js: { label: "script.js", language: "javascript" },
};
