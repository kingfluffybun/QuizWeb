"use client";

import type { StatusMessage } from "../types";

interface ImportJsonTabProps {
  isEditingPendingUnit: boolean;
  importJsonText: string;
  setImportJsonText: (val: string) => void;
  importJsonMessage: StatusMessage | null;
  setImportJsonMessage: (msg: StatusMessage | null) => void;
  isSubmitting: boolean;
  onExportUnitJson: (target: "clipboard" | "editor") => Promise<void>;
  onApplyImportJson: () => void;
  onReviewLesson: () => void;
  onReviewAssessment: () => void;
}

const EXISTING_UNIT_PLACEHOLDER = `{
  "unit_assessment_json": {
    "schemaVersion": 2,
    "title": "Assessment title",
    "description": "Assessment description",
    "steps": [{
      "stepNumber": 1,
      "instruction": "Describe the task",
      "starterCode": { "html": "", "css": "", "js": "" },
      "expectedTemplate": { "html": "<h1>####</h1>", "css": "", "js": "" },
      "inheritPreviousCode": false
    }],
    "expected_outcome": "<h1>Example</h1>"
  }
}`;

const NEW_UNIT_PLACEHOLDER = `{
  "unit_title": "Document Structure",
  "sec_id": 1,
  "unit_lesson_card_json": {
    "lesson_title": "Document Structure",
    "lesson_slide": [
      {
        "lesson_title": "Basic HTML Skeletons",
        "lesson_text": "In this lesson, you will learn the fundamental elements of HTML.",
        "lesson_code": "<!DOCTYPE html>\\n<html>\\n<head>\\n<title>Page</title>\\n</head>\\n<body>\\n</body>\\n</html>"
      }
    ]
  },
  "unit_assessment_json": {
    "schemaVersion": 2,
    "title": "Unit 1 Assessment",
    "description": "Build an HTML page",
    "steps": [{
      "stepNumber": 1,
      "instruction": "Add the DOCTYPE declaration",
      "starterCode": { "html": "", "css": "", "js": "" },
      "expectedTemplate": { "html": "<!doctype html>", "css": "", "js": "" },
      "inheritPreviousCode": false
    }],
    "expected_outcome": "<!doctype html>\\n<html>\\n<head>\\n<title></title>\\n</head>\\n<body></body>\\n</html>"
  },
  "unit_quiz_json": [{
    "cat_id": 1,
    "sec_id": 1,
    "difficulty_id": 1,
    "quiz_type_id": 1,
    "question_text": "Which line comes first at the very top of an HTML page?",
    "quiz_payload": {
      "options": ["<!DOCTYPE html>", "<html>", "<head>", "<body>"],
      "correct_index": 0
    }
  }]
}`;

export default function ImportJsonTab({
  isEditingPendingUnit,
  importJsonText,
  setImportJsonText,
  importJsonMessage,
  setImportJsonMessage,
  isSubmitting,
  onExportUnitJson,
  onApplyImportJson,
  onReviewLesson,
  onReviewAssessment,
}: ImportJsonTabProps) {
  return (
    <div className="form-group">
      <h3>Import JSON</h3>
      <p>
        {isEditingPendingUnit ? (
          <>
            Click <strong>Export Current Unit</strong> to load this whole unit (title, section, lesson slides, quizzes and assessment) as JSON, edit it, then <strong>Validate &amp; Load</strong> to apply it to this unit. Saving replaces the unit&apos;s content in place. JSON containing only <code>unit_assessment_json</code> replaces just the assessment and keeps the existing quiz questions unchanged.
          </>
        ) : (
          <>
            For a new unit, include both <code>unit_assessment_json</code> and <code>unit_quiz_json</code>. Both will load into the form for review and editing before submission.
          </>
        )}
      </p>
      <textarea
        aria-label="Import assessment JSON"
        className="form-textarea"
        rows={18}
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "0.86rem",
        }}
        value={importJsonText}
        onChange={(event) => {
          setImportJsonText(event.target.value);
          setImportJsonMessage(null);
        }}
        placeholder={isEditingPendingUnit ? EXISTING_UNIT_PLACEHOLDER : NEW_UNIT_PLACEHOLDER}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px",
          marginTop: "10px",
        }}
      >
        {isEditingPendingUnit && (
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void onExportUnitJson("editor")}
            >
              Export Current Unit
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void onExportUnitJson("clipboard")}
            >
              Copy Unit JSON
            </button>
          </>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={onApplyImportJson}
        >
          Validate &amp; Load
        </button>
      </div>
      {importJsonMessage && (
        <div
          className={`status-message status-${importJsonMessage.type}`}
          role={importJsonMessage.type === "error" ? "alert" : "status"}
        >
          {importJsonMessage.text}
          {importJsonMessage.type === "success" && (
            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={onReviewLesson}
              >
                Review Lesson
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={onReviewAssessment}
              >
                Review Assessment
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting Unit..." : "Submit Unit for Review"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
