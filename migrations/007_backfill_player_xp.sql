-- =============================================================================
-- Migration: 007_backfill_player_xp.sql
-- Description: Synchronizes cumulative player XP with all-time leaderboard XP
-- Engine: MySQL 8.0+ / MariaDB 10.3+
-- =============================================================================

UPDATE player_tbl p
LEFT JOIN (
    SELECT user_id, SUM(xp_earned) AS total_xp
    FROM user_activity_tbl
    GROUP BY user_id
) activity_totals ON activity_totals.user_id = p.user_id
SET p.xp = COALESCE(activity_totals.total_xp, 0);
