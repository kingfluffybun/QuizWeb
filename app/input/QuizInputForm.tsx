"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import AssessmentStepBuilder from "./AssessmentStepBuilder";
import UnitMetadataTab from "./components/UnitMetadataTab";
import LessonSlidesTab from "./components/LessonSlidesTab";
import QuizQuestionTab from "./components/QuizQuestionTab";
import ImportJsonTab from "./components/ImportJsonTab";
import LivePreviewPane from "./components/LivePreviewPane";
import RecentUnitsList from "./components/RecentUnitsList";
import { useRecentUnitsList } from "./hooks/useRecentUnitsList";
import { useUnitAuthoringState } from "./hooks/useUnitAuthoringState";
import { useStudioEvents } from "./hooks/useStudioEvents";
import type {
  EditingQuizItem,
  QuizInputFormProps,
  QuizPayload,
  RecentQuizItem,
  SavedLessonSlide,
} from "./types";

export type {
  EditingQuizItem,
  QuizInputFormProps,
  QuizPayload,
  RecentQuizItem,
  SavedLessonSlide,
};

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: "250px", width: "100%", background: "#1e1e1e" }}
      className="animate-pulse flex items-center justify-center text-neutral-400 text-xs"
    >
      Loading code editor...
    </div>
  ),
});

export default function QuizInputForm({
  categories,
  difficulties,
  types,
  sections = [],
  initialRecentUnits,
  initialPage,
  initialTotalPages,
  initialTotalCount,
  showRecentQuizzes = true,
  initialEditingQuiz,
}: QuizInputFormProps) {
  const suppressNextPendingEventRef = useRef(false);

  const listState = useRecentUnitsList({
    categories,
    sections,
    initialRecentUnits,
    initialPage,
    initialTotalPages,
    initialTotalCount,
    showRecentUnits: showRecentQuizzes,
  });

  const formState = useUnitAuthoringState({
    categories,
    difficulties,
    types,
    sections,
    initialEditingQuiz,
    currentPage: listState.currentPage,
    loadUnitPage: listState.loadUnitPage,
    suppressNextPendingEventRef,
  });

  useStudioEvents({
    initialEditingQuiz,
    showRecentUnits: showRecentQuizzes,
    suppressNextPendingEventRef,
    onReloadList: () => listState.loadUnitPage(1),
    onLoadedPendingUnit: formState.handleEdit,
    onStudioLaunch: formState.handleStudioLaunch,
    onError: formState.setMessage,
  });

  const isBusy = formState.isSubmitting || listState.isLoadingList;

  return (
    <>
      {!formState.mobileNoticeDismissed && (
        <div className="staff-mobile-notice input-only-mobile-notice" role="status">
          <div className="staff-mobile-notice-body">
            <strong>Best experienced on Desktop</strong>
            <span>
              Multi-step code template authoring and side-by-side live previews are optimized for desktop screens.
            </span>
          </div>
          <button
            type="button"
            className="staff-mobile-notice-dismiss"
            onClick={() => formState.setMobileNoticeDismissed(true)}
            aria-label="Dismiss desktop recommendation notice"
          >
            ✕
          </button>
        </div>
      )}

      <div className="unit-preview-workspace">
        {/* Form Section */}
        <div id="quiz-form" className="admin-card unit-authoring-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: formState.editingQuiz ? "10px" : "0",
            }}
          >
            <h2 style={{ marginBottom: 0 }}>
              {formState.editingQuiz
                ? formState.editingQuiz._pendingUnit
                  ? `Edit ${formState.editingQuiz.pending_status === "approved" || formState.editingQuiz.difficulty_name === "approved" ? "Approved " : ""}Unit (ID: #${formState.editingQuiz.pending_id})`
                  : formState.editingQuiz._queuedUnitQuiz
                    ? `Unit Quiz ${formState.currentPendingQuizIndex + 1} of ${formState.queuedQuizzes.length + 1}`
                    : `Edit Quiz Question (ID: #${formState.editingQuiz.quiz_id ?? formState.editingQuiz.pending_id})`
                : "Create New Unit"}
            </h2>
            {formState.editingQuiz && !formState.editingQuiz._queuedUnitQuiz && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {formState.editingQuiz._pendingUnit && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void formState.handleExportUnitJson("clipboard")}
                    disabled={isBusy}
                    style={{ padding: "6px 12px", fontSize: "0.82rem" }}
                    title="Copy this whole unit as import JSON"
                  >
                    Copy Unit JSON
                  </button>
                )}
                <button
                  type="button"
                  className="btn-delete"
                  onClick={formState.handleCancelEdit}
                  disabled={isBusy}
                  style={{ padding: "6px 12px", fontSize: "0.82rem" }}
                >
                  Discard &amp; New Unit
                </button>
              </div>
            )}
          </div>

          {formState.editingQuiz && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "rgba(37, 99, 235, 0.08)",
                border: "1.5px solid rgba(37, 99, 235, 0.3)",
                fontSize: "0.84rem",
              }}
            >
              <span>
                <strong>Active Edit Session:</strong>{" "}
                {formState.unitTitle ||
                  formState.editingQuiz.question_text ||
                  `Submission #${formState.editingQuiz.pending_id ?? formState.editingQuiz.quiz_id}`}{" "}
                {formState.editingQuiz.pending_status && (
                  <span
                    style={{
                      marginLeft: "6px",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      background: "rgba(37, 99, 235, 0.16)",
                    }}
                  >
                    {formState.editingQuiz.pending_status}
                  </span>
                )}
              </span>
              <span style={{ opacity: 0.8, fontSize: "0.78rem" }}>
                Save changes below to update &amp; resubmit
              </span>
            </div>
          )}

          {/* Controlled inputs preserve Monaco Editor across Quiz Next/Prev navigation */}
          <form id="unit-form" onSubmit={formState.handleSubmit} noValidate>
            <input
              type="hidden"
              name="quiz_json"
              value={JSON.stringify(formState.queuedQuizzes)}
            />
            {formState.message && (
              <div
                className={`status-message status-${formState.message.type}`}
                role={formState.message.type === "error" ? "alert" : "status"}
              >
                {formState.message.text}
              </div>
            )}

            <div
              className="preview-tabs unit-input-tabs"
              role="group"
              aria-label="Unit input section"
            >
              <button
                type="button"
                className={`preview-tab${formState.unitInputTab === "unit" ? " active" : ""}`}
                aria-pressed={formState.unitInputTab === "unit"}
                onClick={() => formState.setUnitInputTab("unit")}
              >
                Unit
              </button>
              <button
                type="button"
                className={`preview-tab${formState.unitInputTab === "lesson" ? " active" : ""}`}
                aria-pressed={formState.unitInputTab === "lesson"}
                onClick={() => {
                  formState.setUnitInputTab("lesson");
                  formState.setPreviewTab("lesson");
                }}
              >
                Lesson ({formState.lessonSlides.length} slide
                {formState.lessonSlides.length === 1 ? "" : "s"})
              </button>
              <button
                type="button"
                className={`preview-tab${formState.unitInputTab === "quiz" ? " active" : ""}`}
                aria-pressed={formState.unitInputTab === "quiz"}
                onClick={() => formState.setUnitInputTab("quiz")}
              >
                Quiz ({formState.queuedQuizzes.length + 1} question
                {formState.queuedQuizzes.length === 0 ? "" : "s"})
              </button>
              <button
                type="button"
                className={`preview-tab${formState.unitInputTab === "assessment" ? " active" : ""}`}
                aria-pressed={formState.unitInputTab === "assessment"}
                onClick={() => {
                  formState.setUnitInputTab("assessment");
                  formState.setPreviewTab("assessment");
                }}
              >
                Assessment ({formState.cpSteps.length} step
                {formState.cpSteps.length === 1 ? "" : "s"})
              </button>
              <button
                type="button"
                className={`preview-tab${formState.unitInputTab === "import" ? " active" : ""}`}
                aria-pressed={formState.unitInputTab === "import"}
                onClick={() => formState.setUnitInputTab("import")}
              >
                Import JSON
              </button>
            </div>

            <div hidden={formState.unitInputTab !== "unit"}>
              <UnitMetadataTab
                unitTitle={formState.unitTitle}
                onUnitTitleChange={formState.setUnitTitle}
                selectedCatId={formState.selectedCatId}
                onCategoryChange={formState.setSelectedCatId}
                selectedSecId={formState.selectedSecId}
                onSectionChange={formState.handleSelectSection}
                selectedUnit={formState.selectedUnit}
                onUnitOrderChange={formState.setSelectedUnit}
                categories={categories}
                sections={sections}
              />
            </div>

            <div hidden={formState.unitInputTab !== "lesson"}>
              <LessonSlidesTab
                renderCodeEditor={({ value, onChange, ariaLabel }) => (
                  <Editor
                    height="250px"
                    language="html"
                    theme="vs-dark"
                    value={value}
                    onChange={(nextValue) => onChange(nextValue ?? "")}
                    options={{
                      automaticLayout: true,
                      fontSize: 13,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      ariaLabel,
                    }}
                  />
                )}
                lessonSlides={formState.lessonSlides}
                setLessonSlides={formState.setLessonSlides}
                currentLessonSlide={formState.currentLessonSlide}
                setCurrentLessonSlide={formState.setCurrentLessonSlide}
                lessonEditorView={formState.lessonEditorView}
                setLessonEditorView={formState.setLessonEditorView}
                onMessage={formState.setMessage}
              />
            </div>

            <div hidden={formState.unitInputTab !== "quiz"}>
              <QuizQuestionTab
                difficulties={difficulties}
                types={types}
                selectedDiffId={formState.selectedDiffId}
                setSelectedDiffId={formState.setSelectedDiffId}
                selectedTypeId={formState.selectedTypeId}
                setSelectedTypeId={formState.setSelectedTypeId}
                selectedTypeName={formState.selectedTypeName}
                questionText={formState.questionText}
                setQuestionText={formState.setQuestionText}
                questionTextInputRef={formState.questionTextInputRef}
                onInsertCodeBlock={formState.insertQuestionCodeBlock}
                mcqOptions={formState.mcqOptions}
                setMcqOptions={formState.setMcqOptions}
                mcqCorrectIndex={formState.mcqCorrectIndex}
                setMcqCorrectIndex={formState.setMcqCorrectIndex}
                fitbAnswer={formState.fitbAnswer}
                setFitbAnswer={formState.setFitbAnswer}
                orderItems={formState.orderItems}
                setOrderItems={formState.setOrderItems}
                pairValues={formState.pairValues}
                setPairValues={formState.setPairValues}
                optionCount={formState.optionCount}
                setOptionCount={formState.setOptionCount}
                cpQuizSteps={formState.cpQuizSteps}
                setCpQuizSteps={formState.setCpQuizSteps}
                queuedQuizzes={formState.queuedQuizzes}
                currentPendingQuizIndex={formState.currentPendingQuizIndex}
                editingQuiz={formState.editingQuiz}
                preserveQuizDataOnSave={formState.preserveQuizDataOnSave}
                setPreserveQuizDataOnSave={formState.setPreserveQuizDataOnSave}
                isSubmitting={isBusy}
                onAddToQueue={formState.handleAddToUnitQueue}
                onRemoveCurrentQuiz={formState.handleRemoveCurrentQuiz}
                onNextQuiz={formState.handleNextPendingQuiz}
                onPreviousQuiz={formState.handlePreviousPendingQuiz}
                onSelectQuiz={formState.handleSelectPendingQuiz}
              />
            </div>

            <div hidden={formState.unitInputTab !== "assessment"}>
              <AssessmentStepBuilder
                assessmentTitle={formState.assessmentTitle}
                setAssessmentTitle={formState.setAssessmentTitle}
                assessmentDescription={formState.assessmentDescription}
                setAssessmentDescription={formState.setAssessmentDescription}
                expectedOutcome={formState.expectedOutcome}
                setExpectedOutcome={formState.setExpectedOutcome}
                cpSteps={formState.cpSteps}
                setCpSteps={formState.setCpSteps}
              />
            </div>

            <div hidden={formState.unitInputTab !== "import"}>
              <ImportJsonTab
                isEditingPendingUnit={Boolean(formState.editingQuiz?._pendingUnit)}
                importJsonText={formState.importJsonText}
                setImportJsonText={formState.setImportJsonText}
                importJsonMessage={formState.importJsonMessage}
                setImportJsonMessage={formState.setImportJsonMessage}
                isSubmitting={isBusy}
                onExportUnitJson={formState.handleExportUnitJson}
                onApplyImportJson={formState.handleApplyImportJson}
                onReviewLesson={() => {
                  formState.setUnitInputTab("lesson");
                  formState.setPreviewTab("lesson");
                }}
                onReviewAssessment={() => {
                  formState.setUnitInputTab("assessment");
                  formState.setPreviewTab("assessment");
                }}
              />
            </div>

            <div
              style={{
                display:
                  formState.unitInputTab !== "import" ||
                  formState.fullJsonImport !== null
                    ? "flex"
                    : "none",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="submit"
                className="btn-primary"
                disabled={isBusy}
              >
                {formState.isSubmitting
                  ? formState.editingQuiz
                    ? "Saving Quiz..."
                    : "Adding Quiz..."
                  : formState.editingQuiz
                    ? formState.editingQuiz._queuedUnitQuiz
                      ? "Add New Unit"
                      : "Save Changes"
                    : "Add New Unit"}
              </button>
            </div>

            {formState.editingQuiz && !formState.editingQuiz._queuedUnitQuiz && (
              <button
                type="button"
                className="btn-delete"
                onClick={formState.handleCancelEdit}
                disabled={isBusy}
              >
                Cancel
              </button>
            )}
          </form>
        </div>

        <LivePreviewPane
          previewTab={formState.previewTab}
          setPreviewTab={formState.setPreviewTab}
          unitTitle={formState.unitTitle}
          lessonSlides={formState.lessonSlides}
          currentLessonSlide={formState.currentLessonSlide}
          setCurrentLessonSlide={formState.setCurrentLessonSlide}
          assessmentTitle={formState.assessmentTitle}
          assessmentDescription={formState.assessmentDescription}
          expectedOutcome={formState.expectedOutcome}
          cpSteps={formState.cpSteps}
        />
      </div>

      {showRecentQuizzes && (
        <RecentUnitsList
          categories={categories}
          sections={sections}
          recentUnits={listState.recentUnits}
          filteredUnits={listState.filteredUnits}
          currentPage={listState.currentPage}
          totalPages={listState.totalPages}
          totalCount={listState.totalCount}
          isBusy={isBusy}
          isFilterOpen={listState.isFilterOpen}
          setIsFilterOpen={listState.setIsFilterOpen}
          idFilter={listState.idFilter}
          setIdFilter={listState.setIdFilter}
          searchFilter={listState.searchFilter}
          setSearchFilter={listState.setSearchFilter}
          categoryFilter={listState.categoryFilter}
          setCategoryFilter={listState.setCategoryFilter}
          sectionFilter={listState.sectionFilter}
          setSectionFilter={listState.setSectionFilter}
          statusFilter={listState.statusFilter}
          setStatusFilter={listState.setStatusFilter}
          sortBy={listState.sortBy}
          setSortBy={listState.setSortBy}
          copiedUnitId={listState.copiedUnitId}
          hasActiveFilters={listState.hasActiveFilters}
          activeFilterCount={listState.activeFilterCount}
          onClearFilters={listState.handleClearFilters}
          onCopyId={listState.handleCopyId}
          onToggleIdFilter={listState.handleToggleIdFilter}
          onLoadPage={listState.loadUnitPage}
          onEditUnit={formState.handleEditUnit}
          onDeleteUnit={formState.handleDeleteUnit}
        />
      )}
    </>
  );
}
