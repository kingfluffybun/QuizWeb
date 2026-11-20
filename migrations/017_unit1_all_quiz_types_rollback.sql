-- =============================================================================
-- Rollback for 017_unit1_all_quiz_types.sql
-- Removes only the synthetic onboarding quiz/assessment rows inserted by 017
-- (preserving any pre-existing Unit 1 quizzes and assessments).
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

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

DELETE FROM `quiz_tbl`
WHERE @u1_id IS NOT NULL
  AND `unit_id` = @u1_id
  AND `question_text` IN (
      'Which HTML tag creates the largest, main heading on a webpage?',
      'Type the HTML tag name (without angle brackets) used to create a paragraph: <___>Hello</___>.',
      'Arrange the parts of a complete HTML heading element in order from start to finish.',
      'Match each fundamental HTML tag on the left with what it creates on the right.'
  );

DELETE FROM `unit_assessment_tbl`
WHERE @u1_id IS NOT NULL
  AND `unit_id` = @u1_id
  AND `title` = 'Getting Started HTML Webpage';

DELETE FROM `_migrations`
WHERE `name` = '017_unit1_all_quiz_types.sql';

SET FOREIGN_KEY_CHECKS = 1;
