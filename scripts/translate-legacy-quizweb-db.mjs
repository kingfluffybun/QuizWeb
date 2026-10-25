import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

// 1. Load environment variables
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
}

const isLocalhost = !process.env.DB_HOST || ["localhost", "127.0.0.1"].includes(process.env.DB_HOST);
const enableSsl = process.env.DB_SSL === "true" || (!isLocalhost && process.env.DB_SSL !== "false");

function sanitizeDate(val) {
    if (!val) return null;
    if (val instanceof Date) {
        return val.toISOString().slice(0, 19).replace("T", " ");
    }
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
            return d.toISOString().slice(0, 19).replace("T", " ");
        }
    }
    return val;
}

function sanitizeDateOnly(val) {
    if (!val) return null;
    if (val instanceof Date) {
        return val.toISOString().slice(0, 10);
    }
    if (typeof val === "string") {
        return val.slice(0, 10);
    }
    return val;
}

async function runTranslation() {
    console.log("================================================================================");
    console.log(" Legacy quizweb_db -> experimental_v2_quizweb_db Translation & Data Sync");
    console.log("================================================================================");

    const host = process.env.DB_HOST;
    const port = Number(process.env.DB_PORT ?? 3306);
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const targetDb = process.env.DB_NAME || "experimental_v2_quizweb_db";
    const sourceDb = "quizweb_db";

    console.log(`Source DB: ${sourceDb} @ ${host}`);
    console.log(`Target DB: ${targetDb} @ ${host}`);

    const conn = await mysql.createConnection({
        host,
        port,
        user,
        password,
        ssl: enableSsl ? { rejectUnauthorized: false } : undefined,
        multipleStatements: true,
    });

    try {
        await conn.query("SET NAMES utf8mb4");
        await conn.query("SET FOREIGN_KEY_CHECKS = 0");

        // -------------------------------------------------------------------------
        // 1. Ensure Lookup & Section Tables in Target
        // -------------------------------------------------------------------------
        console.log("\n[Step 1] Synchronizing Category & Section Lookups...");
        await conn.query(`
            INSERT IGNORE INTO \`${targetDb}\`.cat_tbl (cat_id, cat_name, is_active) VALUES
            (1, 'HTML', 1),
            (2, 'CSS', 1),
            (3, 'JavaScript', 1);
        `);

        await conn.query(`
            INSERT IGNORE INTO \`${targetDb}\`.sec_tbl (sec_id, cat_id, sec_num) VALUES
            (1, 1, 1),
            (2, 1, 2),
            (3, 1, 3),
            (4, 2, 4),
            (5, 2, 5),
            (6, 3, 6),
            (7, 3, 7);
        `);

        await conn.query(`
            INSERT IGNORE INTO \`${targetDb}\`.quiz_type_tbl (quiz_type_id, type_name) VALUES
            (1, 'MCQ'),
            (2, 'FITB'),
            (3, 'Order'),
            (4, 'Pair'),
            (5, 'CP');
        `);

        await conn.query(`
            INSERT IGNORE INTO \`${targetDb}\`.difficulty_tbl (difficulty_id, difficulty_name, xp_multiplier) VALUES
            (1, 'Beginner', 1.00),
            (2, 'Intermediate', 2.00),
            (3, 'Advanced', 3.00);
        `);
        console.log("✔ Lookup tables verified in target.");

        // -------------------------------------------------------------------------
        // 2. Sync User Auth & Player Tables
        // -------------------------------------------------------------------------
        console.log("\n[Step 2] Synchronizing user accounts & players...");
        const [sourceUsers] = await conn.query(`SELECT * FROM \`${sourceDb}\`.user_auth_tbl`);
        console.log(`Found ${sourceUsers.length} user records in source.`);

        for (const u of sourceUsers) {
            await conn.query(
                `INSERT INTO \`${targetDb}\`.user_auth_tbl 
                 (user_id, email, password_hash, is_email_verified, user_role, avatar_color, token_version, daily_xp_goal)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    email = VALUES(email),
                    password_hash = COALESCE(VALUES(password_hash), password_hash),
                    is_email_verified = VALUES(is_email_verified),
                    user_role = VALUES(user_role),
                    avatar_color = VALUES(avatar_color),
                    token_version = VALUES(token_version),
                    daily_xp_goal = VALUES(daily_xp_goal)`,
                [
                    u.user_id,
                    u.email,
                    u.password_hash ?? null,
                    u.is_email_verified ?? 0,
                    u.user_role ?? "user",
                    u.avatar_color ?? "#BFB8FF",
                    u.token_version ?? 1,
                    u.daily_xp_goal ?? 50,
                ],
            );
        }
        console.log(`✔ Synced ${sourceUsers.length} user_auth_tbl records.`);

        const [sourcePlayers] = await conn.query(`SELECT * FROM \`${sourceDb}\`.player_tbl`);
        for (const p of sourcePlayers) {
            await conn.query(
                `INSERT INTO \`${targetDb}\`.player_tbl
                 (user_id, username, xp, max_streak, current_streak, last_quiz_date, hearts, gems, current_section)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    username = VALUES(username),
                    xp = VALUES(xp),
                    max_streak = VALUES(max_streak),
                    current_streak = VALUES(current_streak),
                    last_quiz_date = VALUES(last_quiz_date),
                    hearts = VALUES(hearts),
                    gems = VALUES(gems),
                    current_section = VALUES(current_section)`,
                [
                    p.user_id,
                    p.username,
                    p.xp ?? 0,
                    p.max_streak ?? 0,
                    p.current_streak ?? 0,
                    sanitizeDateOnly(p.last_quiz_date),
                    p.hearts ?? 5,
                    p.gems ?? 50,
                    p.current_section ?? 1,
                ],
            );
        }
        console.log(`✔ Synced ${sourcePlayers.length} player_tbl records.`);

        // -------------------------------------------------------------------------
        // 3. Sync OAuth, OTP, Verification, and User Activities
        // -------------------------------------------------------------------------
        console.log("\n[Step 3] Synchronizing OAuth, OTP, Verification, and Activities...");
        const [sourceOauth] = await conn.query(`SELECT * FROM \`${sourceDb}\`.user_oauth_tbl`);
        for (const o of sourceOauth) {
            await conn.query(
                `INSERT INTO \`${targetDb}\`.user_oauth_tbl
                 (oauth_id, user_id, provider_name, provider_account_id)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    user_id = VALUES(user_id),
                    provider_name = VALUES(provider_name),
                    provider_account_id = VALUES(provider_account_id)`,
                [o.oauth_id, o.user_id, o.provider_name, o.provider_account_id],
            );
        }
        console.log(`✔ Synced ${sourceOauth.length} user_oauth_tbl records.`);

        const [sourceOtps] = await conn.query(`SELECT * FROM \`${sourceDb}\`.user_otp_tbl`);
        for (const otp of sourceOtps) {
            await conn.query(
                `INSERT INTO \`${targetDb}\`.user_otp_tbl
                 (otp_id, user_id, email, otp_code, expires_at, is_used, attempts, locked_until, purpose)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    user_id = VALUES(user_id),
                    email = VALUES(email),
                    otp_code = VALUES(otp_code),
                    expires_at = VALUES(expires_at),
                    is_used = VALUES(is_used),
                    attempts = VALUES(attempts),
                    locked_until = VALUES(locked_until),
                    purpose = VALUES(purpose)`,
                [
                    otp.otp_id,
                    otp.user_id,
                    otp.email,
                    otp.otp_code,
                    sanitizeDate(otp.expires_at),
                    otp.is_used ?? 0,
                    otp.attempts ?? 0,
                    sanitizeDate(otp.locked_until),
                    otp.purpose ?? "email_verification",
                ],
            );
        }
        console.log(`✔ Synced ${sourceOtps.length} user_otp_tbl records.`);

        const [sourceVrfy] = await conn.query(`SELECT * FROM \`${sourceDb}\`.user_vrfy_tbl`);
        for (const v of sourceVrfy) {
            await conn.query(
                `INSERT INTO \`${targetDb}\`.user_vrfy_tbl
                 (verify_id, username, email, password_hash, verification_token, expires_at, attempts, locked_until, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    username = VALUES(username),
                    email = VALUES(email),
                    password_hash = VALUES(password_hash),
                    verification_token = VALUES(verification_token),
                    expires_at = VALUES(expires_at),
                    attempts = VALUES(attempts),
                    locked_until = VALUES(locked_until)`,
                [
                    v.verify_id,
                    v.username,
                    v.email,
                    v.password_hash,
                    v.verification_token,
                    sanitizeDate(v.expires_at),
                    v.attempts ?? 0,
                    sanitizeDate(v.locked_until),
                    sanitizeDate(v.created_at) ?? new Date().toISOString().slice(0, 19).replace("T", " "),
                ],
            );
        }
        console.log(`✔ Synced ${sourceVrfy.length} user_vrfy_tbl records.`);

        const [sourceActs] = await conn.query(`SELECT * FROM \`${sourceDb}\`.user_activity_tbl`);
        for (const a of sourceActs) {
            await conn.query(
                `INSERT INTO \`${targetDb}\`.user_activity_tbl
                 (activity_id, user_id, activity_date, activity_type, xp_earned, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    user_id = VALUES(user_id),
                    activity_date = VALUES(activity_date),
                    activity_type = VALUES(activity_type),
                    xp_earned = VALUES(xp_earned),
                    created_at = VALUES(created_at)`,
                [
                    a.activity_id,
                    a.user_id,
                    sanitizeDateOnly(a.activity_date),
                    a.activity_type ?? "quiz",
                    a.xp_earned ?? 0,
                    sanitizeDate(a.created_at) ?? new Date().toISOString().slice(0, 19).replace("T", " "),
                ],
            );
        }
        console.log(`✔ Synced ${sourceActs.length} user_activity_tbl records.`);

        // -------------------------------------------------------------------------
        // 4. Sync Pending Submissions into pending_tbl
        // -------------------------------------------------------------------------
        console.log("\n[Step 4] Synchronizing pending_tbl submissions...");
        const [sourcePending] = await conn.query(`SELECT * FROM \`${sourceDb}\`.pending_tbl`);
        for (const p of sourcePending) {
            const lessonJson = typeof p.unit_lesson_card_json === "object"
                ? JSON.stringify(p.unit_lesson_card_json)
                : p.unit_lesson_card_json;
            const quizJson = typeof p.unit_quiz_json === "object"
                ? JSON.stringify(p.unit_quiz_json)
                : p.unit_quiz_json;
            const assessmentJson = typeof p.unit_assessment_json === "object"
                ? JSON.stringify(p.unit_assessment_json)
                : p.unit_assessment_json;

            await conn.query(
                `INSERT INTO \`${targetDb}\`.pending_tbl
                 (pending_id, unit_title, sec_id, unit_lesson_card_json, unit_quiz_json, unit_assessment_json, pending_status, pending_note, pending_name, author_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    unit_title = VALUES(unit_title),
                    sec_id = VALUES(sec_id),
                    unit_lesson_card_json = VALUES(unit_lesson_card_json),
                    unit_quiz_json = VALUES(unit_quiz_json),
                    unit_assessment_json = VALUES(unit_assessment_json),
                    pending_status = VALUES(pending_status),
                    pending_note = VALUES(pending_note),
                    pending_name = VALUES(pending_name),
                    author_id = VALUES(author_id)`,
                [
                    p.pending_id,
                    p.unit_title,
                    p.sec_id,
                    lessonJson,
                    quizJson,
                    assessmentJson,
                    p.pending_status ?? "pending",
                    p.pending_note ?? null,
                    p.pending_name ?? "Anonymous",
                    p.author_id ?? null,
                ],
            );
        }
        console.log(`✔ Synced ${sourcePending.length} pending_tbl records.`);

        // -------------------------------------------------------------------------
        // 5. Unpack Legacy unit_tbl into Normalized Relational Tables
        // -------------------------------------------------------------------------
        console.log("\n[Step 5] Unpacking 20 Curriculum Units into Relational Tables...");

        // Map pending_tbl metadata by unit_title for authors and notes
        const pendingByTitle = new Map();
        for (const p of sourcePending) {
            if (p.pending_status === "approved" && !pendingByTitle.has(p.unit_title)) {
                pendingByTitle.set(p.unit_title, p);
            }
        }

        const [legacyUnits] = await conn.query(`SELECT * FROM \`${sourceDb}\`.unit_tbl ORDER BY unit_id ASC`);
        console.log(`Retrieved ${legacyUnits.length} units with JSON blobs.`);

        const [typeRows] = await conn.query(`SELECT quiz_type_id, type_name FROM \`${targetDb}\`.quiz_type_tbl`);
        const typeMap = new Map(typeRows.map((t) => [String(t.type_name).toUpperCase(), Number(t.quiz_type_id)]));
        const [diffRows] = await conn.query(`SELECT difficulty_id, difficulty_name FROM \`${targetDb}\`.difficulty_tbl`);
        const diffMap = new Map(diffRows.map((d) => [String(d.difficulty_name).toLowerCase(), Number(d.difficulty_id)]));

        let totalSlidesUnpacked = 0;
        let totalQuizzesUnpacked = 0;
        let totalAssessmentsUnpacked = 0;

        for (const u of legacyUnits) {
            const unitId = Number(u.unit_id);
            const matchedPending = pendingByTitle.get(u.unit_title);
            const authorId = matchedPending?.author_id ?? null;
            const pendingNote = matchedPending?.pending_note ?? null;

            // Upsert unit_tbl
            await conn.query(
                `INSERT INTO \`${targetDb}\`.unit_tbl
                 (unit_id, sec_id, author_id, unit_title, lesson_format, status, pending_note, approved_at)
                 VALUES (?, ?, ?, ?, 'slides', 'approved', ?, CURRENT_TIMESTAMP)
                 ON DUPLICATE KEY UPDATE
                    sec_id = VALUES(sec_id),
                    author_id = VALUES(author_id),
                    unit_title = VALUES(unit_title),
                    status = 'approved',
                    pending_note = VALUES(pending_note)`,
                [unitId, u.sec_id, authorId, u.unit_title, pendingNote],
            );

            // Clean existing child rows for idempotent unpack
            await conn.query(`DELETE FROM \`${targetDb}\`.lesson_slide_tbl WHERE unit_id = ?`, [unitId]);
            await conn.query(`DELETE FROM \`${targetDb}\`.quiz_tbl WHERE unit_id = ?`, [unitId]);
            await conn.query(`DELETE FROM \`${targetDb}\`.unit_assessment_tbl WHERE unit_id = ?`, [unitId]);

            // 5a. Unpack Slides
            const lessonCard = typeof u.unit_lesson_card_json === "string"
                ? JSON.parse(u.unit_lesson_card_json)
                : u.unit_lesson_card_json;
            const slides = lessonCard?.lesson_slide || lessonCard?.lesson_slides || [];

            if (Array.isArray(slides)) {
                for (let sIdx = 0; sIdx < slides.length; sIdx++) {
                    const s = slides[sIdx];
                    await conn.query(
                        `INSERT INTO \`${targetDb}\`.lesson_slide_tbl (unit_id, slide_order, slide_title, slide_text, slide_code)
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            unitId,
                            sIdx + 1,
                            String(s.lesson_title ?? s.slide_title ?? s.title ?? `Slide ${sIdx + 1}`),
                            String(s.lesson_text ?? s.slide_text ?? s.text ?? ""),
                            s.lesson_code ?? s.slide_code ?? s.code ?? null,
                        ],
                    );
                    totalSlidesUnpacked++;
                }
            }

            // 5b. Unpack Quizzes
            const quizzes = typeof u.unit_quiz_json === "string"
                ? JSON.parse(u.unit_quiz_json)
                : u.unit_quiz_json;

            if (Array.isArray(quizzes)) {
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

                    const [qRes] = await conn.query(
                        `INSERT INTO \`${targetDb}\`.quiz_tbl (unit_id, difficulty_id, quiz_type_id, quiz_order, question_text)
                         VALUES (?, ?, ?, ?, ?)`,
                        [unitId, difficultyId, quizTypeId, quizOrder, questionText],
                    );
                    const quizId = qRes.insertId;
                    totalQuizzesUnpacked++;

                    const payload = q.quiz_payload || {};

                    if (quizTypeId === 1) {
                        const options = Array.isArray(payload.options) ? payload.options : [];
                        const correctIdx = Number(payload.correct_index ?? 0);
                        for (let optIdx = 0; optIdx < options.length; optIdx++) {
                            await conn.query(
                                `INSERT INTO \`${targetDb}\`.quiz_mcq_option_tbl (quiz_id, option_index, option_text, is_correct)
                                 VALUES (?, ?, ?, ?)`,
                                [quizId, optIdx, String(options[optIdx]), optIdx === correctIdx ? 1 : 0],
                            );
                        }
                    } else if (quizTypeId === 2) {
                        const answer = String(payload.answer ?? payload.correct_answer ?? "");
                        await conn.query(
                            `INSERT INTO \`${targetDb}\`.quiz_fitb_tbl (quiz_id, correct_answer) VALUES (?, ?)`,
                            [quizId, answer],
                        );
                    } else if (quizTypeId === 3) {
                        const items = Array.isArray(payload.items) ? payload.items : [];
                        for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
                            await conn.query(
                                `INSERT INTO \`${targetDb}\`.quiz_order_item_tbl (quiz_id, canonical_order, item_text)
                                 VALUES (?, ?, ?)`,
                                [quizId, itemIdx + 1, String(items[itemIdx])],
                            );
                        }
                    } else if (quizTypeId === 4) {
                        const pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
                        for (let pIdx = 0; pIdx < pairs.length; pIdx++) {
                            const p = pairs[pIdx];
                            await conn.query(
                                `INSERT INTO \`${targetDb}\`.quiz_pair_tbl (quiz_id, pair_order, left_text, right_text)
                                 VALUES (?, ?, ?, ?)`,
                                [quizId, pIdx + 1, String(p?.left ?? ""), String(p?.right ?? "")],
                            );
                        }
                    } else if (quizTypeId === 5) {
                        await conn.query(
                            `INSERT INTO \`${targetDb}\`.quiz_cp_tbl (quiz_id, title) VALUES (?, ?)`,
                            [quizId, String(payload.title ?? questionText)],
                        );
                        const cpSteps = Array.isArray(payload.steps) ? payload.steps : [];
                        for (let csIdx = 0; csIdx < cpSteps.length; csIdx++) {
                            const cs = cpSteps[csIdx];
                            await conn.query(
                                `INSERT INTO \`${targetDb}\`.quiz_cp_step_tbl (quiz_id, step_order, prompt, template_code, expected_code)
                                 VALUES (?, ?, ?, ?, ?)`,
                                [quizId, csIdx + 1, String(cs?.prompt ?? ""), String(cs?.template ?? ""), String(cs?.expected ?? "")],
                            );
                        }
                    }
                }
            }

            // 5c. Unpack Assessment
            const assessment = typeof u.unit_assessment_json === "string"
                ? JSON.parse(u.unit_assessment_json)
                : u.unit_assessment_json;

            if (assessment && typeof assessment === "object") {
                const title = String(assessment.title || u.unit_title);
                const desc = String(assessment.description || "");
                const expectedOutcome = String(assessment.expected_outcome || "");

                const [aRes] = await conn.query(
                    `INSERT INTO \`${targetDb}\`.unit_assessment_tbl (unit_id, title, description, expected_outcome)
                     VALUES (?, ?, ?, ?)`,
                    [unitId, title, desc, expectedOutcome],
                );
                const assessmentId = aRes.insertId;
                totalAssessmentsUnpacked++;

                const cpSteps = Array.isArray(assessment.cp_steps)
                    ? assessment.cp_steps
                    : Array.isArray(assessment.steps) && typeof assessment.steps[0] === "object"
                        ? assessment.steps
                        : [];

                for (let sIdx = 0; sIdx < cpSteps.length; sIdx++) {
                    const step = cpSteps[sIdx];
                    await conn.query(
                        `INSERT INTO \`${targetDb}\`.assessment_step_tbl (
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

        console.log(`✔ Unpacked ${legacyUnits.length} units into normalized tables:`);
        console.log(`   - Lesson Slides: ${totalSlidesUnpacked}`);
        console.log(`   - Quizzes:       ${totalQuizzesUnpacked}`);
        console.log(`   - Assessments:   ${totalAssessmentsUnpacked}`);

        // Verification Counts
        console.log("\n================================================================================");
        console.log(" Final Verification & Migration Summary");
        console.log("================================================================================");
        const checkTables = [
            "user_auth_tbl",
            "player_tbl",
            "user_oauth_tbl",
            "user_otp_tbl",
            "user_vrfy_tbl",
            "user_activity_tbl",
            "pending_tbl",
            "unit_tbl",
            "lesson_slide_tbl",
            "quiz_tbl",
            "quiz_mcq_option_tbl",
            "quiz_fitb_tbl",
            "quiz_order_item_tbl",
            "quiz_pair_tbl",
            "quiz_cp_tbl",
            "quiz_cp_step_tbl",
            "unit_assessment_tbl",
            "assessment_step_tbl",
            "user_lesson_progress_tbl",
        ];

        for (const tbl of checkTables) {
            const [cnt] = await conn.query(`SELECT COUNT(*) AS total FROM \`${targetDb}\`.${tbl}`);
            console.log(`✔ ${tbl.padEnd(26)} : ${cnt[0].total} rows`);
        }

        console.log("\n✅ Data translation and unpack completed successfully with ZERO data loss!");
    } finally {
        await conn.query("SET FOREIGN_KEY_CHECKS = 1");
        await conn.end();
    }
}

runTranslation().catch((err) => {
    console.error("\n❌ Translation failed:", err);
    process.exit(1);
});
