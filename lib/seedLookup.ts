import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

let hasCheckedLookupTables = false;

export async function ensureLookupTables(): Promise<void> {
    if (hasCheckedLookupTables) {
        return;
    }

    try {
        const [rows] = await db.query<RowDataPacket[]>("SELECT COUNT(*) as count FROM cat_tbl");
        const count = Number(rows[0]?.count ?? 0);

        if (count > 0) {
            hasCheckedLookupTables = true;
            return;
        }

        // 1. Categories
        await db.query(`
            INSERT INTO cat_tbl (cat_id, cat_name, is_active) VALUES
            (1, 'HTML', 1),
            (2, 'CSS', 1),
            (3, 'JavaScript', 1)
            ON DUPLICATE KEY UPDATE cat_name = VALUES(cat_name), is_active = VALUES(is_active)
        `);

        // 2. Sections
        await db.query(`
            INSERT INTO sec_tbl (sec_id, sec_num) VALUES
            (1, 1),
            (2, 2),
            (3, 3),
            (4, 4),
            (5, 5),
            (6, 6),
            (7, 7)
            ON DUPLICATE KEY UPDATE sec_num = VALUES(sec_num)
        `);

        // 3. Difficulties
        await db.query(`
            INSERT INTO difficulty_tbl (difficulty_id, difficulty_name, xp_multiplier) VALUES
            (1, 'Easy', 1.0),
            (2, 'Medium', 1.5),
            (3, 'Hard', 2.0)
            ON DUPLICATE KEY UPDATE difficulty_name = VALUES(difficulty_name), xp_multiplier = VALUES(xp_multiplier)
        `);

        // 4. Quiz Types
        await db.query(`
            INSERT INTO quiz_type_tbl (quiz_type_id, type_name) VALUES
            (1, 'MCQ'),
            (2, 'FITB'),
            (3, 'Order'),
            (4, 'Pair'),
            (5, 'CP')
            ON DUPLICATE KEY UPDATE type_name = VALUES(type_name)
        `);

        hasCheckedLookupTables = true;
    } catch (err) {
        console.error("ensureLookupTables error:", err);
    }

    try {
        await ensureHtmlSection4Questions();
    } catch (err) {
        console.error("ensureHtmlSection4Questions error:", err);
    }
}

export async function ensureHtmlSection4Questions(): Promise<void> {
    const [rows] = await db.query<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM quiz_tbl WHERE cat_id = 1 AND sec_id = 4"
    );
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) return;

    const questions = [
        // Easy (difficulty_id = 1)
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 1,
            quiz_type_id: 1, // MCQ
            question_text: "Which HTML element is used as a container to collect and submit user inputs?",
            quiz_payload: JSON.stringify({
                options: ["<form>", "<input>", "<fieldset>", "<section>"],
                correct_index: 0,
            }),
        },
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 1,
            quiz_type_id: 1, // MCQ
            question_text: "Which attribute of an <input> element determines whether it accepts text, numbers, passwords, or checkboxes?",
            quiz_payload: JSON.stringify({
                options: ["type", "name", "value", "class"],
                correct_index: 0,
            }),
        },
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 1,
            quiz_type_id: 2, // FITB
            question_text: "To make an input field mandatory before a form can be submitted, add the boolean attribute _______.",
            quiz_payload: JSON.stringify({
                answer: "required",
            }),
        },
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 1,
            quiz_type_id: 1, // MCQ
            question_text: "Which tag provides an accessible caption/label for a form control and expands its clickable target area?",
            quiz_payload: JSON.stringify({
                options: ["<label>", "<caption>", "<legend>", "<small>"],
                correct_index: 0,
            }),
        },
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 1,
            quiz_type_id: 2, // FITB
            question_text: "To link a <label> to an <input id=\"user-email\">, set the label's attribute to for=\"_______ \".",
            quiz_payload: JSON.stringify({
                answer: "user-email",
            }),
        },
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 1,
            quiz_type_id: 3, // Order
            question_text: "Arrange the code blocks to build a basic form with a text input and a submit button.",
            quiz_payload: JSON.stringify({
                items: [
                    "<form action=\"/submit\" method=\"POST\">",
                    "<label for=\"name\">Full Name:</label>",
                    "<input type=\"text\" id=\"name\" required />",
                    "<button type=\"submit\">Send</button>",
                    "</form>",
                ],
            }),
        },
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 1,
            quiz_type_id: 4, // Pair
            question_text: "Match each form input type to its primary usage.",
            quiz_payload: JSON.stringify({
                pairs: [
                    { left: "type=\"email\"", right: "Validates email address syntax" },
                    { left: "type=\"password\"", right: "Masks entered characters" },
                    { left: "type=\"checkbox\"", right: "Allows toggleable yes/no selection" },
                    { left: "type=\"submit\"", right: "Triggers form submission" },
                ],
            }),
        },

        // Medium (difficulty_id = 2)
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 2,
            quiz_type_id: 1, // MCQ
            question_text: "What is the primary difference between method=\"GET\" and method=\"POST\" in HTML forms?",
            quiz_payload: JSON.stringify({
                options: [
                    "GET appends form data to the URL query string; POST sends data in the HTTP request body",
                    "POST is only for search queries; GET is for passwords",
                    "GET encrypts form data automatically",
                    "POST cannot transmit string data",
                ],
                correct_index: 0,
            }),
        },
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 2,
            quiz_type_id: 2, // FITB
            question_text: "Which HTML element is used to capture multi-line plain text input from a user?",
            quiz_payload: JSON.stringify({
                answer: "textarea",
            }),
        },
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 2,
            quiz_type_id: 1, // MCQ
            question_text: "Which attribute provides temporary greyed-out sample text inside an input field that disappears upon user typing?",
            quiz_payload: JSON.stringify({
                options: ["placeholder", "value", "title", "hint"],
                correct_index: 0,
            }),
        },
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 2,
            quiz_type_id: 3, // Order
            question_text: "Arrange the components to construct a selectable dropdown menu with an option.",
            quiz_payload: JSON.stringify({
                items: [
                    "<select name=\"role\" id=\"role\">",
                    "<option value=\"\">Choose a role</option>",
                    "<option value=\"dev\">Developer</option>",
                    "<option value=\"designer\">Designer</option>",
                    "</select>",
                ],
            }),
        },
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 2,
            quiz_type_id: 4, // Pair
            question_text: "Match each form element to its specification.",
            quiz_payload: JSON.stringify({
                pairs: [
                    { left: "<textarea>", right: "Multi-line text input container" },
                    { left: "<select>", right: "Dropdown list of options" },
                    { left: "<fieldset>", right: "Groups related controls and labels" },
                    { left: "<legend>", right: "Caption for a fieldset grouping" },
                ],
            }),
        },

        // Hard (difficulty_id = 3)
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 3,
            quiz_type_id: 1, // MCQ
            question_text: "How do <fieldset> and <legend> assist screen reader users when navigating forms?",
            quiz_payload: JSON.stringify({
                options: [
                    "They announce the group context (legend) whenever each individual grouped control is focused",
                    "They visually center all form fields on screen",
                    "They disable browser autofill for sensitive credentials",
                    "They automatically validate all enclosed inputs with regex",
                ],
                correct_index: 0,
            }),
        },
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 3,
            quiz_type_id: 2, // FITB
            question_text: "Which attribute allows specifying a client-side regular expression pattern to validate user input on text inputs?",
            quiz_payload: JSON.stringify({
                answer: "pattern",
            }),
        },
        {
            cat_id: 1,
            sec_id: 4,
            difficulty_id: 3,
            quiz_type_id: 5, // CP
            question_text: "Build an accessible HTML form containing a label for email, an email input marked required, and a submit button.",
            quiz_payload: JSON.stringify({
                prompt: "Build an accessible HTML form containing a label for email, an email input marked required, and a submit button.",
                template: "<form>\n\n</form>",
                expected: "<form>\n  <label for=\"email\">Email</label>\n  <input type=\"email\" id=\"email\" required />\n  <button type=\"submit\">Submit</button>\n</form>",
                steps: [
                    {
                        prompt: "Add a label and required email input linked by id, plus a submit button.",
                        template: "<form>\n\n</form>",
                        expected: "<form>\n  <label for=\"email\">Email</label>\n  <input type=\"email\" id=\"email\" required />\n  <button type=\"submit\">Submit</button>\n</form>",
                    },
                ],
            }),
        },
    ];

    for (const q of questions) {
        await db.query(
            `INSERT INTO quiz_tbl (cat_id, sec_id, difficulty_id, quiz_type_id, question_text, quiz_payload)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [q.cat_id, q.sec_id, q.difficulty_id, q.quiz_type_id, q.question_text, q.quiz_payload]
        );
    }
}
