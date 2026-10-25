import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

// 1. Load environment variables from .env.local if present
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
}

const isLocalhost = !process.env.DB_HOST || ["localhost", "127.0.0.1"].includes(process.env.DB_HOST);
const enableSsl = process.env.DB_SSL === "true" || (!isLocalhost && process.env.DB_SSL !== "false");

function getFormattedTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

async function exportUnits() {
    console.log(`Connecting to database ${process.env.DB_NAME} at ${process.env.DB_HOST}...`);

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: enableSsl ? { rejectUnauthorized: false } : undefined,
    });

    try {
        console.log("Connected successfully. Fetching units and relations from normalized schema...");

        // 1. Fetch Units
        const [unitsRows] = await connection.query(`
            SELECT 
                u.unit_id,
                u.unit_title,
                u.sec_id,
                s.sec_num,
                s.cat_id,
                u.status,
                u.author_id,
                u.pending_note
            FROM unit_tbl u
            LEFT JOIN sec_tbl s ON u.sec_id = s.sec_id
            ORDER BY u.sec_id ASC, u.unit_id ASC
        `);

        console.log(`Retrieved ${unitsRows.length} unit records.`);

        // 2. Fetch all lesson slides
        const [slideRows] = await connection.query(`
            SELECT unit_id, slide_order, slide_title, slide_text, slide_code
            FROM lesson_slide_tbl
            ORDER BY unit_id ASC, slide_order ASC
        `);
        const slidesByUnit = new Map();
        for (const s of slideRows) {
            const uid = Number(s.unit_id);
            if (!slidesByUnit.has(uid)) slidesByUnit.set(uid, []);
            slidesByUnit.get(uid).push({
                lesson_title: s.slide_title,
                lesson_text: s.slide_text,
                lesson_code: s.slide_code ?? "",
            });
        }

        // 3. Fetch all quizzes
        const [quizRows] = await connection.query(`
            SELECT q.quiz_id, q.unit_id, q.difficulty_id, q.quiz_type_id, q.quiz_order, q.question_text,
                   d.difficulty_name, t.type_name,
                   u.sec_id, s.sec_num, s.cat_id
            FROM quiz_tbl q
            JOIN unit_tbl u ON q.unit_id = u.unit_id
            JOIN sec_tbl s ON u.sec_id = s.sec_id
            JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
            JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
            ORDER BY q.unit_id ASC, q.quiz_order ASC, q.quiz_id ASC
        `);

        // Subtypes
        const mcqIds = [];
        const fitbIds = [];
        const orderIds = [];
        const pairIds = [];
        const cpIds = [];

        for (const q of quizRows) {
            const typeId = Number(q.quiz_type_id);
            const type = String(q.type_name ?? "").toUpperCase();
            if (type === "MCQ" || typeId === 1) mcqIds.push(q.quiz_id);
            else if (type === "FITB" || typeId === 2) fitbIds.push(q.quiz_id);
            else if (type === "ORDER" || typeId === 3) orderIds.push(q.quiz_id);
            else if (type === "PAIR" || typeId === 4) pairIds.push(q.quiz_id);
            else if (type === "CP" || typeId === 5) cpIds.push(q.quiz_id);
        }

        const mcqMap = new Map();
        if (mcqIds.length > 0) {
            const [rows] = await connection.query(
                `SELECT quiz_id, option_index, option_text, is_correct
                 FROM quiz_mcq_option_tbl
                 WHERE quiz_id IN (?)
                 ORDER BY quiz_id, option_index ASC`,
                [mcqIds]
            );
            for (const r of rows) {
                const qId = Number(r.quiz_id);
                if (!mcqMap.has(qId)) mcqMap.set(qId, { options: [], correct_index: 0 });
                const entry = mcqMap.get(qId);
                entry.options.push(String(r.option_text ?? ""));
                if (Boolean(r.is_correct)) {
                    entry.correct_index = entry.options.length - 1;
                }
            }
        }

        const fitbMap = new Map();
        if (fitbIds.length > 0) {
            const [rows] = await connection.query(
                `SELECT quiz_id, correct_answer FROM quiz_fitb_tbl WHERE quiz_id IN (?)`,
                [fitbIds]
            );
            for (const r of rows) {
                fitbMap.set(Number(r.quiz_id), { answer: String(r.correct_answer ?? "") });
            }
        }

        const orderMap = new Map();
        if (orderIds.length > 0) {
            const [rows] = await connection.query(
                `SELECT quiz_id, canonical_order, item_text
                 FROM quiz_order_item_tbl
                 WHERE quiz_id IN (?)
                 ORDER BY quiz_id, canonical_order ASC`,
                [orderIds]
            );
            for (const r of rows) {
                const qId = Number(r.quiz_id);
                if (!orderMap.has(qId)) orderMap.set(qId, { items: [] });
                orderMap.get(qId).items.push(String(r.item_text ?? ""));
            }
        }

        const pairMap = new Map();
        if (pairIds.length > 0) {
            const [rows] = await connection.query(
                `SELECT quiz_id, pair_order, left_text, right_text
                 FROM quiz_pair_tbl
                 WHERE quiz_id IN (?)
                 ORDER BY quiz_id, pair_order ASC, pair_id ASC`,
                [pairIds]
            );
            for (const r of rows) {
                const qId = Number(r.quiz_id);
                if (!pairMap.has(qId)) pairMap.set(qId, { pairs: [] });
                pairMap.get(qId).pairs.push({
                    left: String(r.left_text ?? ""),
                    right: String(r.right_text ?? "")
                });
            }
        }

        const cpMap = new Map();
        if (cpIds.length > 0) {
            const [cpRows] = await connection.query(
                `SELECT quiz_id, title FROM quiz_cp_tbl WHERE quiz_id IN (?)`,
                [cpIds]
            );
            const [stepRows] = await connection.query(
                `SELECT quiz_id, step_order, prompt, template_code, expected_code
                 FROM quiz_cp_step_tbl
                 WHERE quiz_id IN (?)
                 ORDER BY quiz_id, step_order ASC`,
                [cpIds]
            );
            const stepsByQuiz = new Map();
            for (const s of stepRows) {
                const qId = Number(s.quiz_id);
                if (!stepsByQuiz.has(qId)) stepsByQuiz.set(qId, []);
                stepsByQuiz.get(qId).push({
                    prompt: s.prompt,
                    template: s.template_code ?? "",
                    expected: s.expected_code
                });
            }
            for (const c of cpRows) {
                const qId = Number(c.quiz_id);
                const steps = stepsByQuiz.get(qId) ?? [];
                cpMap.set(qId, {
                    title: c.title,
                    steps,
                    prompts: steps.map((s) => s.prompt),
                    prompt: steps[0]?.prompt ?? "",
                    template: steps[0]?.template ?? "",
                    expected: steps[0]?.expected ?? "",
                });
            }
        }

        const quizzesByUnit = new Map();
        for (const q of quizRows) {
            const uid = Number(q.unit_id);
            if (!quizzesByUnit.has(uid)) quizzesByUnit.set(uid, []);
            const typeId = Number(q.quiz_type_id);
            const type = String(q.type_name ?? "").toUpperCase();
            let payload = {};
            if (type === "MCQ" || typeId === 1) {
                payload = mcqMap.get(q.quiz_id) ?? { options: [], correct_index: 0 };
            } else if (type === "FITB" || typeId === 2) {
                payload = fitbMap.get(q.quiz_id) ?? { answer: "" };
            } else if (type === "ORDER" || typeId === 3) {
                payload = orderMap.get(q.quiz_id) ?? { items: [] };
            } else if (type === "PAIR" || typeId === 4) {
                payload = pairMap.get(q.quiz_id) ?? { pairs: [] };
            } else if (type === "CP" || typeId === 5) {
                payload = cpMap.get(q.quiz_id) ?? { steps: [] };
            }

            quizzesByUnit.get(uid).push({
                quiz_id: q.quiz_id,
                unit: q.sec_num != null ? Number(q.sec_num) : q.sec_id,
                cat_id: q.cat_id,
                sec_id: q.sec_id,
                quiz_type_id: q.quiz_type_id,
                difficulty_id: q.difficulty_id,
                question_text: q.question_text,
                quiz_payload: payload
            });
        }

        // 4. Fetch all assessments & steps
        const [assessmentRows] = await connection.query(`
            SELECT assessment_id, unit_id, title, description, expected_outcome
            FROM unit_assessment_tbl
        `);
        const [stepRows] = await connection.query(`
            SELECT assessment_id, step_number, instruction, inherit_previous_code,
                   starter_html, starter_css, starter_js,
                   expected_html, expected_css, expected_js
            FROM assessment_step_tbl
            ORDER BY assessment_id ASC, step_number ASC
        `);
        const stepsByAssessment = new Map();
        for (const s of stepRows) {
            const aId = Number(s.assessment_id);
            if (!stepsByAssessment.has(aId)) stepsByAssessment.set(aId, []);
            stepsByAssessment.get(aId).push(s);
        }

        const assessmentByUnit = new Map();
        for (const a of assessmentRows) {
            const uid = Number(a.unit_id);
            const steps = stepsByAssessment.get(Number(a.assessment_id)) ?? [];
            assessmentByUnit.set(uid, {
                schemaVersion: 2,
                title: a.title,
                description: a.description,
                expected_outcome: a.expected_outcome,
                steps: steps.map((s) => s.instruction),
                cp_steps: steps.map((s) => ({
                    stepNumber: Number(s.step_number),
                    instruction: s.instruction,
                    starterCode: {
                        html: s.starter_html ?? "",
                        css: s.starter_css ?? "",
                        js: s.starter_js ?? "",
                    },
                    expectedTemplate: {
                        html: s.expected_html ?? "",
                        css: s.expected_css ?? "",
                        js: s.expected_js ?? "",
                    },
                    inheritPreviousCode: Boolean(s.inherit_previous_code),
                })),
                assessment: steps.map((s) => s.instruction).join("\n\n"),
            });
        }

        // 5. Build units array
        const units = unitsRows.map((row) => {
            const uid = Number(row.unit_id);
            const slides = slidesByUnit.get(uid);
            const lessonCard = slides && slides.length > 0 ? {
                lesson_title: row.unit_title,
                lesson_slide: slides,
            } : null;

            return {
                unit_id: row.unit_id,
                unit_title: row.unit_title,
                sec_id: row.sec_id,
                sec_num: row.sec_num,
                status: row.status,
                author_id: row.author_id,
                unit_lesson_card_json: lessonCard,
                unit_quiz_json: quizzesByUnit.get(uid) ?? [],
                unit_assessment_json: assessmentByUnit.get(uid) ?? null,
            };
        });

        const exportPayload = {
            exported_at: new Date().toISOString(),
            source_database: process.env.DB_NAME,
            total_units: units.length,
            units,
        };

        const exportDir = path.resolve(process.cwd(), "exports");
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        const timestamp = getFormattedTimestamp();
        const exportFileName = `quizweb-units-${timestamp}.json`;
        const exportFilePath = path.join(exportDir, exportFileName);
        const latestFilePath = path.join(exportDir, "quizweb-units-latest.json");

        const jsonString = JSON.stringify(exportPayload, null, 2);

        fs.writeFileSync(exportFilePath, jsonString, "utf8");
        fs.writeFileSync(latestFilePath, jsonString, "utf8");

        console.log(`\nSuccessfully exported content to:`);
        console.log(` - ${exportFilePath}`);
        console.log(` - ${latestFilePath}`);

        // Summary table
        console.log("\n--- Export Summary ---");
        const summary = units.map((u) => ({
            "Unit ID": u.unit_id,
            "Section": u.sec_num ?? u.sec_id ?? "N/A",
            "Title": u.unit_title,
            "Quizzes": u.unit_quiz_json.length,
            "Has Assessment": Boolean(u.unit_assessment_json),
        }));
        console.table(summary);

    } finally {
        await connection.end();
    }
}

exportUnits().catch((err) => {
    console.error("Export failed:", err);
    process.exit(1);
});
