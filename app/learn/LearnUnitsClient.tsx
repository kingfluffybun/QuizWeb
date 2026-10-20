"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AvailableUnit } from "@/app/actions/quiz";
import Sidebar from "@/app/components/Sidebar";
import "#css/quiz.css";
import "#css/nav.css";
import "#css/sidebar.css";

export default function LearnUnitsClient({ units }: { units: AvailableUnit[] }) {
    const [selectedSection, setSelectedSection] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");

    const sections = useMemo(() => {
        const unique = Array.from(
            new Set(
                units
                    .map((u) => u.sec_num)
                    .filter((s): s is string => Boolean(s && s.trim())),
            ),
        );
        return unique.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
    }, [units]);

    const filteredUnits = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return units.filter((unit) => {
            const matchesSection =
                selectedSection === "all" || unit.sec_num === selectedSection;
            const matchesSearch =
                !q ||
                unit.unit_title.toLowerCase().includes(q) ||
                (unit.sec_num ? `section ${unit.sec_num}`.includes(q) : false);
            return matchesSection && matchesSearch;
        });
    }, [units, selectedSection, searchQuery]);

    return (
        <div className="quiz-page learn-page">
            <Sidebar />
            <main>
                <section className="available-units" aria-labelledby="available-units-title">
                    <div className="available-units-heading">
                        <div>
                            <h2 id="available-units-title">Available Units</h2>
                            <p>Choose a unit to study its lesson and take its quiz.</p>
                        </div>
                        {units.length > 0 && (
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
                                            All ({units.length})
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
                            {filteredUnits.map((unit) => (
                                <article className="available-unit-card" key={unit.unit_id}>
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
                                        </div>
                                    </div>
                                    <div className="available-unit-actions">
                                        {unit.has_coding_assessment && (
                                            <Link
                                                href={`/quiz-cp?unitId=${unit.pending_id}`}
                                                className="available-unit-cp-link"
                                            >
                                                Code Problem
                                            </Link>
                                        )}
                                        <Link
                                            href={`/quiz?unitId=${unit.pending_id}&source=quiz`}
                                            className="available-unit-link"
                                        >
                                            {unit.quiz_count > 0 ? "Start unit" : "Start Lesson"}
                                        </Link>
                                    </div>
                                </article>
                            ))}
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

