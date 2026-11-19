"use client";

import { useState } from "react";
import {
  cheatSheetSections,
  difficultyLevels,
  getCodeLanguage,
  levelNames,
  type CheatSheetSection,
  type CheatSheetUnit,
  type LevelName,
} from "@/lib/cheat-sheet-data";
import StaticCodeBlock from "./StaticCodeBlock";

function UnitCard({ unit, sectionTitle }: { unit: CheatSheetUnit; sectionTitle: string }) {
  return (
    <article className="cheatsheet-card">
      <h3>{unit.title}</h3>
      <p>{unit.description}</p>
      <ul className="cheatsheet-topics" aria-label={`${unit.title} topics`}>
        {unit.topics.map((topic) => (
          <li key={topic}>{topic}</li>
        ))}
      </ul>
      <StaticCodeBlock
        title={unit.title}
        language={getCodeLanguage(sectionTitle)}
        code={unit.example}
      />
    </article>
  );
}

function CurriculumSection({
  section,
  searchTerm,
}: {
  section: CheatSheetSection;
  searchTerm: string;
}) {
  const title = searchTerm ? section.title.replace(/^(HTML|CSS|JavaScript) /, "") : section.title;

  return (
    <section className="cheatsheet-section" id={section.id} aria-labelledby={`${section.id}-title`}>
      <div className="cheatsheet-section-heading">
        <h2 id={`${section.id}-title`}>{title}</h2>
      </div>
      <div className="cheatsheet-card-grid">
        {section.units.map((unit) => (
          <UnitCard key={unit.title} unit={unit} sectionTitle={section.title} />
        ))}
      </div>
    </section>
  );
}

export default function CheatSheetClient() {
  const [activeLevel, setActiveLevel] = useState<LevelName>("All");
  const [unitSearch, setUnitSearch] = useState("");

  const searchTerm = unitSearch.trim().toLowerCase();
  const matchingSections = searchTerm
    ? cheatSheetSections
        .map((section) => ({
          ...section,
          units: section.units.filter((unit) => unit.title.toLowerCase().includes(searchTerm)),
        }))
        .filter((section) => section.units.length > 0)
    : cheatSheetSections.filter((section) => activeLevel === "All" || section.level === activeLevel);

  const visibleLevelGroups =
    searchTerm || activeLevel === "All"
      ? difficultyLevels
          .map((level) => ({
            name: level,
            sections: matchingSections.filter((section) => section.level === level),
          }))
          .filter((group) => group.sections.length > 0)
      : [{ name: activeLevel, sections: matchingSections }];

  const visibleSections = visibleLevelGroups.flatMap((group) => group.sections);
  const visibleUnitCount = visibleSections.reduce(
    (total, section) => total + section.units.length,
    0,
  );

  return (
    <div className="cheatsheet-content">
      <header className="cheatsheet-heading">
        <h1>Cheat Sheet</h1>
        <p>Browse lessons and examples by difficulty.</p>
      </header>

      <div className="cheatsheet-toolbar">
        <nav className="cheatsheet-level-tabs" aria-label="Choose a difficulty">
          {levelNames.map((level) => (
            <button
              type="button"
              className="cheatsheet-level-tab"
              aria-pressed={activeLevel === level}
              key={level}
              onClick={() => setActiveLevel(level)}
            >
              {level}
            </button>
          ))}
        </nav>

        <label className="cheatsheet-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            type="search"
            value={unitSearch}
            onChange={(event) => setUnitSearch(event.target.value)}
            placeholder="Search units..."
            aria-label="Search unit names across all difficulty levels"
          />
        </label>
      </div>

      <section className="cheatsheet-level" aria-labelledby="cheatsheet-active-level">
        <header className="cheatsheet-level-heading">
          <h2 id="cheatsheet-active-level">{searchTerm ? "Search results" : activeLevel}</h2>
          <span>
            {searchTerm
              ? `${visibleUnitCount} ${visibleUnitCount === 1 ? "unit" : "units"}`
              : `${visibleSections.length} ${visibleSections.length === 1 ? "section" : "sections"}`}
          </span>
        </header>

        {visibleSections.length > 0 ? (
          <div className={searchTerm ? "cheatsheet-search-groups" : "cheatsheet-sections"}>
            {visibleLevelGroups.map((group) => (
              <div
                className={`cheatsheet-search-group${searchTerm ? " is-search-result-group" : ""}`}
                key={group.name}
              >
                {(searchTerm || activeLevel === "All") && (
                  <header
                    className={`cheatsheet-search-group-heading${activeLevel === "All" && !searchTerm ? " is-all-level-heading" : ""}`}
                  >
                    <h3>{group.name}</h3>
                  </header>
                )}
                {!searchTerm && (
                  <nav className="cheatsheet-navigation" aria-label={`${group.name} sections`}>
                    {group.sections.map((section) => (
                      <a href={`#${section.id}`} key={section.id}>
                        {section.title}
                      </a>
                    ))}
                  </nav>
                )}
                <div className="cheatsheet-sections">
                  {group.sections.map((section) => (
                    <CurriculumSection
                      key={section.id}
                      section={section}
                      searchTerm={searchTerm}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="cheatsheet-no-results" role="status">
            No unit names match &ldquo;{unitSearch}&rdquo; in the curriculum.
          </p>
        )}
      </section>
    </div>
  );
}
