"use server";

import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export interface Category {
    cat_id: number;
    cat_name: string;
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
    cat_name: string;
    difficulty_name: string;
    type_name: string;
    question_text: string;
    quiz_payload: any;
    created_at: Date;
}

async function seedIfNeeded() {
    // Check if we need to reset the tables (if the categories, difficulties, or types are out of sync)
    const [currentTypes] = await db.query<RowDataPacket[]>("SELECT type_name FROM quiz_type_tbl");
    const typeNames = currentTypes.map(t => t.type_name);
    const targetTypes = ["MCQ", "FITB", "Order", "Pair", "CP"];
    
    // Also check categories and difficulties
    const [currentCats] = await db.query<RowDataPacket[]>("SELECT cat_name FROM cat_tbl");
    const catNames = currentCats.map(c => c.cat_name);
    const targetCats = ["HTML", "CSS", "JavaScript"];

    const [currentDiffs] = await db.query<RowDataPacket[]>("SELECT difficulty_name FROM difficulty_tbl");
    const diffNames = currentDiffs.map(d => d.difficulty_name);
    const targetDiffs = ["Beginner", "Intermediate", "Advanced"];

    const needsReset = 
        typeNames.length !== targetTypes.length || !targetTypes.every(t => typeNames.includes(t)) ||
        catNames.length !== targetCats.length || !targetCats.every(c => catNames.includes(c)) ||
        diffNames.length !== targetDiffs.length || !targetDiffs.every(d => diffNames.includes(d));

    if (needsReset) {
        console.log("Database schema/lookup out of sync. Resetting lookup tables...");
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
            await db.query("INSERT INTO difficulty_tbl (difficulty_name) VALUES (?)", [diff]);
        }

        // 3. Seed quiz types
        for (const type of targetTypes) {
            await db.query("INSERT INTO quiz_type_tbl (type_name) VALUES (?)", [type]);
        }
        console.log("Database reset and seeded successfully.");
    }
}

export async function getQuizMetadata() {
    try {
        await seedIfNeeded();
        const [categories] = await db.query<RowDataPacket[]>("SELECT * FROM cat_tbl ORDER BY cat_name");
        const [difficulties] = await db.query<RowDataPacket[]>("SELECT * FROM difficulty_tbl ORDER BY difficulty_id");
        const [types] = await db.query<RowDataPacket[]>("SELECT * FROM quiz_type_tbl ORDER BY quiz_type_id");

        return {
            categories: categories as Category[],
            difficulties: difficulties as Difficulty[],
            types: types as QuizType[]
        };
    } catch (error) {
        console.error("Failed to fetch quiz metadata:", error);
        return { categories: [], difficulties: [], types: [] };
    }
}

export async function getRecentQuizzes() {
    try {
        await seedIfNeeded();
        const [quizzes] = await db.query<QuizRow[]>(`
            SELECT q.quiz_id, q.question_text, q.quiz_payload,
                   c.cat_name, d.difficulty_name, t.type_name, q.created_at
            FROM quiz_tbl q
            JOIN cat_tbl c ON q.cat_id = c.cat_id
            JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
            JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
            ORDER BY q.created_at DESC LIMIT 20
        `);
        return quizzes.map(q => ({
            ...q,
            quiz_payload: typeof q.quiz_payload === 'string' ? JSON.parse(q.quiz_payload) : q.quiz_payload
        }));
    } catch (error) {
        console.error("Failed to fetch recent quizzes:", error);
        return [];
    }
}

export async function createQuiz(state: any, formData: FormData) {
    const catId = formData.get("cat_id");
    const difficultyId = formData.get("difficulty_id");
    const quizTypeId = formData.get("quiz_type_id");
    const questionText = formData.get("question_text");

    if (!catId || !difficultyId || !quizTypeId || !questionText) {
        return { error: "Category, difficulty, type, and question are all required." };
    }

    try {
        const [typeRow] = await db.query<RowDataPacket[]>(
            "SELECT type_name FROM quiz_type_tbl WHERE quiz_type_id = ?",
            [quizTypeId]
        );

        if (typeRow.length === 0) {
            return { error: "Invalid quiz type selected." };
        }

        const typeName = typeRow[0].type_name;
        let payload: any;

        if (typeName === "MCQ") {
            const opt0 = formData.get("option_0") as string;
            const opt1 = formData.get("option_1") as string;
            const opt2 = formData.get("option_2") as string;
            const opt3 = formData.get("option_3") as string;
            const correctIndexStr = formData.get("correct_option_index");

            if (!opt0 || !opt1 || !opt2 || !opt3 || correctIndexStr === null) {
                return { error: "All 4 options and the correct answer selection are required for MCQ." };
            }

            payload = {
                options: [opt0.trim(), opt1.trim(), opt2.trim(), opt3.trim()],
                correct_index: parseInt(correctIndexStr as string, 10)
            };
        } else if (typeName === "FITB") {
            const answer = formData.get("fitb_answer") as string;
            if (!answer) {
                return { error: "Correct answer is required for FITB." };
            }
            payload = {
                answer: answer.trim()
            };
        } else if (typeName === "Order") {
            const item0 = formData.get("order_0") as string;
            const item1 = formData.get("order_1") as string;
            const item2 = formData.get("order_2") as string;
            const item3 = formData.get("order_3") as string;

            if (!item0 || !item1 || !item2 || !item3) {
                return { error: "All 4 items are required for Order syntax arrangement." };
            }

            payload = {
                items: [item0.trim(), item1.trim(), item2.trim(), item3.trim()]
            };
        } else if (typeName === "Pair") {
            const pairs = [];
            for (let i = 0; i < 4; i++) {
                const left = formData.get(`pair_left_${i}`) as string;
                const right = formData.get(`pair_right_${i}`) as string;
                if (!left || !right) {
                    return { error: `Both parts of Pair ${i + 1} are required.` };
                }
                pairs.push({ left: left.trim(), right: right.trim() });
            }
            payload = { pairs };
        } else if (typeName === "CP") {
            const template = formData.get("cp_template") as string;
            const expected = formData.get("cp_expected") as string;
            if (!template || !expected) {
                return { error: "Both initial template code and expected output/test code are required for CP." };
            }
            payload = {
                template: template.trim(),
                expected: expected.trim()
            };
        } else {
            return { error: "Unsupported quiz type." };
        }

        await db.query(
            "INSERT INTO quiz_tbl (cat_id, difficulty_id, quiz_type_id, question_text, quiz_payload) VALUES (?, ?, ?, ?, ?)",
            [catId, difficultyId, quizTypeId, questionText.toString().trim(), JSON.stringify(payload)]
        );

        return { success: true };
    } catch (error) {
        console.error("Failed to insert quiz:", error);
        return { error: "An error occurred while saving the quiz to the database." };
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
        return { error: "An error occurred while deleting the quiz from the database." };
    }
}
