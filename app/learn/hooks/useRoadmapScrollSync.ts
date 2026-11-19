"use client";

import { useEffect, type RefObject } from "react";
import type { RoadmapSection } from "@/app/actions/curriculum-roadmap";
import type { SelectedRoadmapNode } from "@/lib/roadmap-progress";

export function alignSectionHeaderWithDetail(sectionId: number, smooth = false) {
  const scrollContainer = document.querySelector<HTMLElement>(".learn-page > main");
  const sectionHeader = document.querySelector<HTMLElement>(
    `.section-header[data-section-id="${sectionId}"]`,
  );
  const sectionDetailRail = document.querySelector<HTMLElement>(".section-detail-rail");
  if (!scrollContainer || !sectionHeader || !sectionDetailRail) return;

  const scrollDelta =
    sectionHeader.getBoundingClientRect().top - sectionDetailRail.getBoundingClientRect().top;
  const scrollTop = scrollContainer.scrollTop + scrollDelta;

  if (smooth) {
    scrollContainer.scrollTo({ top: scrollTop, behavior: "smooth" });
  } else {
    scrollContainer.scrollTop = scrollTop;
  }
}

interface UseRoadmapScrollSyncParams {
  sections: RoadmapSection[];
  initialSectionIdRef: RefObject<number>;
  isJumpingRef: RefObject<boolean>;
  hasUserNavigatedSectionsRef: RefObject<boolean>;
  modalRef: RefObject<HTMLDivElement | null>;
  selectedNode: SelectedRoadmapNode | null;
  updateActiveSection: (secId: number, animate?: boolean) => void;
  closeDetail: () => void;
  onComputeActiveSectionOnScroll: (sectionElements: NodeListOf<HTMLElement>) => void;
}

export function useRoadmapScrollSync({
  sections,
  initialSectionIdRef,
  isJumpingRef,
  hasUserNavigatedSectionsRef,
  modalRef,
  selectedNode,
  updateActiveSection,
  closeDetail,
  onComputeActiveSectionOnScroll,
}: UseRoadmapScrollSyncParams) {
  useEffect(() => {
    isJumpingRef.current = true;
    alignSectionHeaderWithDetail(initialSectionIdRef.current);

    const timeoutId = window.setTimeout(() => {
      isJumpingRef.current = false;
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, [initialSectionIdRef, isJumpingRef]);

  useEffect(() => {
    const sectionElements = document.querySelectorAll<HTMLElement>(
      "section.curriculum-section[data-section-id]",
    );
    if (sectionElements.length === 0) return;

    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => onComputeActiveSectionOnScroll(sectionElements));
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (isJumpingRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const secId = Number(entry.target.getAttribute("data-section-id"));
            if (Number.isFinite(secId) && secId > 0) {
              updateActiveSection(secId);
            }
          }
        }
      },
      {
        rootMargin: "-15% 0px -65% 0px",
        threshold: 0,
      },
    );

    document
      .querySelectorAll<HTMLElement>(".section-header[data-section-id]")
      .forEach((header) => observer.observe(header));

    window.addEventListener("scroll", handleScroll, { passive: true });
    const markSectionNavigationIntent = () => {
      hasUserNavigatedSectionsRef.current = true;
    };
    const markKeyboardNavigationIntent = (event: KeyboardEvent) => {
      if (
        ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)
      ) {
        markSectionNavigationIntent();
      }
    };
    window.addEventListener("wheel", markSectionNavigationIntent, { passive: true });
    window.addEventListener("touchmove", markSectionNavigationIntent, { passive: true });
    window.addEventListener("keydown", markKeyboardNavigationIntent);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", markSectionNavigationIntent);
      window.removeEventListener("touchmove", markSectionNavigationIntent);
      window.removeEventListener("keydown", markKeyboardNavigationIntent);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [
    sections,
    isJumpingRef,
    hasUserNavigatedSectionsRef,
    updateActiveSection,
    onComputeActiveSectionOnScroll,
  ]);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        modalRef.current &&
        !modalRef.current.contains(target) &&
        !target.closest(".level-btn")
      ) {
        closeDetail();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDetail();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDetail, modalRef]);

  useEffect(() => {
    if (!selectedNode) return;

    const scrollContainer = document.querySelector<HTMLElement>(".learn-page > main");
    if (!scrollContainer) return;

    const openedAtScrollTop = scrollContainer.scrollTop;
    const closeAfterScrollDown = () => {
      if (scrollContainer.scrollTop - openedAtScrollTop >= 80) {
        closeDetail();
      }
    };

    scrollContainer.addEventListener("scroll", closeAfterScrollDown, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", closeAfterScrollDown);
  }, [closeDetail, selectedNode]);
}
