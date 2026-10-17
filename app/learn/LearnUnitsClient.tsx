"use client";

import Link from "next/link";
import type { AvailableUnit } from "@/app/actions/quiz";
import Sidebar from "@/app/components/Sidebar";
import "#css/quiz.css";
import "#css/nav.css";
import "#css/sidebar.css";

export default function LearnUnitsClient({ units }: { units: AvailableUnit[] }) {
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
                    </div>
                    {units.length > 0 ? (
                        <div className="available-units-list">
                            {units.map((unit) => (
                                <article className="available-unit-card" key={unit.unit_id}>
                                    <div>
                                        <h3>{unit.unit_title}</h3>
                                        <p>
                                            {unit.sec_num ? `Section ${unit.sec_num} · ` : ""}
                                            {unit.quiz_count} {unit.quiz_count === 1 ? "question" : "questions"}
                                        </p>
                                    </div>
                                    <Link
                                        href={`/quiz?unitId=${unit.pending_id}&source=quiz`}
                                        className="available-unit-link"
                                    >
                                        {unit.quiz_count > 0 ? "Start unit" : "Start Lesson"}
                                    </Link>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <p className="available-units-empty">No approved units are available yet.</p>
                    )}
                </section>
            </main>
        </div>
    );
}
