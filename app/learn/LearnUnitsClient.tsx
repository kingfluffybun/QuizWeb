"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AvailableUnit } from "@/app/actions/quiz";
import { getCanonicalSortOrder } from "@/lib/curriculum";
import Sidebar from "@/app/components/Sidebar";
import "#css/quiz.css";
import "#css/nav.css";
import "#css/sidebar.css";

export default function LearnUnitsClient({ units }: { units: AvailableUnit[] }) {
    const [selectedSection, setSelectedSection] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");

    const visibleUnits = useMemo(() => {
        return units.filter((u) => !u.is_locked);
    }, [units]);

    const sections = useMemo(() => {
        const unique = Array.from(
            new Set(
                visibleUnits
                    .map((u) => (u.sec_num != null ? String(u.sec_num).trim() : ""))
                    .filter((s): s is string => Boolean(s)),
            ),
        );
        return unique.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
    }, [visibleUnits]);

    const filteredUnits = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const compareNumbers = (a?: string | number | null, b?: string | number | null) => {
            const aNumber = Number(a);
            const bNumber = Number(b);
            const aIsNumber = a != null && a !== "" && Number.isFinite(aNumber);
            const bIsNumber = b != null && b !== "" && Number.isFinite(bNumber);

            if (aIsNumber && bIsNumber) return aNumber - bNumber;
            if (aIsNumber) return -1;
            if (bIsNumber) return 1;
            return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
                numeric: true,
                sensitivity: "base",
            });
        };

        return visibleUnits
            .filter((unit) => {
                const unitSec = unit.sec_num != null ? String(unit.sec_num).trim() : "";
                const matchesSection =
                    selectedSection === "all" || unitSec === selectedSection;
                const matchesSearch =
                    !q ||
                    unit.unit_title.toLowerCase().includes(q) ||
                    (unitSec ? `section ${unitSec}`.toLowerCase().includes(q) : false);
                return matchesSection && matchesSearch;
            })
            .sort((a, b) => {
                const orderA = getCanonicalSortOrder(a.sec_id ?? 0, a.unit_order ?? 1);
                const orderB = getCanonicalSortOrder(b.sec_id ?? 0, b.unit_order ?? 1);
                if (orderA !== orderB) return orderA - orderB;

                return (
                    compareNumbers(a.sec_num, b.sec_num) ||
                    compareNumbers(a.unit_order, b.unit_order) ||
                    compareNumbers(a.unit_number, b.unit_number) ||
                    a.unit_title.localeCompare(b.unit_title, undefined, {
                        numeric: true,
                        sensitivity: "base",
                    })
                );
            });
    }, [visibleUnits, selectedSection, searchQuery]);

    return (
        <div className="quiz-page quiz-no-footer-page learn-page">
            <Sidebar />
            <main>
                <section className="available-units" aria-labelledby="available-units-title">
                    <div className="available-units-heading">
                        <div>
                            <h2 id="available-units-title">Available Units</h2>
                            <p>Choose a unit to study its lesson and take its quiz.</p>
                        </div>
                        {visibleUnits.length > 0 && (
                            <div className="learn-filters-bar">
                                <input
                                    type="search"
                                    className="learn-search-input"
                                    placeholder="Search units..."
                                    aria-label="Search units"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {sections.length > 1 && (
                                    <div className="learn-section-chips" role="tablist" aria-label="Filter by section">
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={selectedSection === "all"}
                                            className={`learn-chip${selectedSection === "all" ? " active" : ""}`}
                                            onClick={() => setSelectedSection("all")}
                                        >
                                            All ({visibleUnits.length})
                                        </button>
                                        {sections.map((sec) => (
                                            <button
                                                key={sec}
                                                type="button"
                                                role="tab"
                                                aria-selected={selectedSection === sec}
                                                className={`learn-chip${selectedSection === sec ? " active" : ""}`}
                                                onClick={() => setSelectedSection(sec)}
                                            >
                                                Section {sec}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {filteredUnits.length > 0 ? (
                        <div className="available-units-list">
                            {filteredUnits.map((unit) => {
                                const isLocked = Boolean(unit.is_locked);
                                const isCompleted = Boolean(unit.is_completed);

                                return (
                                    <article
                                        className={`available-unit-card${isLocked ? " is-locked" : ""}`}
                                        key={unit.unit_id}
                                        style={isLocked ? { opacity: 0.65 } : undefined}
                                    >
                                        <div className="available-unit-info">
                                            <h3>{unit.unit_title}</h3>
                                            <div className="available-unit-badges">
                                                {unit.sec_num && (
                                                    <span className="available-unit-badge badge-section">
                                                        Section {unit.sec_num}
                                                    </span>
                                                )}
                                                <span className="available-unit-badge badge-questions">
                                                    {unit.quiz_count} {unit.quiz_count === 1 ? "question" : "questions"}
                                                </span>
                                                {unit.has_coding_assessment && (
                                                    <span className="available-unit-badge badge-coding">
                                                        Coding Assessment
                                                    </span>
                                                )}
                                                {isLocked && (
                                                    <span
                                                        className="available-unit-badge"
                                                        style={{
                                                            backgroundColor: "rgba(100, 116, 139, 0.16)",
                                                            color: "var(--text-muted)",
                                                        }}
                                                    >
                                                        🔒 Locked
                                                    </span>
                                                )}
                                                {isCompleted && (
                                                    <span
                                                        className="available-unit-badge"
                                                        style={{
                                                            backgroundColor: "rgba(16, 185, 129, 0.16)",
                                                            color: "#059669",
                                                        }}
                                                    >
                                                        ✓ Completed
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="available-unit-actions">
                                            {isLocked ? (
                                                <button
                                                    type="button"
                                                    disabled
                                                    className="available-unit-link is-locked"
                                                    style={{
                                                        opacity: 0.5,
                                                        cursor: "not-allowed",
                                                        pointerEvents: "none",
                                                        borderBottomWidth: "3px",
                                                    }}
                                                >
                                                    Locked
                                                </button>
                                            ) : (
                                                <Link
                                                    href={`/quiz?unitId=${unit.pending_id}&source=quiz`}
                                                    className="available-unit-link"
                                                >
                                                    {isCompleted
                                                        ? "Review"
                                                        : unit.quiz_count > 0
                                                          ? "Start unit"
                                                          : "Start Lesson"}
                                                </Link>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="available-units-empty">
                            {units.length > 0
                                ? "No units match your current filter."
                                : "No approved units are available yet."}
                        </p>
                    )}
                </section>
            </main>
        </div>
    );
}
