"use client";

import { useState } from "react";
import { deleteUnit, getUnits, saveUnit } from "../actions/quiz";

interface UnitInputFormProps {
  sections: { sec_id: number; sec_num: string }[];
  initialUnits: UnitRecord[];
}

interface UnitRecord {
  unit_id: number;
  sec_id: number;
  sec_num?: string;
  unit_lesson_card_json: { title?: string; content?: string };
  quiz_json: { question?: string; options?: string[]; correct_answer?: string };
  assessment_json: {
    instructions?: string;
    items?: string[];
    passing_score?: number;
  };
}

export default function UnitInputForm({
  sections,
  initialUnits,
}: UnitInputFormProps) {
  const [units, setUnits] = useState(initialUnits);
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [assessmentInstructions, setAssessmentInstructions] = useState("");
  const [assessmentItems, setAssessmentItems] = useState("");
  const [passingScore, setPassingScore] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    if (editingUnitId !== null) formData.set("unit_id", String(editingUnitId));
    const result = await saveUnit(null, formData);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({
        type: "success",
        text:
          editingUnitId === null
            ? "Unit created successfully."
            : "Unit updated successfully.",
      });
      setUnits(await getUnits());
      setEditingUnitId(null);
      setSectionId("");
      setLessonTitle("");
      setLessonContent("");
      setQuizQuestion("");
      setQuizOptions(["", "", "", ""]);
      setCorrectAnswer("");
      setAssessmentInstructions("");
      setAssessmentItems("");
      setPassingScore("");
    }

    setIsPending(false);
  };

  const handleEdit = (unit: UnitRecord) => {
    const lesson = unit.unit_lesson_card_json ?? {};
    const quiz = unit.quiz_json ?? {};
    const assessment = unit.assessment_json ?? {};
    setEditingUnitId(unit.unit_id);
    setSectionId(String(unit.sec_id));
    setLessonTitle(lesson.title ?? "");
    setLessonContent(lesson.content ?? "");
    setQuizQuestion(quiz.question ?? "");
    setQuizOptions([...(quiz.options ?? []), "", "", "", ""].slice(0, 4));
    setCorrectAnswer(quiz.correct_answer ?? "");
    setAssessmentInstructions(assessment.instructions ?? "");
    setAssessmentItems((assessment.items ?? []).join("\n"));
    setPassingScore(assessment.passing_score?.toString() ?? "");
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (unitId: number) => {
    if (!window.confirm(`Delete unit ${unitId}?`)) return;
    setIsPending(true);
    setMessage(null);
    const result = await deleteUnit(unitId);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setUnits(await getUnits());
      setMessage({ type: "success", text: "Unit deleted successfully." });
      if (editingUnitId === unitId) handleCancel();
    }
    setIsPending(false);
  };

  const handleCancel = () => {
    setEditingUnitId(null);
    setSectionId("");
    setLessonTitle("");
    setLessonContent("");
    setQuizQuestion("");
    setQuizOptions(["", "", "", ""]);
    setCorrectAnswer("");
    setAssessmentInstructions("");
    setAssessmentItems("");
    setPassingScore("");
  };

  return (
    <section className="unit-editor-card">
      <div className="unit-editor-heading">
        <div>
          <p className="unit-kicker">UNIT INPUT</p>
          <h2>
            {editingUnitId === null
              ? "Create a Lesson"
              : `Edit Unit ${editingUnitId}`}
          </h2>
        </div>
        <span className="unit-schema-badge">4 input fields</span>
      </div>

      {message && (
        <div className={`unit-status unit-status-${message.type}`}>
          {message.text}
        </div>
      )}

      <form className="unit-form" onSubmit={handleSubmit}>
        <div className="unit-form-meta">
          <label>
            Section ID <span className="required-mark">*</span>
            <select
              name="sec_id"
              required
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value)}
            >
              <option value="" disabled>
                Select a section
              </option>
              {sections.map((section) => (
                <option key={section.sec_id} value={section.sec_id}>
                  {section.sec_num} (ID: {section.sec_id})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="unit-content-grid">
          <label>
            <span className="unit-field-title">Lesson card</span>
            <input
              name="lesson_title"
              required
              value={lessonTitle}
              onChange={(event) => setLessonTitle(event.target.value)}
              placeholder="Lesson title"
            />
            <textarea
              name="lesson_content"
              required
              value={lessonContent}
              onChange={(event) => setLessonContent(event.target.value)}
              placeholder="Explain the lesson..."
            />
          </label>
          <label>
            <span className="unit-field-title">Quiz</span>
            <textarea
              name="quiz_question"
              required
              value={quizQuestion}
              onChange={(event) => setQuizQuestion(event.target.value)}
              placeholder="Quiz question"
            />
            {quizOptions.map((option, index) => (
              <input
                key={index}
                name={`quiz_option_${index}`}
                required
                value={option}
                onChange={(event) =>
                  setQuizOptions((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  )
                }
                placeholder={`Answer option ${index + 1}`}
              />
            ))}
            <input
              name="correct_answer"
              required
              value={correctAnswer}
              onChange={(event) => setCorrectAnswer(event.target.value)}
              placeholder="Correct answer"
            />
          </label>
          <label>
            <span className="unit-field-title">Assessment</span>
            <textarea
              name="assessment_instructions"
              required
              value={assessmentInstructions}
              onChange={(event) =>
                setAssessmentInstructions(event.target.value)
              }
              placeholder="Assessment instructions"
            />
            <textarea
              name="assessment_items"
              required
              value={assessmentItems}
              onChange={(event) => setAssessmentItems(event.target.value)}
              placeholder="Assessment items, one per line"
            />
            <input
              name="passing_score"
              type="number"
              min="0"
              max="100"
              required
              value={passingScore}
              onChange={(event) => setPassingScore(event.target.value)}
              placeholder="Passing score (%)"
            />
          </label>
        </div>

        <button
          className="unit-submit-button"
          type="submit"
          disabled={isPending}
        >
          {isPending
            ? "Saving unit..."
            : editingUnitId === null
              ? "Create unit"
              : "Update unit"}
        </button>
        {editingUnitId !== null && (
          <button
            className="unit-cancel-button"
            type="button"
            onClick={handleCancel}
            disabled={isPending}
          >
            Cancel
          </button>
        )}
      </form>

      <div className="unit-list">
        <div className="unit-list-heading">
          <div>
            <p className="unit-kicker">UNIT TABLE</p>
            <h2>Saved units</h2>
          </div>
          <span>
            {units.length} {units.length === 1 ? "unit" : "units"}
          </span>
        </div>
        {units.length === 0 ? (
          <p className="unit-empty-state">No units have been created yet.</p>
        ) : (
          <div className="unit-record-list">
            {units.map((unit) => (
              <article className="unit-record" key={unit.unit_id}>
                <div>
                  <strong>Unit {unit.unit_id}</strong>
                  <span>Section {unit.sec_num ?? unit.sec_id}</span>
                  <p>
                    {unit.unit_lesson_card_json?.title ?? "Untitled lesson"}
                  </p>
                </div>
                <div className="unit-record-actions">
                  <button
                    type="button"
                    onClick={() => handleEdit(unit)}
                    disabled={isPending}
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
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
