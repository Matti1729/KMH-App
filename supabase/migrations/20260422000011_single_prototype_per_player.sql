-- Single-Prototype-per-Player: jeder Spieler bekommt genau 1 Prototyp zugewiesen.
-- Historisches is_primary-Flag wird quasi obsolet (bleibt als Spalte für Backward-Compat).

-- 1. Dedupe: Bei Mehrfach-Assignments die is_primary=true-Row behalten.
--    Bei keinem Primary: die älteste (nach created_at).
DELETE FROM player_prototype_assignments a
USING player_prototype_assignments b
WHERE a.player_id = b.player_id
  AND a.ctid <> b.ctid
  AND (
    (b.is_primary AND NOT a.is_primary)
    OR (b.is_primary = a.is_primary AND b.created_at < a.created_at)
    OR (b.is_primary = a.is_primary AND b.created_at = a.created_at AND b.ctid < a.ctid)
  );

-- 2. Bestehende Einzel-Zeilen auf is_primary=true normalisieren
UPDATE player_prototype_assignments SET is_primary = true WHERE is_primary = false;

-- 3. Unique-Constraint: genau 1 Assignment pro Spieler (DB-level garantiert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_prototype_per_player
  ON player_prototype_assignments (player_id);
