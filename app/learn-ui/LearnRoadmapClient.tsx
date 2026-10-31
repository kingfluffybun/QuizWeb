"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";
import type {
  CurriculumRoadmapData,
  RoadmapSection,
  RoadmapUnitNode,
} from "@/app/actions/curriculum-roadmap";
import "#css/quiz.css";
import "#css/nav.css";
import "#css/sidebar.css";
import "#css/learn.css";

export interface SelectedRoadmapNode {
  unitId?: number;
  unitTitle: string;
  secId: number;
  secNum: number;
  catName: string;
  nodeType: "lesson" | "quiz" | "code_problem" | "checkpoint" | "coming_soon";
  isCompleted: boolean;
  isLocked: boolean;
  lockReason?: string;
  slideCount?: number;
  quizCount?: number;
}

interface LearnRoadmapClientProps {
  roadmapData: CurriculumRoadmapData;
  userRole?: string;
  username?: string;
}

type RoadlineStartSide = "left" | "right";
type RoadlineSegment = "to-top" | "to-side";

function getRoadlinePath(startSide: RoadlineStartSide, segment: RoadlineSegment) {
  if (segment === "to-top") {
    return startSide === "left"
      ? "M 101 38 H 138 Q 168 38 168 68 V 113"
      : "M 123 38 H 86 Q 56 38 56 68 V 113";
  }

  return startSide === "left"
    ? "M 56 77 V 121 Q 56 151 86 151 H 123"
    : "M 168 77 V 121 Q 168 151 138 151 H 101";
}

export default function LearnRoadmapClient({
  roadmapData,
  userRole,
  username,
}: LearnRoadmapClientProps) {
  const [activeSectionId, setActiveSectionId] = useState<number>(() => {
    return (
      roadmapData.userProgression.activeSectionId ??
      roadmapData.sections[0]?.sec_id ??
      1
    );
  });

  const [selectedNode, setSelectedNode] = useState<SelectedRoadmapNode | null>(
    null,
  );
  const modalRef = useRef<HTMLDivElement>(null);
  const isJumpingRef = useRef(false);

  const activeSection =
    roadmapData.sections.find((s) => s.sec_id === activeSectionId) ??
    roadmapData.sections[0];

  const isStaffUser = Boolean(
    roadmapData.userProgression.isStaff ||
      userRole === "admin" ||
      userRole === "maintainer",
  );

  const isGuest = !roadmapData.userProgression.userId && !username;
  const firstUnitId = roadmapData.sections[0]?.units[0]?.unit_id ?? 98;

  // Auto-sync active section in left rail as the learner scrolls
  useEffect(() => {
    const sectionElements = document.querySelectorAll<HTMLElement>(
      "section.curriculum-section[data-section-id]",
    );
    if (sectionElements.length === 0) return;

    let rafId: number | null = null;

    const updateActiveSectionOnScroll = () => {
      if (isJumpingRef.current) return;

      const readingZoneTop = 160;
      let matchedSecId: number | null = null;

      for (let i = 0; i < sectionElements.length; i++) {
        const el = sectionElements[i];
        const rect = el.getBoundingClientRect();
        // A section is active if its top is above or near the reading line and its bottom extends below it
        if (rect.top <= readingZoneTop && rect.bottom > readingZoneTop) {
          const id = Number(el.getAttribute("data-section-id"));
          if (Number.isFinite(id) && id > 0) {
            matchedSecId = id;
            break;
          }
        }
      }

      // If at top of the page before any threshold
      if (matchedSecId === null && window.scrollY < 100) {
        matchedSecId = roadmapData.sections[0]?.sec_id ?? 1;
      }

      if (matchedSecId !== null) {
        setActiveSectionId((prev) => (prev === matchedSecId ? prev : matchedSecId));
      }
    };

    const handleScroll = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateActiveSectionOnScroll);
    };

    // Also attach IntersectionObserver for responsive triggers
    const observer = new IntersectionObserver(
      (entries) => {
        if (isJumpingRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const secId = Number(entry.target.getAttribute("data-section-id"));
            if (Number.isFinite(secId) && secId > 0) {
              setActiveSectionId((prev) => (prev === secId ? prev : secId));
            }
          }
        }
      },
      {
        rootMargin: "-15% 0px -65% 0px",
        threshold: 0,
      },
    );

    const headers = document.querySelectorAll<HTMLElement>(
      ".section-header[data-section-id]",
    );
    headers.forEach((h) => observer.observe(h));

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [roadmapData.sections]);

  // Handle outside click and Escape key dismissal of popup
  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        modalRef.current &&
        !modalRef.current.contains(target) &&
        !target.closest(".level-btn")
      ) {
        setSelectedNode(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedNode(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelectNode = useCallback(
    (
      unit: RoadmapUnitNode,
      section: RoadmapSection,
      nodeType: "lesson" | "quiz" | "code_problem",
      isCompleted: boolean,
      isLocked: boolean,
      lockReason?: string,
    ) => {
      // Toggle closed if clicking currently selected node
      setSelectedNode((prev) => {
        if (
          prev &&
          prev.unitId === unit.unit_id &&
          prev.nodeType === nodeType
        ) {
          return null;
        }
        return {
          unitId: unit.unit_id,
          unitTitle: unit.unit_title,
          secId: section.sec_id,
          secNum: section.sec_num,
          catName: section.cat_name,
          nodeType,
          isCompleted,
          isLocked,
          lockReason,
          slideCount: unit.slide_count,
          quizCount: unit.quiz_count,
        };
      });
    },
    [],
  );

  const handleSelectCheckpoint = useCallback(
    (section: RoadmapSection) => {
      setSelectedNode((prev) => {
        if (
          prev &&
          prev.secId === section.sec_id &&
          prev.nodeType === "checkpoint"
        ) {
          return null;
        }
        return {
          unitTitle: `${section.cat_name}, Section ${section.sec_num}: ${section.sec_title}`,
          secId: section.sec_id,
          secNum: section.sec_num,
          catName: section.cat_name,
          nodeType: "checkpoint",
          isCompleted: section.is_completed,
          isLocked: section.is_locked,
          lockReason: section.is_locked
            ? "Complete earlier sections to unlock"
            : undefined,
        };
      });
    },
    [],
  );

  const handleSelectComingSoon = useCallback(
    (section: RoadmapSection) => {
      setSelectedNode((prev) => {
        if (
          prev &&
          prev.secId === section.sec_id &&
          prev.nodeType === "coming_soon"
        ) {
          return null;
        }
        return {
          unitTitle: `${section.sec_title}`,
          secId: section.sec_id,
          secNum: section.sec_num,
          catName: section.cat_name,
          nodeType: "coming_soon",
          isCompleted: false,
          isLocked: true,
          lockReason: "Units under development",
        };
      });
    },
    [],
  );

  const handleCloseDetail = () => {
    setSelectedNode(null);
  };

  const handleJumpToSection = (secId: number) => {
    setActiveSectionId(secId);
    isJumpingRef.current = true;
    const element = document.getElementById(`section-${secId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(() => {
      isJumpingRef.current = false;
    }, 700);
  };

  return (
    <div className="quiz-page quiz-no-footer-page learn-page">
      <Sidebar role={userRole} username={username} />
      <main>
        <div className="learn-content">
          {/* Left Sticky Rail: Live Section Detail & Statistics */}
          <aside className="section-detail-rail" aria-label="Current section details">
            <div className="section-detail">
              <div
                key={activeSection?.sec_id ?? "overview"}
                className="section-detail-content"
              >
              <h1>{activeSection?.sec_title ?? "Curriculum Roadmap"}</h1>
              {/* For description, chat niyo ako -clarence */}
              <p id="section-description">
                {activeSection?.description ??
                  "Master essential web development skills and hands-on coding techniques."}
              </p>
              <div className="section-stats">
                <div className="icon-label">
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
                    className="lucide lucide-boxes preview-icon"
                    aria-hidden="true"
                  >
                    <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z" />
                    <path d="m7 16.5-4.74-2.85" />
                    <path d="m7 16.5 5-3" />
                    <path d="M7 16.5v5.17" />
                    <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z" />
                    <path d="m17 16.5-5-3" />
                    <path d="m17 16.5 4.74-2.85" />
                    <path d="M17 16.5v5.17" />
                    <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z" />
                    <path d="M12 8 7.26 5.15" />
                    <path d="m12 8 4.74-2.85" />
                    <path d="M12 13.5V8" />
                  </svg>
                  {/* Total Units ng Section */}
                  <p>
                    {activeSection?.total_units ?? 0}{" "}
                    {activeSection?.total_units === 1 ? "Unit" : "Units"}
                  </p>
                </div>
                <div className="icon-label">
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
                    className="lucide lucide-presentation preview-icon"
                    aria-hidden="true"
                  >
                    <path d="M2 3h20" />
                    <path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
                    <path d="m7 21 5-5 5 5" />
                  </svg>
                  {/* Total Lesson Slides ng Section */}
                  <p>
                    {activeSection?.total_slides ?? 0} Lesson{" "}
                    {activeSection?.total_slides === 1 ? "Slide" : "Slides"}
                  </p>
                </div>
                <div className="icon-label">
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
                    className="lucide lucide-circle-question-mark preview-icon"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                  </svg>
                  {/* Total Questions ng Section */}
                  <p>
                    {activeSection?.total_questions ?? 0}{" "}
                    {activeSection?.total_questions === 1
                      ? "Question"
                      : "Questions"}
                  </p>
                </div>
              </div>

              {/* Guest Preview Notice in Left Rail */}
              {isGuest && (
                <div className="guest-rail-notice-box">
                  <div className="guest-rail-notice-header">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>Guest Preview Mode</span>
                  </div>
                  <p className="guest-rail-notice-desc">
                    You are exploring as a guest. The first unit is open to preview. Sign in to save your progress, unlock all units, and track your streaks!
                  </p>
                  <Link href="/login" className="guest-rail-login-btn">
                    Sign In to Unlock All
                  </Link>
                </div>
              )}

              </div>
            </div>
          </aside>

          {/* Right Roadmap: Linear Level Tree */}
          <div className="roadmap" role="region" aria-label="Curriculum Learning Path">
            {/* Interactive Floating Action Popup */}
            {selectedNode && (
              <div
                ref={modalRef}
                className="lesson-detail-container"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-node-title"
              >
                <button
                  type="button"
                  className="lesson-detail-close"
                  onClick={handleCloseDetail}
                  aria-label="Close details"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>

                <div className="lesson-detail">
                  {selectedNode.nodeType === "lesson" && (
                    <div className="lesson-detail-icon-label">
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
                        className="lucide lucide-book-open preview-icon"
                        aria-hidden="true"
                      >
                        <path d="M12 5v16" />
                        <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
                      </svg>
                      <p>Learn</p>
                    </div>
                  )}

                  {selectedNode.nodeType === "code_problem" && (
                    <div className="lesson-detail-icon-label">
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
                        className="lucide lucide-code preview-icon"
                        aria-hidden="true"
                      >
                        <path d="m16 18 6-6-6-6" />
                        <path d="m8 6-6 6 6 6" />
                      </svg>
                      <p>Code Problem</p>
                    </div>
                  )}

                  {selectedNode.nodeType === "quiz" && (
                    <div className="lesson-detail-icon-label">
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
                        className="lucide lucide-circle-question-mark preview-icon"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <path d="M12 17h.01" />
                      </svg>
                      <p>Quiz</p>
                    </div>
                  )}

                  {selectedNode.nodeType === "checkpoint" && (
                    <div className="lesson-detail-icon-label">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M14 20L21 12.5L14 5"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          stroke="currentColor"
                        />
                        <path
                          d="M5 20L12 12.5L5 5"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          stroke="currentColor"
                        />
                      </svg>
                      <p>Skip Section</p>
                    </div>
                  )}

                  {selectedNode.nodeType === "coming_soon" && (
                    <div className="lesson-detail-icon-label">
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
                        className="lucide lucide-boxes preview-icon"
                        aria-hidden="true"
                      >
                        <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z" />
                        <path d="m7 16.5-4.74-2.85" />
                        <path d="m7 16.5 5-3" />
                        <path d="M7 16.5v5.17" />
                        <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z" />
                        <path d="m17 16.5-5-3" />
                        <path d="m17 16.5 4.74-2.85" />
                        <path d="M17 16.5v5.17" />
                        <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z" />
                        <path d="M12 8 7.26 5.15" />
                        <path d="m12 8 4.74-2.85" />
                        <path d="M12 13.5V8" />
                      </svg>
                      <p>Coming Soon</p>
                    </div>
                  )}

                  {/* Unit / Level Title */}
                  <h2 id="modal-node-title">{selectedNode.unitTitle}</h2>
                </div>

                {selectedNode.nodeType === "checkpoint" ? (
                  isGuest ? (
                    <div className="guest-unit-lock-modal">
                      <p className="guest-unit-lock-desc">
                        Section skip challenges are reserved for registered learners. Sign in to take skip challenges, earn XP, and track your streak!
                      </p>
                      <Link href="/login" className="lesson-link">
                        <p>Sign In to Continue</p>
                      </Link>
                    </div>
                  ) : (
                    <div className="skip-modal-content">
                      <p className="skip-modal-desc">
                        Skip directly to this section by passing the coding assessment for every preceding uncompleted unit.
                      </p>
                      <div className="section-skip-badges" style={{ marginBottom: "12px" }}>
                        <span className="section-skip-chip">⏱️ 5 minutes/Unit</span>
                        <span className="section-skip-chip">❤️ 5 lives only</span>
                      </div>
                      <Link
                        href={`/quiz-cp/skip/${selectedNode.secId}`}
                        className="lesson-link"
                      >
                        <p>Start Skip Challenge</p>
                      </Link>
                    </div>
                  )
                ) : selectedNode.nodeType === "coming_soon" ? (
                  <button
                    type="button"
                    disabled
                    className="lesson-link disabled"
                    style={{ cursor: "not-allowed", border: "none" }}
                  >
                    <p>Coming Soon</p>
                  </button>
                ) : selectedNode.isLocked ? (
                  <div className="locked-node-modal-content">
                    {isGuest ? (
                      <div className="guest-unit-lock-modal">
                        <p className="guest-unit-lock-desc">
                          Guest preview includes the first unit (Document Structure). Sign in to unlock this unit, earn XP, and track your streak!
                        </p>
                        <Link href="/login" className="lesson-link">
                          <p>Sign In to Continue</p>
                        </Link>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled
                          className="lesson-link disabled"
                          style={{ cursor: "not-allowed", border: "none" }}
                        >
                          <p>{selectedNode.lockReason ?? "Locked"}</p>
                        </button>
                        {selectedNode.secId >= 3 && (
                          <Link
                            href={`/quiz-cp/skip/${selectedNode.secId}`}
                            className="skip-secondary-link"
                          >
                            ⚡ Skip ahead to Section {selectedNode.secNum}
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <Link
                    href={
                      selectedNode.nodeType === "code_problem"
                        ? `/quiz-cp/${selectedNode.unitId}`
                        : selectedNode.nodeType === "quiz"
                          ? `/quiz/${selectedNode.unitId}?start=quiz`
                          : `/quiz/${selectedNode.unitId}`
                    }
                    className="lesson-link"
                  >
                    <p>
                      {selectedNode.nodeType === "code_problem"
                        ? selectedNode.isCompleted
                          ? "Review Code Problem"
                          : "Start Code Problem"
                        : selectedNode.nodeType === "quiz"
                          ? selectedNode.isCompleted
                            ? "Review Quiz"
                            : "Take Quiz"
                          : selectedNode.isCompleted
                            ? "Review Lesson"
                            : "Start Lesson"}
                    </p>
                  </Link>
                )}
              </div>
            )}

            {/* Sections & Interactive Nodes */}
            {roadmapData.sections.map((section) => {
              const hasUnits = section.units.length > 0;

              return (
                <section
                  key={section.sec_id}
                  id={`section-${section.sec_id}`}
                  data-section-id={section.sec_id}
                  className="curriculum-section"
                  aria-labelledby={`section-title-${section.sec_id}`}
                >
                  {/* Section Title Header */}
                  <div
                    className={`section-header${section.is_locked ? " disabled" : ""}`}
                    data-section-id={section.sec_id}
                    onClick={() => handleJumpToSection(section.sec_id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleJumpToSection(section.sec_id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                    aria-label={`Section ${section.sec_num}: ${section.sec_title}${
                      section.is_locked ? " (Locked)" : ""
                    }`}
                  >
                    <p>
                      {section.cat_name}, Section {section.sec_num}
                    </p>
                    <h2 id={`section-title-${section.sec_id}`}>{section.sec_title}</h2>
                  </div>

                  {/* If section is locked and has units, display the Skip / Jump checkpoint row for Section 3+ (Authenticated only) */}
                  {!isGuest && section.sec_id >= 3 && section.is_locked && hasUnits && (
                    <div className="level-path">
                      <div className="level-row path-left">
                        <div className="level-content">
                          {/* Skip Section */}
                          <div className="level">
                            <button
                              type="button"
                              className="level-btn checkpoint"
                              onClick={() => handleSelectCheckpoint(section)}
                              aria-label={`Skip Section Checkpoint for ${section.sec_title}`}
                              title={`Skip ahead to ${section.sec_title}`}
                            >
                              <svg
                                width="28"
                                height="28"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                              >
                                <path
                                  d="M14 20L21 12.5L14 5"
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  stroke="currentColor"
                                />
                                <path
                                  d="M5 20L12 12.5L5 5"
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  stroke="currentColor"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section Units */}
                  {hasUnits ? (
                    section.units.map((unit, unitIndex) => {
                      const startSide: RoadlineStartSide = unitIndex % 2 === 0 ? "left" : "right";
                      const hasQuiz = unit.quiz_count > 0;
                      const hasCp = unit.has_coding_assessment;
                      const lessonSide: RoadlineStartSide = startSide;
                      const quizSide: RoadlineStartSide = lessonSide === "left" ? "right" : "left";
                      const cpSide: RoadlineStartSide = hasQuiz
                        ? (quizSide === "left" ? "right" : "left")
                        : (lessonSide === "left" ? "right" : "left");

                      // Accurate per-node status determination:
                      const isGuestUnitLocked = isGuest && unit.unit_id !== firstUnitId;

                      // 1. Lesson:
                      const isLessonCompleted =
                        unit.is_completed ||
                        (unit.slide_count > 0 &&
                          unit.current_slide_order >= unit.slide_count);
                      const isLessonLocked = isStaffUser
                        ? false
                        : isGuestUnitLocked
                          ? true
                          : unit.is_locked;
                      const lessonLockReason = isGuestUnitLocked
                        ? "Sign in to unlock"
                        : isLessonLocked
                          ? "Locked"
                          : undefined;

                      // 2. Quiz:
                      const isLessonDoneForQuiz =
                        unit.slide_count === 0 ||
                        unit.current_slide_order >= unit.slide_count ||
                        unit.is_completed;
                      const isQuizCompleted = unit.is_completed;
                      const isQuizLocked = isStaffUser
                        ? false
                        : isGuestUnitLocked
                          ? true
                          : unit.is_locked || (!isLessonDoneForQuiz && !unit.is_completed);
                      const quizLockReason = isGuestUnitLocked
                        ? "Sign in to unlock"
                        : unit.is_locked
                          ? "Locked"
                          : !isLessonDoneForQuiz
                            ? "Complete Lesson first"
                            : undefined;

                      // 3. Code Problem:
                      const isCpCompleted = unit.is_completed;
                      const isCpLocked = isStaffUser
                        ? false
                        : isGuestUnitLocked
                          ? true
                          : unit.is_locked || !unit.is_completed;
                      const cpLockReason = isGuestUnitLocked
                        ? "Sign in to unlock"
                        : unit.is_locked
                          ? "Locked"
                          : !unit.is_completed
                            ? "Complete Quiz first"
                            : undefined;

                      const hasNextAfterLesson = hasQuiz || hasCp;
                      const hasNextAfterQuiz = hasCp;

                      return (
                        <div key={unit.unit_id} className="curriculum-unit-group">
                          {/* Unit Title Divider between units */}
                          {unitIndex > 0 && (
                            <div className="level-row-divider">
                              <hr />
                              {/* Unit Title */}
                              <p>{unit.unit_title}</p>
                              <hr />
                            </div>
                          )}

                          <div className="level-path">
                            {/* Lesson Node */}
                            <div className={`level-row path-${lessonSide}`}>
                              <div className="level-content">
                                <div className="level">
                                  <button
                                    type="button"
                                    className={`level-btn${
                                      isLessonCompleted
                                        ? " complete"
                                        : isLessonLocked
                                          ? " disabled"
                                          : ""
                                    }`}
                                    onClick={() =>
                                      handleSelectNode(
                                        unit,
                                        section,
                                        "lesson",
                                        isLessonCompleted,
                                        isLessonLocked,
                                        lessonLockReason,
                                      )
                                    }
                                    aria-label={`Lesson for ${unit.unit_title}${
                                      isLessonCompleted
                                        ? " (Completed)"
                                        : isLessonLocked
                                          ? " (Locked)"
                                          : " (Current Level)"
                                    }`}
                                  >
                                    {isLessonCompleted ? (
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="28"
                                        height="28"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="lucide lucide-check preview-icon"
                                        aria-hidden="true"
                                      >
                                        <path d="M20 6 9 17l-5-5" />
                                      </svg>
                                    ) : (
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="28"
                                        height="28"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="lucide lucide-book-open preview-icon"
                                        aria-hidden="true"
                                      >
                                        <path d="M12 5v16" />
                                        <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              </div>
                              {hasNextAfterLesson && (
                                <svg
                                  className={`roadline ${lessonSide === "left" ? "roadline-to-right" : "roadline-to-left"}`}
                                  viewBox={lessonSide === "left" ? "0 0 168 113" : "0 0 168 189"}
                                  aria-hidden="true"
                                >
                                  <path d={getRoadlinePath(lessonSide, "to-top")} />
                                </svg>
                              )}
                            </div>

                            {/* Quiz Node */}
                            {unit.quiz_count > 0 && (
                              <div className={`level-row path-${quizSide}`}>
                                <div className="level-content">
                                  <div className="level">
                                    <button
                                      type="button"
                                      className={`level-btn${
                                        isQuizCompleted
                                          ? " complete"
                                          : isQuizLocked
                                            ? " disabled"
                                            : ""
                                      }`}
                                      onClick={() =>
                                        handleSelectNode(
                                          unit,
                                          section,
                                          "quiz",
                                          isQuizCompleted,
                                          isQuizLocked,
                                          quizLockReason,
                                        )
                                      }
                                      aria-label={`Quiz for ${unit.unit_title}${
                                        isQuizCompleted
                                          ? " (Completed)"
                                          : isQuizLocked
                                            ? " (Locked)"
                                            : ""
                                      }`}
                                    >
                                      {isQuizCompleted ? (
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="28"
                                          height="28"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className="lucide lucide-check preview-icon"
                                          aria-hidden="true"
                                        >
                                          <path d="M20 6 9 17l-5-5" />
                                        </svg>
                                      ) : (
                                        <svg
                                          width="28"
                                          height="28"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                          aria-hidden="true"
                                        >
                                          <path
                                            d="M8 8.00447C8.36294 7.00272 9.07931 6.15801 10.0222 5.61995C10.9651 5.08189 12.0738 4.88521 13.1517 5.06473C14.2297 5.24426 15.2074 5.78841 15.9118 6.60081C16.6161 7.41321 17.0016 8.44143 17 9.50335C17 12.5011 12 14.5 12 14.5"
                                            strokeWidth="4"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            stroke="currentColor"
                                          />
                                          <path
                                            d="M12 20H12.01"
                                            strokeWidth="4"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            stroke="currentColor"
                                          />
                                        </svg>
                                      )}
                                    </button>
                                  </div>
                                </div>
                                {hasNextAfterQuiz && (
                                  <svg
                                    className={`roadline ${quizSide === "left" ? "roadline-to-right" : "roadline-to-left"}`}
                                    viewBox={quizSide === "left" ? "0 0 168 113" : "0 0 168 189"}
                                    aria-hidden="true"
                                  >
                                    <path d={getRoadlinePath(quizSide, "to-side")} />
                                  </svg>
                                )}
                              </div>
                            )}

                            {/* Code Problem Node */}
                            {unit.has_coding_assessment && (
                              <div className={`level-row path-${cpSide}`}>
                                <div className="level-content">
                                  <div className="level">
                                    <button
                                      type="button"
                                      className={`level-btn${
                                        isCpCompleted
                                          ? " complete"
                                          : isCpLocked
                                            ? " disabled"
                                            : ""
                                      }`}
                                      onClick={() =>
                                        handleSelectNode(
                                          unit,
                                          section,
                                          "code_problem",
                                          isCpCompleted,
                                          isCpLocked,
                                          cpLockReason,
                                        )
                                      }
                                      aria-label={`Code Problem for ${unit.unit_title}${
                                        isCpCompleted
                                          ? " (Completed)"
                                          : isCpLocked
                                            ? " (Locked)"
                                            : ""
                                      }`}
                                    >
                                      {isCpCompleted ? (
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="28"
                                          height="28"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className="lucide lucide-check preview-icon"
                                          aria-hidden="true"
                                        >
                                          <path d="M20 6 9 17l-5-5" />
                                        </svg>
                                      ) : (
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="28"
                                          height="28"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className="lucide lucide-code preview-icon"
                                          aria-hidden="true"
                                        >
                                          <path d="m16 18 6-6-6-6" />
                                          <path d="m8 6-6 6 6 6" />
                                        </svg>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    /* Empty Section Placeholder: Units coming soon */
                    <div className="level-path">
                      <div className="level-row path-left">
                        <div className="level-content">
                          {/* Skip Section / Coming soon */}
                          <div className="level">
                            <button
                              type="button"
                              className="level-btn disabled"
                              onClick={() => handleSelectComingSoon(section)}
                              aria-label={`Units coming soon for ${section.sec_title}`}
                              title={`Units coming soon for ${section.sec_title}`}
                            >
                              <svg
                                width="28"
                                height="28"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                              >
                                <path
                                  d="M14 20L21 12.5L14 5"
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  stroke="currentColor"
                                />
                                <path
                                  d="M5 20L12 12.5L5 5"
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  stroke="currentColor"
                                />
                              </svg>
                            </button>
                          </div>
                          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                            Units coming soon
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
