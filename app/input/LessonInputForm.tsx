"use client";

import type { Section } from "../actions/quiz";

interface LessonInputFormProps {
  sections: Section[];
  embedded?: boolean;
}

export default function LessonInputForm({
  sections,
  embedded = false,
}: LessonInputFormProps) {
  return (
    <section
      className={
        embedded
          ? "unit-editor-card unit-editor-card-embedded"
          : "unit-editor-card"
      }
      aria-label="Lesson input"
    >
      <div className="unit-editor-heading">
        <div>
          <h2>Create a lesson</h2>
          <p>Add the lesson content learners will read.</p>
        </div>
        <span className="unit-schema-badge">Lesson content</span>
      </div>
      <div className="unit-form">
        <input type="hidden" name="unit_id" value="" />
        <div className="unit-form-meta">
          <label>
            <span className="unit-field-title">
              Lesson title <b className="required-mark">*</b>
            </span>
            <input
              name="unit_title"
              placeholder="For example, CSS selectors"
              required
            />
          </label>
          <label>
            <span className="unit-field-title">
              Section <b className="required-mark">*</b>
            </span>
            <select name="unit_sec_id" required>
              <option value="" disabled>
                Select a section
              </option>
              {sections.map((section) => (
                <option key={section.sec_id} value={section.sec_id}>
                  {section.sec_num}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span className="unit-field-title">
            Lesson content <b className="required-mark">*</b>
          </span>
          <textarea
            name="lesson_content"
            placeholder="Write the lesson content here..."
            required
          />
        </label>
      </div>
    </section>
  );
}
