"use client";

import React, { useState, useEffect } from "react";
import { createQuiz, getRecentQuizzes, updateQuiz, deleteQuiz } from "../actions/quiz";
import type { Category, Difficulty, QuizType } from "../actions/quiz";

interface QuizInputFormProps {
    categories: Category[];
    difficulties: Difficulty[];
    types: QuizType[];
    initialRecentQuizzes: any[];
}

export default function QuizInputForm({
    categories,
    difficulties,
    types,
    initialRecentQuizzes,
}: QuizInputFormProps) {
    const [selectedTypeId, setSelectedTypeId] = useState<string>("");
    const [recentQuizzes, setRecentQuizzes] = useState<any[]>(initialRecentQuizzes);
    const [isPending, setIsPending] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState<any | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const selectedType = types.find(t => t.quiz_type_id.toString() === selectedTypeId);
    const selectedTypeName = selectedType ? selectedType.type_name : "";

    useEffect(() => {
        if (types.length > 0) {
            setSelectedTypeId(types[0].quiz_type_id.toString());
        }
    }, [types]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsPending(true);
        setMessage(null);

        const formData = new FormData(event.currentTarget);

        try {
            const result = editingQuiz
                ? await updateQuiz(editingQuiz.quiz_id, formData)
                : await createQuiz(null, formData);
            if (result.error) {
                setMessage({ type: "error", text: result.error });
            } else if (result.success) {
                setMessage({
                    type: "success",
                    text: editingQuiz ? "Quiz successfully updated!" : "Quiz successfully added to database!"
                });

                // Reset only question and type-specific text inputs/textareas to allow fast batch entries
                setEditingQuiz(null);

                // Refresh list
                const updatedQuizzes = await getRecentQuizzes();
                setRecentQuizzes(updatedQuizzes);
            }
        } catch (err) {
            console.error("Submission error:", err);
            setMessage({ type: "error", text: "An unexpected error occurred during submission." });
        } finally {
            setIsPending(false);
        }
    };

    const handleEdit = (quiz: any) => {
        setEditingQuiz(quiz);
        setSelectedTypeId(quiz.quiz_type_id.toString());
        setMessage(null);
    };

    const handleCancelEdit = () => {
        setEditingQuiz(null);
        setSelectedTypeId(types[0]?.quiz_type_id.toString() ?? "");
        setMessage(null);
    };

    const handleDelete = async (quizId: number) => {
        if (!confirm("Are you sure you want to delete this quiz question?")) {
            return;
        }

        try {
            const result = await deleteQuiz(quizId);
            if (result.error) {
                setMessage({ type: "error", text: result.error });
            } else if (result.success) {
                setMessage({ type: "success", text: "Quiz successfully deleted!" });

                // Refresh list
                const updatedQuizzes = await getRecentQuizzes();
                setRecentQuizzes(updatedQuizzes);
            }
        } catch (err) {
            console.error("Delete error:", err);
            setMessage({ type: "error", text: "An unexpected error occurred during deletion." });
        }
    };

    return (
        <>
            {/* Form Section */}
            <div className="admin-card">
                <h2>{editingQuiz ? "Edit Quiz Question" : "Create New Quiz Question"}</h2>

                {message && (
                    <div className={`status-message status-${message.type}`}>
                        {message.text}
                    </div>
                )}

                <form key={editingQuiz?.quiz_id ?? "new"} onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="cat_id">Category</label>
                        <select id="cat_id" name="cat_id" className="form-select" required defaultValue={editingQuiz?.cat_id?.toString() ?? ""}>
                            <option value="" disabled>Select Category</option>
                            {categories.map((cat) => (
                                <option key={cat.cat_id} value={cat.cat_id}>
                                    {cat.cat_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="difficulty_id">Difficulty</label>
                        <select id="difficulty_id" name="difficulty_id" className="form-select" required defaultValue={editingQuiz?.difficulty_id?.toString() ?? ""}>
                            <option value="" disabled>Select Difficulty</option>
                            {difficulties.map((diff) => (
                                <option key={diff.difficulty_id} value={diff.difficulty_id}>
                                    {diff.difficulty_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="quiz_type_id">Quiz Type</label>
                        <select
                            id="quiz_type_id"
                            name="quiz_type_id"
                            className="form-select"
                            required
                            value={selectedTypeId}
                            onChange={(e) => setSelectedTypeId(e.target.value)}
                        >
                            {types.map((t) => (
                                <option key={t.quiz_type_id} value={t.quiz_type_id}>
                                    {t.type_name} ({
                                        t.type_name === "MCQ" ? "Multiple Choice" :
                                            t.type_name === "FITB" ? "Fill in the Blank" :
                                                t.type_name === "Order" ? "Syntax Arrangement" :
                                                    t.type_name === "Pair" ? "Matching Type" :
                                                        t.type_name === "CP" ? "Coding Problem" : t.type_name
                                    })
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="question_text">Question Text / Prompt</label>
                        <textarea
                            id="question_text"
                            name="question_text"
                            className="form-textarea"
                            placeholder="Enter the question text here..."
                            defaultValue={editingQuiz?.question_text ?? ""}
                            required
                        />
                    </div>

                    {/* MCQ Options */}
                    {selectedTypeName === "MCQ" && (
                        <div className="form-group">
                            <label style={{ marginBottom: "12px" }}>Answer Options (Select correct answer radio)</label>
                            <div className="options-grid">
                                {[0, 1, 2, 3].map((idx) => (
                                    <div key={idx} className="option-row">
                                        <input
                                            type="radio"
                                            name="correct_option_index"
                                            value={idx}
                                            id={`correct_${idx}`}
                                            className="radio-check"
                                            required
                                            defaultChecked={editingQuiz ? editingQuiz.quiz_payload?.correct_index === idx : idx === 0}
                                        />
                                        <input
                                            type="text"
                                            name={`option_${idx}`}
                                            placeholder={`Option ${idx + 1}`}
                                            className="form-input"
                                            defaultValue={editingQuiz?.quiz_payload?.options?.[idx] ?? ""}
                                            required
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* FITB Options */}
                    {selectedTypeName === "FITB" && (
                        <div className="form-group">
                            <label htmlFor="fitb_answer">Correct Blank Answer</label>
                            <input
                                type="text"
                                id="fitb_answer"
                                name="fitb_answer"
                                placeholder="Enter the correct answer word(s)..."
                                className="form-input"
                                defaultValue={editingQuiz?.quiz_payload?.answer ?? ""}
                                required
                            />
                        </div>
                    )}

                    {/* Order Options */}
                    {selectedTypeName === "Order" && (
                        <div className="form-group">
                            <label style={{ marginBottom: "12px" }}>Items to Order (Enter in the CORRECT sequence)</label>
                            <div className="options-grid">
                                {[0, 1, 2, 3].map((idx) => (
                                    <div key={idx} className="option-row">
                                        <span style={{ minWidth: "30px", fontWeight: "bold" }}>{idx + 1}.</span>
                                        <input
                                            type="text"
                                            name={`order_${idx}`}
                                            placeholder={`Sequence Item ${idx + 1}`}
                                            className="form-input"
                                            defaultValue={editingQuiz?.quiz_payload?.items?.[idx] ?? ""}
                                            required
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pair Options */}
                    {selectedTypeName === "Pair" && (
                        <div className="form-group">
                            <label style={{ marginBottom: "12px" }}>Matching Pairs (Enter Left and matching Right values)</label>
                            <div className="options-grid">
                                {[0, 1, 2, 3].map((idx) => (
                                    <div key={idx} className="option-row" style={{ gap: "10px" }}>
                                        <span style={{ fontWeight: "bold" }}>{idx + 1}.</span>
                                        <input
                                            type="text"
                                            name={`pair_left_${idx}`}
                                            placeholder="Left Key"
                                            className="form-input"
                                            defaultValue={editingQuiz?.quiz_payload?.pairs?.[idx]?.left ?? ""}
                                            required
                                        />
                                        <span style={{ color: "#aaa" }}>&harr;</span>
                                        <input
                                            type="text"
                                            name={`pair_right_${idx}`}
                                            placeholder="Right Value"
                                            className="form-input"
                                            defaultValue={editingQuiz?.quiz_payload?.pairs?.[idx]?.right ?? ""}
                                            required
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CP Options */}
                    {selectedTypeName === "CP" && (
                        <div className="form-group">
                            <div style={{ marginBottom: "15px" }}>
                                <label htmlFor="cp_template">Initial Code Template</label>
                                <textarea
                                    id="cp_template"
                                    name="cp_template"
                                    className="form-textarea"
                                    style={{ fontFamily: "monospace" }}
                                    placeholder="e.g. function test() {\n  // your code here\n}"
                                    defaultValue={editingQuiz?.quiz_payload?.template ?? ""}
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="cp_expected">Expected Output / Answer Key Code</label>
                                <textarea
                                    id="cp_expected"
                                    name="cp_expected"
                                    className="form-textarea"
                                    style={{ fontFamily: "monospace" }}
                                    placeholder="e.g. return true;"
                                    defaultValue={editingQuiz?.quiz_payload?.expected ?? ""}
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={isPending}
                        style={{ marginTop: "10px" }}
                    >
                        {isPending ? (editingQuiz ? "Saving Quiz..." : "Adding Quiz...") : (editingQuiz ? "Save Changes" : "Add Quiz Question")}
                    </button>
                    {editingQuiz && (
                        <button
                            type="button"
                            className="btn-delete"
                            onClick={handleCancelEdit}
                            disabled={isPending}
                            style={{ marginTop: "10px", marginLeft: "10px" }}
                        >
                            Cancel
                        </button>
                    )}
                </form>
            </div>

            {/* List Section */}
            <div className="admin-card">
                <h2>Recently Added Quizzes</h2>

                {recentQuizzes.length === 0 ? (
                    <div className="empty-state">
                        No quiz questions created yet. Use the form on the left to add one!
                    </div>
                ) : (
                    <div style={{ maxHeight: "750px", overflowY: "auto", paddingRight: "10px" }}>
                        {recentQuizzes.map((quiz) => {
                            const payload = quiz.quiz_payload;
                            return (
                                <div key={quiz.quiz_id} className="quiz-list-item">
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                                        <div className="quiz-list-question" style={{ marginBottom: 0 }}>{quiz.question_text}</div>
                                                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                                                        <button
                                                            type="button"
                                                            className="btn-delete"
                                                            onClick={() => handleEdit(quiz)}
                                                            title="Edit Question"
                                                            aria-label="Edit Question"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-1.986-.212L3.5 20.5l-.5 3 3-.5L20.888 8.8a1 1 0 0 0 .286-1.988Z" /><path d="m16 5 3 3" /></svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-delete"
                                                            onClick={() => handleDelete(quiz.quiz_id)}
                                                            title="Delete Question"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                                                        </button>
                                                    </div>
                                    </div>
                                    <div className="quiz-badge-row">
                                        <span className="badge badge-cat">{quiz.cat_name}</span>
                                        <span className="badge badge-diff">{quiz.difficulty_name}</span>
                                        <span className="badge badge-type">{quiz.type_name}</span>
                                    </div>
                                    {payload && (
                                        <div className="quiz-payload-preview">
                                            {/* MCQ Rendering */}
                                            {quiz.type_name === "MCQ" && payload.options && (
                                                <div>
                                                    <strong>Options:</strong>
                                                    {payload.options.map((opt: string, i: number) => {
                                                        const isCorrect = payload.correct_index === i;
                                                        return (
                                                            <div key={i} className="quiz-payload-option">
                                                                <span>{i + 1}. {opt}</span>
                                                                {isCorrect && <span className="correct-text">(Correct)</span>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* FITB Rendering */}
                                            {quiz.type_name === "FITB" && (
                                                <div>
                                                    <strong>Correct Answer:</strong> <span className="correct-text">{payload.answer}</span>
                                                </div>
                                            )}

                                            {/* Order Rendering */}
                                            {quiz.type_name === "Order" && payload.items && (
                                                <div>
                                                    <strong>Correct Order:</strong>
                                                    {payload.items.map((item: string, i: number) => (
                                                        <div key={i} style={{ margin: "4px 0" }}>
                                                            {i + 1}. {item}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Pair Rendering */}
                                            {quiz.type_name === "Pair" && payload.pairs && (
                                                <div>
                                                    <strong>Matching Pairs:</strong>
                                                    {payload.pairs.map((pair: any, i: number) => (
                                                        <div key={i} style={{ margin: "4px 0" }}>
                                                            <code>{pair.left}</code> &harr; <code>{pair.right}</code>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* CP Rendering */}
                                            {quiz.type_name === "CP" && (
                                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                                    <div>
                                                        <strong>Template:</strong>
                                                        <pre style={{ margin: "4px 0", backgroundColor: "#eee", padding: "6px", borderRadius: "4px", fontSize: "0.8rem", overflowX: "auto" }}>
                                                            {payload.template}
                                                        </pre>
                                                    </div>
                                                    <div>
                                                        <strong>Expected Output:</strong>
                                                        <pre style={{ margin: "4px 0", backgroundColor: "#e2f0d9", padding: "6px", borderRadius: "4px", fontSize: "0.8rem", overflowX: "auto" }}>
                                                            {payload.expected}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
