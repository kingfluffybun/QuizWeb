import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
}

const isLocalhost = !process.env.DB_HOST || ["localhost", "127.0.0.1"].includes(process.env.DB_HOST);
const enableSsl = process.env.DB_SSL === "true" || (!isLocalhost && process.env.DB_SSL !== "false");

function sanitizeValue(columnName, value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "object" && !(value instanceof Date)) {
        return JSON.stringify(value);
    }
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        if (columnName.endsWith("_date") || columnName === "date") {
            return value.slice(0, 10);
        }
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
            const pad = (n) => String(n).padStart(2, "0");
            return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
        }
    }
    return value;
}

async function importAll() {
    const unitsFile = process.argv[2] || path.resolve(process.cwd(), "exports/quizweb-units-latest.json");
    const usersFile = process.argv[3] || path.resolve(process.cwd(), "exports/quizweb-user-data-latest.json");

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
        await connection.query("SET FOREIGN_KEY_CHECKS = 0");

        // 1. Import User Tables if usersFile exists
        if (fs.existsSync(usersFile)) {
            console.log(`\nImporting user data from ${usersFile}...`);
            const userData = JSON.parse(fs.readFileSync(usersFile, "utf8"));
            const tables = userData.tables || {};

            for (const [tableName, rows] of Object.entries(tables)) {
                if (!Array.isArray(rows) || rows.length === 0) continue;
                console.log(` - Restoring ${tableName} (${rows.length} rows)...`);

                for (const row of rows) {
                    const columns = Object.keys(row);
                    const values = columns.map((col) => sanitizeValue(col, row[col]));
                    const placeholders = columns.map(() => "?").join(", ");
                    const updateClause = columns.map((col) => `\`${col}\` = VALUES(\`${col}\`)`).join(", ");

                    const sql = `
                        INSERT INTO \`${tableName}\` (${columns.map((c) => `\`${c}\``).join(", ")})
                        VALUES (${placeholders})
                        ON DUPLICATE KEY UPDATE ${updateClause}
                    `;
                    await connection.execute(sql, values);
                }
            }
        }

        // 2. Import Units & Assessments if unitsFile exists
        if (fs.existsSync(unitsFile)) {
            console.log(`\nImporting units & assessments from ${unitsFile}...`);
            const unitsData = JSON.parse(fs.readFileSync(unitsFile, "utf8"));
            const units = unitsData.units || [];

            // Pre-fetch type names and difficulty names for lookup
            const [typeRows] = await connection.query("SELECT quiz_type_id, type_name FROM quiz_type_tbl");
            const typeMap = new Map(typeRows.map((t) => [String(t.type_name).toUpperCase(), Number(t.quiz_type_id)]));
            const [diffRows] = await connection.query("SELECT difficulty_id, difficulty_name FROM difficulty_tbl");
            const diffMap = new Map(diffRows.map((d) => [String(d.difficulty_name).toLowerCase(), Number(d.difficulty_id)]));

            for (const u of units) {
                // Upsert unit_tbl
                const status = u.status || "approved";
                const authorId = u.author_id ?? null;
                const note = u.pending_note ?? null;

                const sql = `
                    INSERT INTO unit_tbl (unit_id, unit_title, sec_id, author_id, status, pending_note, lesson_format)
                    VALUES (?, ?, ?, ?, ?, ?, 'slides')
                    ON DUPLICATE KEY UPDATE
                        unit_title = VALUES(unit_title),
                        sec_id = VALUES(sec_id),
                        author_id = VALUES(author_id),
                        status = VALUES(status),
                        pending_note = VALUES(pending_note)
                `;
                await connection.execute(sql, [
                    u.unit_id,
                    u.unit_title,
                    u.sec_id,
                    authorId,
                    status,
                    note,
                ]);

                // Clear child rows for clean restore
                await connection.query("DELETE FROM lesson_slide_tbl WHERE unit_id = ?", [u.unit_id]);
                await connection.query("DELETE FROM quiz_tbl WHERE unit_id = ?", [u.unit_id]);
                await connection.query("DELETE FROM unit_assessment_tbl WHERE unit_id = ?", [u.unit_id]);

                // 2a. Restore slides
                const lessonCard = u.unit_lesson_card_json;
                const slides = lessonCard?.lesson_slide || lessonCard?.lesson_slides || [];
                if (Array.isArray(slides)) {
                    for (let sIdx = 0; sIdx < slides.length; sIdx++) {
                        const s = slides[sIdx];
                        await connection.query(
                            `INSERT INTO lesson_slide_tbl (unit_id, slide_order, slide_title, slide_text, slide_code)
                             VALUES (?, ?, ?, ?, ?)`,
                            [
                                u.unit_id,
                                sIdx + 1,
                                String(s.lesson_title ?? s.slide_title ?? s.title ?? `Slide ${sIdx + 1}`),
                                String(s.lesson_text ?? s.slide_text ?? s.text ?? ""),
                                s.lesson_code ?? s.slide_code ?? s.code ?? null,
                            ],
                        );
                    }
                }

                // 2b. Restore quizzes
                const quizzes = Array.isArray(u.unit_quiz_json) ? u.unit_quiz_json : [];
                for (let qIdx = 0; qIdx < quizzes.length; qIdx++) {
                    const q = quizzes[qIdx];
                    if (!q || typeof q !== "object") continue;

                    let quizTypeId = Number(q.quiz_type_id);
                    if (!quizTypeId || isNaN(quizTypeId)) {
                        quizTypeId = typeMap.get(String(q.type_name ?? q.type ?? "").toUpperCase()) ?? 1;
                    }
                    let difficultyId = Number(q.difficulty_id);
                    if (!difficultyId || isNaN(difficultyId)) {
                        difficultyId = diffMap.get(String(q.difficulty_name ?? q.difficulty ?? "beginner").toLowerCase()) ?? 1;
                    }

                    const questionText = String(q.question_text ?? "").trim() || "Quiz Question";
                    const quizOrder = Number(q.quiz_order ?? (qIdx + 1));

                    const [qRes] = await connection.query(
                        `INSERT INTO quiz_tbl (unit_id, difficulty_id, quiz_type_id, quiz_order, question_text)
                         VALUES (?, ?, ?, ?, ?)`,
                        [u.unit_id, difficultyId, quizTypeId, quizOrder, questionText],
                    );
                    const quizId = qRes.insertId;
                    const payload = q.quiz_payload || {};

                    if (quizTypeId === 1) {
                        const options = Array.isArray(payload.options) ? payload.options : [];
                        const correctIdx = Number(payload.correct_index ?? 0);
                        for (let optIdx = 0; optIdx < options.length; optIdx++) {
                            await connection.query(
                                `INSERT INTO quiz_mcq_option_tbl (quiz_id, option_index, option_text, is_correct)
                                 VALUES (?, ?, ?, ?)`,
                                [quizId, optIdx, String(options[optIdx]), optIdx === correctIdx ? 1 : 0],
                            );
                        }
                    } else if (quizTypeId === 2) {
                        const answer = String(payload.answer ?? payload.correct_answer ?? "");
                        await connection.query(
                            `INSERT INTO quiz_fitb_tbl (quiz_id, correct_answer) VALUES (?, ?)`,
                            [quizId, answer],
                        );
                    } else if (quizTypeId === 3) {
                        const items = Array.isArray(payload.items) ? payload.items : [];
                        for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
                            await connection.query(
                                `INSERT INTO quiz_order_item_tbl (quiz_id, canonical_order, item_text)
                                 VALUES (?, ?, ?)`,
                                [quizId, itemIdx + 1, String(items[itemIdx])],
                            );
                        }
                    } else if (quizTypeId === 4) {
                        const pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
                        for (let pIdx = 0; pIdx < pairs.length; pIdx++) {
                            const p = pairs[pIdx];
                            await connection.query(
                                `INSERT INTO quiz_pair_tbl (quiz_id, pair_order, left_text, right_text)
                                 VALUES (?, ?, ?, ?)`,
                                [quizId, pIdx + 1, String(p?.left ?? ""), String(p?.right ?? "")],
                            );
                        }
                    } else if (quizTypeId === 5) {
                        await connection.query(
                            `INSERT INTO quiz_cp_tbl (quiz_id, title) VALUES (?, ?)`,
                            [quizId, String(payload.title ?? questionText)],
                        );
                        const cpSteps = Array.isArray(payload.steps) ? payload.steps : [];
                        for (let csIdx = 0; csIdx < cpSteps.length; csIdx++) {
                            const cs = cpSteps[csIdx];
                            await connection.query(
                                `INSERT INTO quiz_cp_step_tbl (quiz_id, step_order, prompt, template_code, expected_code)
                                 VALUES (?, ?, ?, ?, ?)`,
                                [quizId, csIdx + 1, String(cs?.prompt ?? ""), String(cs?.template ?? ""), String(cs?.expected ?? "")],
                            );
                        }
                    }
                }

                // 2c. Restore assessment
                const assessment = u.unit_assessment_json;
                if (assessment && typeof assessment === "object") {
                    const title = String(assessment.title || u.unit_title);
                    const desc = String(assessment.description || "");
                    const expectedOutcome = String(assessment.expected_outcome || "");

                    const [aRes] = await connection.query(
                        `INSERT INTO unit_assessment_tbl (unit_id, title, description, expected_outcome)
                         VALUES (?, ?, ?, ?)`,
                        [u.unit_id, title, desc, expectedOutcome],
                    );
                    const assessmentId = aRes.insertId;

                    const cpSteps = Array.isArray(assessment.cp_steps)
                        ? assessment.cp_steps
                        : Array.isArray(assessment.steps) && typeof assessment.steps[0] === "object"
                            ? assessment.steps
                            : [];

                    for (let sIdx = 0; sIdx < cpSteps.length; sIdx++) {
                        const step = cpSteps[sIdx];
                        await connection.query(
                            `INSERT INTO assessment_step_tbl (
                               assessment_id, step_number, instruction, inherit_previous_code,
                               starter_html, starter_css, starter_js,
                               expected_html, expected_css, expected_js
                             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                assessmentId,
                                Number(step.stepNumber ?? (sIdx + 1)),
                                String(step.instruction ?? step.prompt ?? `Step ${sIdx + 1}`),
                                step.inheritPreviousCode ? 1 : 0,
                                step.starterCode?.html ?? null,
                                step.starterCode?.css ?? null,
                                step.starterCode?.js ?? null,
                                step.expectedTemplate?.html ?? null,
                                step.expectedTemplate?.css ?? null,
                                step.expectedTemplate?.js ?? null,
                            ],
                        );
                    }
                }
            }
            console.log(` - Restored ${units.length} curriculum units.`);
        }

        console.log("\n✅ Transfer/Import completed successfully.");
    } finally {
        await connection.query("SET FOREIGN_KEY_CHECKS = 1");
        await connection.end();
    }
}

importAll().catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
});
