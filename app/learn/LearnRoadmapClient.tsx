"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";
import type {
  CurriculumRoadmapData,
  RoadmapSection,
  RoadmapUnitNode,
} from "@/app/actions/curriculum-roadmap";
import "#css/sidebar.css";
import "#css/learn.css";
import {
  computeSectionStats,
  isRoadmapCpComplete,
  isRoadmapLessonComplete,
  isRoadmapQuizComplete,
  type SelectedRoadmapNode,
} from "@/lib/roadmap-progress";
import {
  alignSectionHeaderWithDetail,
  useRoadmapScrollSync,
} from "./hooks/useRoadmapScrollSync";
import SectionDetailRail from "./components/SectionDetailRail";
import NodeDetailModal from "./components/NodeDetailModal";
import SectionUnitGroup from "./components/SectionUnitGroup";
import { FastForwardIcon } from "./components/RoadmapIcons";

export type { SelectedRoadmapNode };

interface LearnRoadmapClientProps {
  roadmapData: CurriculumRoadmapData;
  userRole?: string;
  username?: string;
  email?: string;
}

export default function LearnRoadmapClient({
  roadmapData,
  userRole,
  username,
  email,
}: LearnRoadmapClientProps) {
  const [activeSectionId, setActiveSectionId] = useState<number>(() => {
    return (
      roadmapData.userProgression.activeSectionId ??
      roadmapData.sections[0]?.sec_id ??
      1
    );
  });
  const initialSectionIdRef = useRef(activeSectionId);

  const [selectedNode, setSelectedNode] = useState<SelectedRoadmapNode | null>(null);
  const [isDetailClosing, setIsDetailClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const detailCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isJumpingRef = useRef(false);
  const activeSectionIdRef = useRef(activeSectionId);
  const hasUserNavigatedSectionsRef = useRef(false);
  const [animateSectionDetail, setAnimateSectionDetail] = useState(false);

  const closeDetail = useCallback(() => {
    if (!selectedNode || isDetailClosing) return;
    setIsDetailClosing(true);
    detailCloseTimeoutRef.current = setTimeout(() => {
      setSelectedNode(null);
      setIsDetailClosing(false);
      detailCloseTimeoutRef.current = null;
    }, 180);
  }, [isDetailClosing, selectedNode]);

  const showDetail = useCallback((node: SelectedRoadmapNode) => {
    if (detailCloseTimeoutRef.current) {
      clearTimeout(detailCloseTimeoutRef.current);
      detailCloseTimeoutRef.current = null;
    }
    setIsDetailClosing(false);
    setSelectedNode(node);
  }, []);

  useEffect(
    () => () => {
      if (detailCloseTimeoutRef.current) {
        clearTimeout(detailCloseTimeoutRef.current);
      }
    },
    [],
  );

  const updateActiveSection = useCallback(
    (secId: number, animate = hasUserNavigatedSectionsRef.current) => {
      if (activeSectionIdRef.current === secId) return;
      activeSectionIdRef.current = secId;
      if (animate) setAnimateSectionDetail(true);
      setActiveSectionId(secId);
    },
    [],
  );

  const updateActiveSectionOnScroll = useCallback(
    (sectionElements: NodeListOf<HTMLElement>) => {
      if (isJumpingRef.current) return;

      const readingZoneTop = 160;
      let matchedSecId: number | null = null;

      for (let i = 0; i < sectionElements.length; i++) {
        const el = sectionElements[i];
        const rect = el.getBoundingClientRect();
        if (rect.top <= readingZoneTop && rect.bottom > readingZoneTop) {
          const id = Number(el.getAttribute("data-section-id"));
          if (Number.isFinite(id) && id > 0) {
            matchedSecId = id;
            break;
          }
        }
      }

      if (matchedSecId === null && window.scrollY < 100) {
        matchedSecId = roadmapData.sections[0]?.sec_id ?? 1;
      }

      if (matchedSecId !== null) {
        updateActiveSection(matchedSecId);
      }
    },
    [roadmapData.sections, updateActiveSection],
  );

  useRoadmapScrollSync({
    sections: roadmapData.sections,
    initialSectionIdRef,
    isJumpingRef,
    hasUserNavigatedSectionsRef,
    modalRef,
    selectedNode,
    updateActiveSection,
    closeDetail,
    onComputeActiveSectionOnScroll: updateActiveSectionOnScroll,
  });

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
  const activeSectionIndex = roadmapData.sections.findIndex(
    (section) => section.sec_id === activeSection?.sec_id,
  );
  const { totalLevels, completedLevels, sectionProgress } = computeSectionStats(
    activeSection?.units ?? [],
  );

  const upNextUnit = roadmapData.sections
    .slice(Math.max(0, activeSectionIndex))
    .flatMap((section) => section.units)
    .find(
      (unit) =>
        !unit.is_completed &&
        (isStaffUser || (!unit.is_locked && (!isGuest || unit.unit_id === firstUnitId))) &&
        ((unit.slide_count > 0 && unit.current_slide_order < unit.slide_count) ||
          unit.quiz_count > 0 ||
          unit.has_coding_assessment),
    );
  const upNextActivity = upNextUnit
    ? !isRoadmapLessonComplete(upNextUnit)
      ? { label: "Learn", href: `/quiz/${upNextUnit.unit_id}` }
      : upNextUnit.quiz_count > 0 && !isRoadmapQuizComplete(upNextUnit)
        ? { label: "Quiz", href: `/quiz/${upNextUnit.unit_id}?start=quiz` }
        : upNextUnit.has_coding_assessment && !isRoadmapCpComplete(upNextUnit)
          ? { label: "Code", href: `/quiz-cp/${upNextUnit.unit_id}` }
          : { label: "Review", href: `/quiz/${upNextUnit.unit_id}` }
    : null;

  const handleSelectNode = useCallback(
    (
      unit: RoadmapUnitNode,
      section: RoadmapSection,
      nodeType: "lesson" | "quiz" | "code_problem",
      isCompleted: boolean,
      isLocked: boolean,
      lockReason?: string,
    ) => {
      if (
        selectedNode &&
        selectedNode.unitId === unit.unit_id &&
        selectedNode.nodeType === nodeType
      ) {
        closeDetail();
        return;
      }
      showDetail({
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
      });
    },
    [closeDetail, selectedNode, showDetail],
  );

  const handleSelectCheckpoint = useCallback(
    (section: RoadmapSection) => {
      if (
        selectedNode &&
        selectedNode.secId === section.sec_id &&
        selectedNode.nodeType === "checkpoint"
      ) {
        closeDetail();
        return;
      }
      showDetail({
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
      });
    },
    [closeDetail, selectedNode, showDetail],
  );

  const handleSelectComingSoon = useCallback(
    (section: RoadmapSection) => {
      if (
        selectedNode &&
        selectedNode.secId === section.sec_id &&
        selectedNode.nodeType === "coming_soon"
      ) {
        closeDetail();
        return;
      }
      showDetail({
        unitTitle: `${section.sec_title}`,
        secId: section.sec_id,
        secNum: section.sec_num,
        catName: section.cat_name,
        nodeType: "coming_soon",
        isCompleted: false,
        isLocked: true,
        lockReason: "Units under development",
      });
    },
    [closeDetail, selectedNode, showDetail],
  );

  const handleJumpToSection = (secId: number) => {
    hasUserNavigatedSectionsRef.current = true;
    updateActiveSection(secId, true);
    isJumpingRef.current = true;
    alignSectionHeaderWithDetail(secId, true);
    setTimeout(() => {
      isJumpingRef.current = false;
    }, 700);
  };

  return (
    <div className="quiz-page quiz-no-footer-page learn-page">
      <Sidebar role={userRole} username={username} email={email} />
      <main>
        <div className="learn-content">
          <SectionDetailRail
            activeSection={activeSection}
            animateSectionDetail={animateSectionDetail}
            sectionProgress={sectionProgress}
            completedLevels={completedLevels}
            totalLevels={totalLevels}
            upNextUnitTitle={upNextUnit?.unit_title}
            upNextActivity={upNextActivity}
            guestNotice={
              isGuest ? (
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
                    You are exploring as a guest. The first unit is open to preview. Sign in to
                    save your progress, unlock all units, and track your streaks!
                  </p>
                  <Link href="/login" className="guest-rail-login-btn">
                    Sign In to Unlock All
                  </Link>
                </div>
              ) : null
            }
          />

          <div className="roadmap" role="region" aria-label="Curriculum Learning Path">
            {selectedNode && (
              <NodeDetailModal
                modalRef={modalRef}
                selectedNode={selectedNode}
                isDetailClosing={isDetailClosing}
                isGuest={isGuest}
                onClose={closeDetail}
                guestCheckpointSlot={
                  <div className="guest-unit-lock-modal">
                    <p className="guest-unit-lock-desc">
                      Section skip challenges are reserved for registered learners. Sign in to take
                      skip challenges, earn XP, and track your streak!
                    </p>
                    <Link href="/login" className="lesson-link">
                      <p>Sign In to Continue</p>
                    </Link>
                  </div>
                }
                guestLockedUnitSlot={
                  <div className="guest-unit-lock-modal">
                    <p className="guest-unit-lock-desc">
                      Guest preview includes the first unit (Document Structure). Sign in to unlock
                      this unit, earn XP, and track your streak!
                    </p>
                    <Link href="/login" className="lesson-link">
                      <p>Sign In to Continue</p>
                    </Link>
                  </div>
                }
              />
            )}

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

                  {!isGuest && section.sec_id >= 3 && section.is_locked && hasUnits && (
                    <div className="level-path">
                      <div className="level-row path-left">
                        <div className="level-content">
                          <div className="level">
                            <button
                              type="button"
                              className="level-btn checkpoint"
                              onClick={() => handleSelectCheckpoint(section)}
                              aria-label={`Skip Section Checkpoint for ${section.sec_title}`}
                              title={`Skip ahead to ${section.sec_title}`}
                            >
                              <FastForwardIcon />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {hasUnits ? (
                    section.units.map((unit, unitIndex) => (
                      <SectionUnitGroup
                        key={unit.unit_id}
                        unit={unit}
                        unitIndex={unitIndex}
                        section={section}
                        isGuest={isGuest}
                        isStaffUser={isStaffUser}
                        firstUnitId={firstUnitId}
                        onSelectNode={handleSelectNode}
                      />
                    ))
                  ) : (
                    <div className="level-path">
                      <div className="level-row path-left">
                        <div className="level-content">
                          <div className="level">
                            <button
                              type="button"
                              className="level-btn disabled"
                              onClick={() => handleSelectComingSoon(section)}
                              aria-label={`Units coming soon for ${section.sec_title}`}
                              title={`Units coming soon for ${section.sec_title}`}
                            >
                              <FastForwardIcon />
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
