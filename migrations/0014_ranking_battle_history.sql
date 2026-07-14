-- Persist the direct choices behind a completed ranking. The compact,
-- versioned JSON stores [left_option_id, right_option_id, winner_side] tuples;
-- NULL keeps existing ranking results backwards-compatible.

ALTER TABLE ranking_results ADD COLUMN battle_history TEXT;
