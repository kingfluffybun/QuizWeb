"use client";

import { useState } from "react";
import { deleteUnit, saveUnit } from "../actions/quiz";
import type { Section, UnitRow } from "../actions/quiz";

type LessonUnit = UnitRow;
type LessonCard = { title?: string; content?: string };

interface LessonInputFormProps {
  sections: Section[];
  initialUnits: UnitRow[];
}

const emptyLesson = {
  unit_id: "",
  sec_id: "",
  lesson_title: "",
  lesson_content: "",
};
type LessonForm = typeof emptyLesson;

function getLessonForm(unit: LessonUnit): LessonForm {
  const lesson = (unit.unit_lesson_card_json as LessonCard | null) ?? {};
  return {
    unit_id: String(unit.unit_id),
    sec_id: String(unit.sec_id),
    lesson_title: unit.unit_title ?? lesson.title ?? "",
    lesson_content: lesson.content ?? "",
  };
}

export default function LessonInputForm({
  sections,
  initialUnits,
}: LessonInputFormProps) {
  const [form, setForm] = useState<LessonForm>(emptyLesson);
  const [units, setUnits] = useState<LessonUnit[]>(initialUnits);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, setIsPending] = useState(false);

  const update = (name: keyof LessonForm, value: string) =>
    setForm((current) => ({ ...current, [name]: value }));
  const reset = () => {
    setForm(emptyLesson);
    setMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    try {
      const result = await saveUnit(null, new FormData(event.currentTarget));
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      const unitId = result.unitId ?? Number(form.unit_id);
      const savedUnit: LessonUnit = {
        unit_id: unitId,
        unit_title: form.lesson_title,
        sec_id: Number(form.sec_id),
        unit_lesson_card_json: {
          title: form.lesson_title,
          content: form.lesson_content,
        },
      };
      setUnits((current) => [
        savedUnit,
        ...current.filter((unit) => unit.unit_id !== unitId),
      ]);
      setMessage({
        type: "success",
        text: form.unit_id
          ? "Lesson updated successfully."
          : "Lesson published successfully.",
      });
      reset();
    } catch {
      setMessage({ type: "error", text: "Unable to save this lesson." });
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async (unitId: number) => {
    if (!window.confirm("Delete this lesson? This cannot be undone.")) return;
    setIsPending(true);
    try {
      const result = await deleteUnit(unitId);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setUnits((current) => current.filter((unit) => unit.unit_id !== unitId));
      if (form.unit_id === String(unitId)) reset();
      setMessage({ type: "success", text: "Lesson deleted." });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <section className="unit-editor-card" aria-label="Lesson input">
      <div className="unit-editor-heading">
        <div>
          <p className="unit-kicker">LESSON AUTHORING</p>
          <h2>{form.unit_id ? "Edit lesson" : "Create a lesson"}</h2>
          <p>Add the lesson content learners will read.</p>
        </div>
        <span className="unit-schema-badge">Lesson content</span>
      </div>
      {message && (
        <div
          className={`unit-status unit-status-${message.type}`}
          role="status"
        >
          {message.text}
        </div>
      )}
      <form className="unit-form" onSubmit={handleSubmit}>
        <input type="hidden" name="unit_id" value={form.unit_id} />
        <div className="unit-form-meta">
          <label>
            <span className="unit-field-title">
              Lesson title <b className="required-mark">*</b>
            </span>
            <input
              name="unit_title"
              value={form.lesson_title}
              onChange={(event) => update("lesson_title", event.target.value)}
              placeholder="For example, CSS selectors"
              required
            />
          </label>
          <label>
            <span className="unit-field-title">
              Section <b className="required-mark">*</b>
            </span>
            <select
              name="sec_id"
              value={form.sec_id}
              onChange={(event) => update("sec_id", event.target.value)}
              required
            >
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
            value={form.lesson_content}
            onChange={(event) => update("lesson_content", event.target.value)}
            placeholder="Write the lesson content here..."
            required
          />
        </label>
        <div className="lesson-form-actions">
          <button
            className="unit-submit-button"
            type="submit"
            disabled={isPending}
          >
            {isPending
              ? "Saving..."
              : form.unit_id
                ? "Update lesson"
                : "Publish lesson"}
          </button>
          {form.unit_id && (
            <button
              className="unit-cancel-button"
              type="button"
              onClick={reset}
              disabled={isPending}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
      <div className="unit-list">
        <div className="unit-list-heading">
          <div>
            <p className="unit-kicker">CONTENT LIBRARY</p>
            <h2>Saved lessons</h2>
          </div>
          <span>
            {units.length} {units.length === 1 ? "lesson" : "lessons"}
          </span>
        </div>
        {units.length === 0 ? (
          <p className="unit-empty-state">No lessons yet.</p>
        ) : (
          <div className="unit-record-list">
            {units.map((unit) => {
              const lesson =
                (unit.unit_lesson_card_json as LessonCard | null) ?? {};
              return (
                <article className="unit-record" key={unit.unit_id}>
                  <div>
                    <strong>
                      {unit.unit_title || lesson.title || "Untitled lesson"}
                    </strong>
                    <span>Section {unit.sec_num || unit.sec_id}</span>
                    <p>{lesson.content || "No lesson content"}</p>
                  </div>
                  <div className="unit-record-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setForm(getLessonForm(unit));
                        setMessage(null);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(unit.unit_id)}
                      disabled={isPending}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
