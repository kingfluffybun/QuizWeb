-- =============================================================================
-- Migration: 011_curriculum_level_progression.sql
-- Description: Establishes normalized 3-tier curriculum level progression system
--              (Beginner, Intermediate, Advanced) across 16 canonical sections,
--              canonical unit ordering, topics taxonomy, and foreign key integrity.
-- Engine: MySQL 8.0+
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. Schema Alterations (MySQL Idempotent Dynamic Statements)
-- -----------------------------------------------------------------------------

-- sec_tbl.sec_title
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sec_tbl'
      AND COLUMN_NAME = 'sec_title'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `sec_tbl` ADD COLUMN `sec_title` VARCHAR(100) NOT NULL DEFAULT \'\'',
    'DO 0'
);
PREPARE stmt_col1 FROM @sql_stmt;
EXECUTE stmt_col1;
DEALLOCATE PREPARE stmt_col1;

-- sec_tbl.difficulty_id
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sec_tbl'
      AND COLUMN_NAME = 'difficulty_id'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `sec_tbl` ADD COLUMN `difficulty_id` INT NOT NULL DEFAULT 1',
    'DO 0'
);
PREPARE stmt_col2 FROM @sql_stmt;
EXECUTE stmt_col2;
DEALLOCATE PREPARE stmt_col2;

-- unit_tbl.unit_order
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'unit_tbl'
      AND COLUMN_NAME = 'unit_order'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `unit_tbl` ADD COLUMN `unit_order` INT NOT NULL DEFAULT 1',
    'DO 0'
);
PREPARE stmt_col3 FROM @sql_stmt;
EXECUTE stmt_col3;
DEALLOCATE PREPARE stmt_col3;

-- unit_tbl.topics
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'unit_tbl'
      AND COLUMN_NAME = 'topics'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `unit_tbl` ADD COLUMN `topics` JSON NULL',
    'DO 0'
);
PREPARE stmt_col4 FROM @sql_stmt;
EXECUTE stmt_col4;
DEALLOCATE PREPARE stmt_col4;

-- -----------------------------------------------------------------------------
-- 2. Foreign Key Constraint for Section Difficulty
-- -----------------------------------------------------------------------------

SET @fk_exists = (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sec_tbl'
      AND CONSTRAINT_NAME = 'fk_sec_difficulty'
);
SET @sql_stmt = IF(
    @fk_exists = 0,
    'ALTER TABLE `sec_tbl` ADD CONSTRAINT `fk_sec_difficulty` FOREIGN KEY (`difficulty_id`) REFERENCES `difficulty_tbl` (`difficulty_id`) ON DELETE RESTRICT ON UPDATE CASCADE',
    'DO 0'
);
PREPARE stmt_fk FROM @sql_stmt;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- -----------------------------------------------------------------------------
-- 3. Canonical 16-Section Hierarchy Upsert
-- -----------------------------------------------------------------------------

DELETE FROM `sec_tbl`;

INSERT INTO `sec_tbl` (`sec_id`, `cat_id`, `sec_num`, `sec_title`, `difficulty_id`) VALUES
  -- Beginner Tier (difficulty_id = 1)
  (1, 1, 1, 'Getting Started', 1),
  (2, 1, 2, 'Linking Your World', 1),
  (3, 1, 3, 'Structuring Pages', 1),
  (4, 2, 1, 'Styling Basics', 1),
  (5, 2, 2, 'The Box Model', 1),
  (6, 2, 3, 'Visual Styling', 1),
  (7, 2, 4, 'Layout Foundations', 1),
  -- Intermediate Tier (difficulty_id = 2)
  (8, 3, 1, 'Programming Basics', 2),
  (9, 3, 2, 'Control Flow', 2),
  (10, 3, 3, 'Functions', 2),
  (11, 3, 4, 'Modern JS Syntax', 2),
  (12, 3, 5, 'Collections', 2),
  -- Advanced Tier (difficulty_id = 3)
  (13, 2, 5, 'Advanced Layout', 3),
  (14, 2, 6, 'Motion & Polish', 3),
  (15, 3, 6, 'The DOM', 3),
  (16, 3, 7, 'Working with Data', 3);

-- -----------------------------------------------------------------------------
-- 4. Re-map Live Units to Canonical Sections, Order, and Topics
-- -----------------------------------------------------------------------------

-- HTML Section 1: Getting Started (sec_id = 1, Beginner)
UPDATE `unit_tbl` SET
  `sec_id` = 1,
  `unit_order` = 1,
  `topics` = JSON_ARRAY('doctype', 'html tag', 'head', 'body', 'title', 'page skeleton')
WHERE `unit_id` = 98;

UPDATE `unit_tbl` SET
  `sec_id` = 1,
  `unit_order` = 2,
  `topics` = JSON_ARRAY('headings h1-h6', 'paragraphs', 'ordered list', 'unordered list', 'li', 'br', 'hr')
WHERE `unit_id` = 103;

-- HTML Section 2: Linking Your World (sec_id = 2, Beginner)
UPDATE `unit_tbl` SET
  `sec_id` = 2,
  `unit_order` = 1,
  `topics` = JSON_ARRAY('a tag', 'href', 'relative path', 'absolute path', 'target blank', 'mailto', 'tel')
WHERE `unit_id` = 105;

UPDATE `unit_tbl` SET
  `sec_id` = 2,
  `unit_order` = 2,
  `topics` = JSON_ARRAY('img tag', 'src', 'alt attribute', 'width height', 'audio tag', 'video tag', 'controls', 'iframe embed')
WHERE `unit_id` = 104;

-- HTML Section 3: Structuring Pages (sec_id = 3, Beginner)
UPDATE `unit_tbl` SET
  `sec_id` = 3,
  `unit_order` = 1,
  `topics` = JSON_ARRAY('header', 'nav', 'main', 'section', 'article', 'footer', 'accessibility', 'seo')
WHERE `unit_id` = 101;

UPDATE `unit_tbl` SET
  `sec_id` = 3,
  `unit_order` = 2,
  `topics` = JSON_ARRAY('div', 'span', 'block vs inline', 'class attribute', 'id attribute')
WHERE `unit_id` = 102;

-- CSS Section 1: Styling Basics (sec_id = 4, Beginner)
UPDATE `unit_tbl` SET
  `sec_id` = 4,
  `unit_order` = 1,
  `topics` = JSON_ARRAY('element selector', 'class selector', 'id selector', 'grouping selectors', 'specificity basics')
WHERE `unit_id` = 109;

UPDATE `unit_tbl` SET
  `sec_id` = 4,
  `unit_order` = 2,
  `topics` = JSON_ARRAY('external stylesheet', 'link tag', 'internal style', 'inline style', 'cascade')
WHERE `unit_id` = 110;

UPDATE `unit_tbl` SET
  `sec_id` = 4,
  `unit_order` = 3,
  `topics` = JSON_ARRAY(':hover', ':focus', ':active', ':first-child', ':last-child', '::before / ::after (intro)')
WHERE `unit_id` = 111;

-- CSS Section 2: The Box Model (sec_id = 5, Beginner)
UPDATE `unit_tbl` SET
  `sec_id` = 5,
  `unit_order` = 1,
  `topics` = JSON_ARRAY('content', 'padding', 'border', 'margin', 'box model diagram', 'margin collapsing')
WHERE `unit_id` = 112;

UPDATE `unit_tbl` SET
  `sec_id` = 5,
  `unit_order` = 2,
  `topics` = JSON_ARRAY('width height', 'box-sizing', 'border-box', 'content-box', 'min-width', 'max-width')
WHERE `unit_id` = 113;

-- CSS Section 3: Visual Styling (sec_id = 6, Beginner)
UPDATE `unit_tbl` SET
  `sec_id` = 6,
  `unit_order` = 1,
  `topics` = JSON_ARRAY('hex color', 'rgb', 'hsl', 'background-color', 'background-image', 'gradient', 'opacity')
WHERE `unit_id` = 116;

-- CSS Section 5: Advanced Layout (sec_id = 13, Advanced)
UPDATE `unit_tbl` SET
  `sec_id` = 13,
  `unit_order` = 1,
  `topics` = JSON_ARRAY('flex-wrap', 'gap', 'flex-grow', 'flex-shrink', 'flex-basis', 'nested flex', 'centering div', 'navbar pattern', 'card layout')
WHERE `unit_id` = 106;

UPDATE `unit_tbl` SET
  `sec_id` = 13,
  `unit_order` = 2,
  `topics` = JSON_ARRAY('display grid', 'grid-template-columns', 'grid-template-rows', 'gap', 'grid-column', 'grid-row', 'flexbox vs grid')
WHERE `unit_id` = 108;

UPDATE `unit_tbl` SET
  `sec_id` = 13,
  `unit_order` = 3,
  `topics` = JSON_ARRAY('media query', 'mobile-first', 'breakpoints', 'rem', 'em', 'percent units', 'vw vh')
WHERE `unit_id` = 107;

-- CSS Section 6: Motion & Polish (sec_id = 14, Advanced)
UPDATE `unit_tbl` SET
  `sec_id` = 14,
  `unit_order` = 1,
  `topics` = JSON_ARRAY('transition property', 'duration', 'timing-function', 'ease', 'linear', 'delay', 'hover state')
WHERE `unit_id` = 115;

UPDATE `unit_tbl` SET
  `sec_id` = 14,
  `unit_order` = 2,
  `topics` = JSON_ARRAY('keyframes', 'animation property', 'iteration-count', 'direction', 'fade-in', 'loading spinner')
WHERE `unit_id` = 114;

-- JavaScript Section 6: The DOM (sec_id = 15, Advanced)
UPDATE `unit_tbl` SET
  `sec_id` = 15,
  `unit_order` = 1,
  `topics` = JSON_ARRAY('querySelector', 'querySelectorAll', 'getElementById', 'dom tree')
WHERE `unit_id` = 117;

UPDATE `unit_tbl` SET
  `sec_id` = 15,
  `unit_order` = 2,
  `topics` = JSON_ARRAY('textContent', 'innerHTML', 'classList', 'add remove toggle', 'style property', 'createElement', 'appendChild')
WHERE `unit_id` = 118;

UPDATE `unit_tbl` SET
  `sec_id` = 15,
  `unit_order` = 3,
  `topics` = JSON_ARRAY('addEventListener', 'click event', 'input event', 'submit event', 'change event', 'event object', 'preventDefault')
WHERE `unit_id` = 119;

-- -----------------------------------------------------------------------------
-- 5. Align Pending Queue Section Mapping
-- -----------------------------------------------------------------------------

UPDATE `pending_tbl` SET `sec_id` = 1 WHERE `unit_title` IN ('Document Structure', 'Text Content');
UPDATE `pending_tbl` SET `sec_id` = 2 WHERE `unit_title` IN ('Links', 'Media', 'Linking Your World');
UPDATE `pending_tbl` SET `sec_id` = 3 WHERE `unit_title` IN ('Semantic HTML', 'Divs & Spans');
UPDATE `pending_tbl` SET `sec_id` = 4 WHERE `unit_title` IN ('Selectors', 'Applying CSS', 'Pseudo-classes & Elements', 'Styling Basics');
UPDATE `pending_tbl` SET `sec_id` = 5 WHERE `unit_title` IN ('Box Fundamentals', 'Sizing');
UPDATE `pending_tbl` SET `sec_id` = 6 WHERE `unit_title` IN ('Color & Background', 'Typography');
UPDATE `pending_tbl` SET `sec_id` = 7 WHERE `unit_title` IN ('Display & Position', 'Flexbox Basics');
UPDATE `pending_tbl` SET `sec_id` = 8 WHERE `unit_title` IN ('Variables & Types', 'Operators');
UPDATE `pending_tbl` SET `sec_id` = 9 WHERE `unit_title` IN ('Conditionals', 'Loops');
UPDATE `pending_tbl` SET `sec_id` = 10 WHERE `unit_title` IN ('Function Basics', 'Function Expressions & Arrows');
UPDATE `pending_tbl` SET `sec_id` = 11 WHERE `unit_title` IN ('Template Literals', 'Destructuring & Spread (optional)', 'Destructuring & Spread');
UPDATE `pending_tbl` SET `sec_id` = 12 WHERE `unit_title` IN ('Arrays', 'Array Methods', 'Objects');
UPDATE `pending_tbl` SET `sec_id` = 13 WHERE `unit_title` IN ('Flexbox in Practice', 'Grid Basics', 'Responsive Design');
UPDATE `pending_tbl` SET `sec_id` = 14 WHERE `unit_title` IN ('Transitions', 'Animations');
UPDATE `pending_tbl` SET `sec_id` = 15 WHERE `unit_title` IN ('Selecting Elements', 'Manipulating the Page', 'Events');
UPDATE `pending_tbl` SET `sec_id` = 16 WHERE `unit_title` IN ('JSON Basics', 'Fetch API', 'Putting It Together');

-- -----------------------------------------------------------------------------
-- 6. Player Current Section Integrity Guard
-- -----------------------------------------------------------------------------

UPDATE `player_tbl`
SET `current_section` = 1
WHERE `current_section` IS NULL OR `current_section` < 1 OR `current_section` > 16;

SET FOREIGN_KEY_CHECKS = 1;
