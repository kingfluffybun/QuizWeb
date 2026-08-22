"use server";

import { db } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export interface Category {
    cat_id: number;
    cat_name: string;
}

export interface Section {
    sec_id: number;
    sec_num: string;
}

export interface Difficulty {
    difficulty_id: number;
    difficulty_name: string;
}

export interface QuizType {
    quiz_type_id: number;
    type_name: string;
}

export interface QuizRow extends RowDataPacket {
    quiz_id: number;
    cat_id: number;
    sec_id?: number;
    difficulty_id: number;
    quiz_type_id: number;
    cat_name: string;
    sec_num?: string;
    difficulty_name: string;
    type_name: string;
    question_text: string;
    quiz_payload: any;
}

function getIndexedFormValues(formData: FormData, prefix: string) {
    const values: string[] = [];
    for (let index = 0; ; index++) {
        const value = formData.get(`${prefix}${index}`);
        if (typeof value !== "string") {
            break;
        }
        values.push(value);
    }
    return values;
}

function getQuizPayload(typeName: string, formData: FormData) {
    if (typeName === "MCQ") {
        const options = [0, 1, 2, 3].map(
            (index) => formData.get(`option_${index}`) as string,
        );
        const correctIndex = formData.get("correct_option_index");

        if (options.some((option) => !option) || correctIndex === null) {
            return {
                error: "All 4 options and the correct answer selection are required for MCQ.",
            };
        }

        return {
            payload: {
                options: options.map((option) => option.trim()),
                correct_index: parseInt(correctIndex as string, 10),
            },
        };
    }

    if (typeName === "FITB") {
        const answer = formData.get("fitb_answer") as string;
        return answer
            ? { payload: { answer: answer.trim() } }
            : { error: "Correct answer is required for FITB." };
    }

    if (typeName === "Order") {
        const items = getIndexedFormValues(formData, "order_");
        return items.length < 4 || items.some((item) => !item.trim())
            ? {
                  error: "At least 4 items are required for Order syntax arrangement.",
              }
            : { payload: { items: items.map((item) => item.trim()) } };
    }

    if (typeName === "Pair") {
        const leftValues = getIndexedFormValues(formData, "pair_left_");
        const rightValues = getIndexedFormValues(formData, "pair_right_");
        if (
            leftValues.length < 4 ||
            leftValues.length !== rightValues.length ||
            leftValues.some(
                (left, index) => !left.trim() || !rightValues[index].trim(),
            )
        ) {
            return {
                error: "At least 4 complete matching pairs are required.",
            };
        }
        return {
            payload: {
                pairs: leftValues.map((left, index) => ({
                    left: left.trim(),
                    right: rightValues[index].trim(),
                })),
            },
        };
    }

    if (typeName === "CP") {
        const template = formData.get("cp_template") as string;
        const expected = formData.get("cp_expected") as string;
        return !template || !expected
            ? {
                  error: "Both initial template code and expected output/test code are required for CP.",
              }
            : {
                  payload: {
                      template: template.trim(),
                      expected: expected.trim(),
                  },
              };
    }

    return { error: "Unsupported quiz type." };
}

async function seedIfNeeded() {
    // Check if we need to reset the tables (if the categories, difficulties, or types are out of sync)
    const [currentTypes] = await db.query<RowDataPacket[]>(
        "SELECT type_name FROM quiz_type_tbl",
    );
    const typeNames = currentTypes.map((t) => t.type_name);
    const targetTypes = ["MCQ", "FITB", "Order", "Pair", "CP"];

    // Also check categories and difficulties
    const [currentCats] = await db.query<RowDataPacket[]>(
        "SELECT cat_name FROM cat_tbl",
    );
    const catNames = currentCats.map((c) => c.cat_name);
    const targetCats = ["HTML", "CSS", "JavaScript"];

    const [currentDiffs] = await db.query<RowDataPacket[]>(
        "SELECT difficulty_name FROM difficulty_tbl",
    );
    const diffNames = currentDiffs.map((d) => d.difficulty_name);
    const targetDiffs = ["Beginner", "Intermediate", "Advanced"];

    const needsReset =
        typeNames.length !== targetTypes.length ||
        !targetTypes.every((t) => typeNames.includes(t)) ||
        catNames.length !== targetCats.length ||
        !targetCats.every((c) => catNames.includes(c)) ||
        diffNames.length !== targetDiffs.length ||
        !targetDiffs.every((d) => diffNames.includes(d));

    if (needsReset) {
        console.log(
            "Database schema/lookup out of sync. Resetting lookup tables...",
        );
        await db.query("SET FOREIGN_KEY_CHECKS = 0");
        await db.query("TRUNCATE TABLE quiz_tbl");
        await db.query("TRUNCATE TABLE cat_tbl");
        await db.query("TRUNCATE TABLE difficulty_tbl");
        await db.query("TRUNCATE TABLE quiz_type_tbl");
        await db.query("SET FOREIGN_KEY_CHECKS = 1");

        // 1. Seed categories
        for (const cat of targetCats) {
            await db.query("INSERT INTO cat_tbl (cat_name) VALUES (?)", [cat]);
        }

        // 2. Seed difficulties
        for (const diff of targetDiffs) {
            await db.query(
                "INSERT INTO difficulty_tbl (difficulty_name) VALUES (?)",
                [diff],
            );
        }

        // 3. Seed quiz types
        for (const type of targetTypes) {
            await db.query("INSERT INTO quiz_type_tbl (type_name) VALUES (?)", [
                type,
            ]);
        }
        console.log("Database reset and seeded successfully.");
    }
}

async function getSectionTableName() {
    const candidates = ["sec_tbl", "section_tbl", "sections_tbl"];

    for (const tableName of candidates) {
        try {
            await db.query(`SELECT 1 FROM ${tableName} LIMIT 1`);
            return tableName;
        } catch {
            // try the next known section table name
        }
    }

    return null;
}

async function quizHasColumn(columnName: string) {
    try {
        const [columns] = await db.query<RowDataPacket[]>(
            "SHOW COLUMNS FROM quiz_tbl LIKE ?",
            [columnName],
        );
        return columns.length > 0;
    } catch {
        return false;
    }
}

export async function getQuizMetadata() {
    try {
        await seedIfNeeded();
        const [categories] = await db.query<RowDataPacket[]>(
            "SELECT * FROM cat_tbl ORDER BY cat_name",
        );
        const [sections] = await db.query<RowDataPacket[]>(
            "SELECT * FROM sec_tbl ORDER BY sec_id",
        );
        const [difficulties] = await db.query<RowDataPacket[]>(
            "SELECT * FROM difficulty_tbl ORDER BY difficulty_id",
        );
        const [types] = await db.query<RowDataPacket[]>(
            "SELECT * FROM quiz_type_tbl ORDER BY quiz_type_id",
        );

        return {
            categories: categories as Category[],
            difficulties: difficulties as Difficulty[],
            types: types as QuizType[],
            sections: sections as Section[],
        };
    } catch (error) {
        console.error("Failed to fetch quiz metadata:", error);
        return { categories: [], difficulties: [], types: [], sections: [] };
    }
}

export async function getRecentQuizzes() {
    try {
        await seedIfNeeded();
        const [quizzes] = await db.query<QuizRow[]>(`
            SELECT q.quiz_id, q.cat_id, q.sec_id, s.sec_num, q.difficulty_id, q.quiz_type_id,
                   q.question_text, q.quiz_payload,
                   c.cat_name, d.difficulty_name, t.type_name
            FROM quiz_tbl q
            JOIN cat_tbl c ON q.cat_id = c.cat_id
            JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
            JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
            JOIN sec_tbl s ON q.sec_id = s.sec_id
            ORDER BY q.quiz_id DESC LIMIT 20
        `);

        return quizzes.map((q) => ({
            ...q,
            sec_num: q.sec_num ?? undefined,
            quiz_payload:
                typeof q.quiz_payload === "string"
                    ? JSON.parse(q.quiz_payload)
                    : q.quiz_payload,
        }));
    } catch (error) {
        console.error("Failed to fetch recent quizzes:", error);
        return [];
    }
}

export async function createQuiz(state: any, formData: FormData) {
    const catId = formData.get("cat_id");
    const secId = formData.get("sec_id");
    const difficultyId = formData.get("difficulty_id");
    const quizTypeId = formData.get("quiz_type_id");
    const questionText = formData.get("question_text");

    if (!catId || !difficultyId || !quizTypeId || !questionText) {
        return {
            error: "Category, difficulty, type, and question are all required.",
        };
    }

    try {
        const [typeRow] = await db.query<RowDataPacket[]>(
            "SELECT type_name FROM quiz_type_tbl WHERE quiz_type_id = ?",
            [quizTypeId],
        );

        if (typeRow.length === 0) {
            return { error: "Invalid quiz type selected." };
        }

        const typeName = typeRow[0].type_name;
        const parsedPayload = getQuizPayload(typeName, formData);
        if (parsedPayload.error) {
            return { error: parsedPayload.error };
        }

        const hasSecId = await quizHasColumn("sec_id");
        const columns = [
            "cat_id",
            "difficulty_id",
            "quiz_type_id",
            "question_text",
            "quiz_payload",
        ];
        const values: any[] = [
            catId,
            difficultyId,
            quizTypeId,
            questionText.toString().trim(),
            JSON.stringify(parsedPayload.payload),
        ];

        if (hasSecId && secId && secId !== "") {
            columns.push("sec_id");
            values.push(secId);
        }

        await db.query(
            `INSERT INTO quiz_tbl (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
            values,
        );

        return { success: true };
    } catch (error) {
        console.error("Failed to insert quiz:", error);
        return {
            error: "An error occurred while saving the quiz to the database.",
        };
    }
}

export async function deleteQuiz(quizId: number) {
    if (!quizId) {
        return { error: "Quiz ID is required for deletion." };
    }
    try {
        await db.query("DELETE FROM quiz_tbl WHERE quiz_id = ?", [quizId]);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete quiz:", error);
        return {
            error: "An error occurred while deleting the quiz from the database.",
        };
    }
}

export async function updateQuiz(quizId: number, formData: FormData) {
    const catId = formData.get("cat_id");
    const secId = formData.get("sec_id");
    const difficultyId = formData.get("difficulty_id");
    const quizTypeId = formData.get("quiz_type_id");
    const questionText = formData.get("question_text");

    if (!quizId || !catId || !difficultyId || !quizTypeId || !questionText) {
        return {
            error: "Quiz ID, category, difficulty, type, and question are all required.",
        };
    }

    try {
        const [typeRows] = await db.query<RowDataPacket[]>(
            "SELECT type_name FROM quiz_type_tbl WHERE quiz_type_id = ?",
            [quizTypeId],
        );
        if (typeRows.length === 0) {
            return { error: "Invalid quiz type selected." };
        }

        const parsedPayload = getQuizPayload(typeRows[0].type_name, formData);
        if (parsedPayload.error) {
            return { error: parsedPayload.error };
        }

        const hasSecId = await quizHasColumn("sec_id");
        const updateFields = [
            "cat_id = ?",
            "difficulty_id = ?",
            "quiz_type_id = ?",
            "question_text = ?",
            "quiz_payload = ?",
        ];
        const values: any[] = [
            catId,
            difficultyId,
            quizTypeId,
            questionText.toString().trim(),
            JSON.stringify(parsedPayload.payload),
        ];

        if (hasSecId && secId && secId !== "") {
            updateFields.push("sec_id = ?");
            values.push(secId);
        }

        values.push(quizId);

        const [result] = await db.query<ResultSetHeader>(
            `UPDATE quiz_tbl SET ${updateFields.join(", ")} WHERE quiz_id = ?`,
            values,
        );

        return result.affectedRows === 0
            ? { error: "Quiz question was not found." }
            : { success: true };
    } catch (error) {
        console.error("Failed to update quiz:", error);
        return {
            error: "An error occurred while updating the quiz in the database.",
        };
    }
}
