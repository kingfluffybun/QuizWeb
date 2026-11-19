import Link from "next/link";
import type { ReactNode } from "react";
import type { RoadmapSection } from "@/app/actions/curriculum-roadmap";
import { BoxesIcon, PresentationIcon, QuizQuestionIcon } from "./RoadmapIcons";

interface UpNextActivity {
  label: string;
  href: string;
}

interface SectionDetailRailProps {
  activeSection?: RoadmapSection;
  animateSectionDetail: boolean;
  sectionProgress: number;
  completedLevels: number;
  totalLevels: number;
  upNextUnitTitle?: string;
  upNextActivity: UpNextActivity | null;
  guestNotice?: ReactNode;
}

export default function SectionDetailRail({
  activeSection,
  animateSectionDetail,
  sectionProgress,
  completedLevels,
  totalLevels,
  upNextUnitTitle,
  upNextActivity,
  guestNotice,
}: SectionDetailRailProps) {
  return (
    <aside className="section-detail-rail" aria-label="Current section details">
      <div className="section-detail">
        <div
          key={activeSection?.sec_id ?? "overview"}
          className={`section-detail-content${animateSectionDetail ? " section-detail-content--animated" : ""}`}
        >
          <h1>{activeSection?.sec_title ?? "Curriculum Roadmap"}</h1>
          <p id="section-description">
            {activeSection?.description ??
              "Master essential web development skills and hands-on coding techniques."}
          </p>
          <div className="section-stats">
            <div className="icon-label">
              <BoxesIcon />
              <p>
                {activeSection?.total_units ?? 0}{" "}
                {activeSection?.total_units === 1 ? "Unit" : "Units"}
              </p>
            </div>
            <div className="icon-label">
              <PresentationIcon />
              <p>
                {activeSection?.total_slides ?? 0} Lesson{" "}
                {activeSection?.total_slides === 1 ? "Slide" : "Slides"}
              </p>
            </div>
            <div className="icon-label">
              <QuizQuestionIcon />
              <p>
                {activeSection?.total_questions ?? 0}{" "}
                {activeSection?.total_questions === 1 ? "Question" : "Questions"}
              </p>
            </div>
          </div>

          {guestNotice}
        </div>
      </div>

      <section className="section-progress-card" aria-labelledby="section-progress-title">
        <h2 id="section-progress-title">Section Progress</h2>
        <p className="section-progress-summary">
          {sectionProgress}% complete · {completedLevels} of {totalLevels} levels finished
        </p>
        <div
          className="section-progress-track"
          role="progressbar"
          aria-label={`${activeSection?.sec_title ?? "Section"} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={sectionProgress}
          aria-valuetext={`${sectionProgress}% complete`}
        >
          <div className="section-progress-fill" style={{ width: `${sectionProgress}%` }} />
        </div>
        <div className="section-progress-up-next">
          <div>
            <span className="section-progress-eyebrow">Up next</span>
            <p>{upNextUnitTitle ?? "No available lessons in this or later sections yet."}</p>
          </div>
          {upNextActivity && (
            <Link
              href={upNextActivity.href}
              className="lesson-link section-progress-continue"
              aria-label={`Continue to ${upNextUnitTitle}`}
            >
              <p>Continue</p>
            </Link>
          )}
        </div>
      </section>
    </aside>
  );
}
