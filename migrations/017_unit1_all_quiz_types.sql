-- =============================================================================
-- Migration: 017_unit1_all_quiz_types.sql
-- Description: Idempotently ensures Unit 1 of Section 1 ("Getting Started")
--              includes at least one quiz of every interactive type (MCQ, FITB,
--              Order, Pair) and a Code Problem assessment (CP) so learners in
--              Unit 1 experience all tutorial walkthroughs.
-- Engine: MySQL 8.0+
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Ensure core quiz_type_tbl lookup rows exist
INSERT IGNORE INTO `quiz_type_tbl` (`quiz_type_id`, `type_name`) VALUES
  (1, 'MCQ'),
  (2, 'FITB'),
  (3, 'Order'),
  (4, 'Pair'),
  (5, 'CP');

-- Resolve Unit 1 of Section 1 (falling back to unit_id = 98 if present)
SET @u1_id = (
    SELECT `unit_id`
    FROM `unit_tbl`
    WHERE `sec_id` = 1 AND `unit_order` = 1
    ORDER BY `unit_id` ASC
    LIMIT 1
);
SET @u1_id = COALESCE(
    @u1_id,
    (SELECT `unit_id` FROM `unit_tbl` WHERE `unit_id` = 98 LIMIT 1)
);

-- -----------------------------------------------------------------------------
-- 1. Ensure MCQ (quiz_type_id = 1)
-- -----------------------------------------------------------------------------
SET @has_mcq = IF(
    @u1_id IS NULL,
    1,
    EXISTS(SELECT 1 FROM `quiz_tbl` WHERE `unit_id` = @u1_id AND `quiz_type_id` = 1)
);
SET @next_order = COALESCE(
    (SELECT MAX(`quiz_order`) FROM `quiz_tbl` WHERE `unit_id` = @u1_id),
    0
) + 1;

INSERT INTO `quiz_tbl` (`unit_id`, `difficulty_id`, `quiz_type_id`, `quiz_order`, `question_text`)
SELECT @u1_id, 1, 1, @next_order, 'Which HTML tag creates the largest, main heading on a webpage?'
FROM DUAL
WHERE @has_mcq = 0;

SET @mcq_quiz_id = IF(@has_mcq = 0 AND ROW_COUNT() > 0, LAST_INSERT_ID(), NULL);

INSERT IGNORE INTO `quiz_mcq_option_tbl` (`quiz_id`, `option_index`, `option_text`, `is_correct`)
SELECT @mcq_quiz_id, 0, '<h1>', 1 FROM DUAL WHERE @mcq_quiz_id IS NOT NULL AND @mcq_quiz_id > 0
UNION ALL
SELECT @mcq_quiz_id, 1, '<head>', 0 FROM DUAL WHERE @mcq_quiz_id IS NOT NULL AND @mcq_quiz_id > 0
UNION ALL
SELECT @mcq_quiz_id, 2, '<title>', 0 FROM DUAL WHERE @mcq_quiz_id IS NOT NULL AND @mcq_quiz_id > 0
UNION ALL
SELECT @mcq_quiz_id, 3, '<p>', 0 FROM DUAL WHERE @mcq_quiz_id IS NOT NULL AND @mcq_quiz_id > 0;

-- -----------------------------------------------------------------------------
-- 2. Ensure FITB (quiz_type_id = 2)
-- -----------------------------------------------------------------------------
SET @has_fitb = IF(
    @u1_id IS NULL,
    1,
    EXISTS(SELECT 1 FROM `quiz_tbl` WHERE `unit_id` = @u1_id AND `quiz_type_id` = 2)
);
SET @next_order = COALESCE(
    (SELECT MAX(`quiz_order`) FROM `quiz_tbl` WHERE `unit_id` = @u1_id),
    0
) + 1;

INSERT INTO `quiz_tbl` (`unit_id`, `difficulty_id`, `quiz_type_id`, `quiz_order`, `question_text`)
SELECT @u1_id, 1, 2, @next_order, 'Type the HTML tag name (without angle brackets) used to create a paragraph: <___>Hello</___>.'
FROM DUAL
WHERE @has_fitb = 0;

SET @fitb_quiz_id = IF(@has_fitb = 0 AND ROW_COUNT() > 0, LAST_INSERT_ID(), NULL);

INSERT IGNORE INTO `quiz_fitb_tbl` (`quiz_id`, `correct_answer`)
SELECT @fitb_quiz_id, 'p'
FROM DUAL
WHERE @fitb_quiz_id IS NOT NULL AND @fitb_quiz_id > 0;

-- -----------------------------------------------------------------------------
-- 3. Ensure Order (quiz_type_id = 3)
-- -----------------------------------------------------------------------------
SET @has_order = IF(
    @u1_id IS NULL,
    1,
    EXISTS(SELECT 1 FROM `quiz_tbl` WHERE `unit_id` = @u1_id AND `quiz_type_id` = 3)
);
SET @next_order = COALESCE(
    (SELECT MAX(`quiz_order`) FROM `quiz_tbl` WHERE `unit_id` = @u1_id),
    0
) + 1;

INSERT INTO `quiz_tbl` (`unit_id`, `difficulty_id`, `quiz_type_id`, `quiz_order`, `question_text`)
SELECT @u1_id, 1, 3, @next_order, 'Arrange the parts of a complete HTML heading element in order from start to finish.'
FROM DUAL
WHERE @has_order = 0;

SET @order_quiz_id = IF(@has_order = 0 AND ROW_COUNT() > 0, LAST_INSERT_ID(), NULL);

INSERT IGNORE INTO `quiz_order_item_tbl` (`quiz_id`, `canonical_order`, `item_text`)
SELECT @order_quiz_id, 1, '<h1>' FROM DUAL WHERE @order_quiz_id IS NOT NULL AND @order_quiz_id > 0
UNION ALL
SELECT @order_quiz_id, 2, 'Welcome to HTML' FROM DUAL WHERE @order_quiz_id IS NOT NULL AND @order_quiz_id > 0
UNION ALL
SELECT @order_quiz_id, 3, '</h1>' FROM DUAL WHERE @order_quiz_id IS NOT NULL AND @order_quiz_id > 0;

-- -----------------------------------------------------------------------------
-- 4. Ensure Pair (quiz_type_id = 4)
-- -----------------------------------------------------------------------------
SET @has_pair = IF(
    @u1_id IS NULL,
    1,
    EXISTS(SELECT 1 FROM `quiz_tbl` WHERE `unit_id` = @u1_id AND `quiz_type_id` = 4)
);
SET @next_order = COALESCE(
    (SELECT MAX(`quiz_order`) FROM `quiz_tbl` WHERE `unit_id` = @u1_id),
    0
) + 1;

INSERT INTO `quiz_tbl` (`unit_id`, `difficulty_id`, `quiz_type_id`, `quiz_order`, `question_text`)
SELECT @u1_id, 1, 4, @next_order, 'Match each fundamental HTML tag on the left with what it creates on the right.'
FROM DUAL
WHERE @has_pair = 0;

SET @pair_quiz_id = IF(@has_pair = 0 AND ROW_COUNT() > 0, LAST_INSERT_ID(), NULL);

INSERT IGNORE INTO `quiz_pair_tbl` (`quiz_id`, `pair_order`, `left_text`, `right_text`)
SELECT @pair_quiz_id, 1, '<h1>', 'Main heading' FROM DUAL WHERE @pair_quiz_id IS NOT NULL AND @pair_quiz_id > 0
UNION ALL
SELECT @pair_quiz_id, 2, '<p>', 'Paragraph text' FROM DUAL WHERE @pair_quiz_id IS NOT NULL AND @pair_quiz_id > 0
UNION ALL
SELECT @pair_quiz_id, 3, '<a>', 'Hyperlink' FROM DUAL WHERE @pair_quiz_id IS NOT NULL AND @pair_quiz_id > 0;

-- -----------------------------------------------------------------------------
-- 5. Ensure fallback Code Problem (CP) assessment on Unit 1 if missing
-- -----------------------------------------------------------------------------
SET @has_cp = IF(
    @u1_id IS NULL,
    1,
    EXISTS(SELECT 1 FROM `unit_assessment_tbl` WHERE `unit_id` = @u1_id)
);

INSERT INTO `unit_assessment_tbl` (`unit_id`, `title`, `description`, `expected_outcome`)
SELECT
    @u1_id,
    'Getting Started HTML Webpage',
    'Build a starter HTML heading and paragraph in the live code editor.',
    'The preview renders an h1 heading and a paragraph element.'
FROM DUAL
WHERE @has_cp = 0;

SET @cp_assessment_id = IF(@has_cp = 0 AND ROW_COUNT() > 0, LAST_INSERT_ID(), NULL);

INSERT IGNORE INTO `assessment_step_tbl` (
    `assessment_id`,
    `step_number`,
    `instruction`,
    `inherit_previous_code`,
    `starter_html`,
    `starter_css`,
    `starter_js`,
    `expected_html`,
    `expected_css`,
    `expected_js`
)
SELECT
    @cp_assessment_id,
    1,
    'Inside <body>, add an <h1> element that says "Hello HTML".',
    0,
    '<!-- Add your <h1> heading here -->',
    '',
    '',
    '<h1>Hello HTML</h1>',
    '',
    ''
FROM DUAL
WHERE @cp_assessment_id IS NOT NULL AND @cp_assessment_id > 0
UNION ALL
SELECT
    @cp_assessment_id,
    2,
    'Below the heading, add a <p> element with any introductory sentence.',
    1,
    '',
    '',
    '',
    '<h1>Hello HTML</h1>\n<p>Learning web development</p>',
    '',
    ''
FROM DUAL
WHERE @cp_assessment_id IS NOT NULL AND @cp_assessment_id > 0;

-- -----------------------------------------------------------------------------
-- 6. Record migration in _migrations table
-- -----------------------------------------------------------------------------
INSERT IGNORE INTO `_migrations` (`name`) VALUES ('017_unit1_all_quiz_types.sql');

SET FOREIGN_KEY_CHECKS = 1;
