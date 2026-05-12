-- Multi-Position-Support für Prototypen (ein Prototyp kann mehrere Positionen abdecken,
-- z.B. Außenverteidiger für LV und RV, Außenbahn für LA und RA).

ALTER TABLE player_prototypes ADD COLUMN IF NOT EXISTS position_codes TEXT[] DEFAULT '{}';

-- 1) Für alle Rows: position_codes mit dem bestehenden position_code initialisieren (falls leer)
UPDATE player_prototypes
SET position_codes = ARRAY[position_code]
WHERE (position_codes IS NULL OR array_length(position_codes, 1) IS NULL);

-- 2) Duplikate zusammenführen: Prototypen mit gleichem Namen bekommen die vereinten Positions-Codes
--    in der ältesten Row, die anderen werden gelöscht.
--    Auch die Assignments werden von Duplikaten auf den Keeper umgebogen.
WITH dupe_info AS (
  SELECT
    name,
    array_agg(DISTINCT position_code ORDER BY position_code) AS merged_codes,
    (array_agg(id ORDER BY created_at NULLS LAST, id))[1] AS keep_id,
    array_remove(array_agg(id ORDER BY created_at NULLS LAST, id), (array_agg(id ORDER BY created_at NULLS LAST, id))[1]) AS drop_ids
  FROM player_prototypes
  GROUP BY name
  HAVING count(*) > 1
)
UPDATE player_prototypes p
SET position_codes = d.merged_codes
FROM dupe_info d
WHERE p.id = d.keep_id;

-- Assignments von Duplikaten auf Keeper umbiegen (vor dem Löschen)
WITH dupe_info AS (
  SELECT
    name,
    (array_agg(id ORDER BY created_at NULLS LAST, id))[1] AS keep_id,
    unnest(array_remove(array_agg(id ORDER BY created_at NULLS LAST, id), (array_agg(id ORDER BY created_at NULLS LAST, id))[1])) AS drop_id
  FROM player_prototypes
  GROUP BY name
  HAVING count(*) > 1
)
UPDATE player_prototype_assignments a
SET prototype_id = d.keep_id
FROM dupe_info d
WHERE a.prototype_id = d.drop_id
  AND NOT EXISTS (
    SELECT 1 FROM player_prototype_assignments x WHERE x.player_id = a.player_id AND x.prototype_id = d.keep_id
  );

-- Übrig gebliebene (jetzt redundante) Assignments entfernen
DELETE FROM player_prototype_assignments a
WHERE a.prototype_id IN (
  SELECT unnest(array_remove(array_agg(id ORDER BY created_at NULLS LAST, id), (array_agg(id ORDER BY created_at NULLS LAST, id))[1]))
  FROM player_prototypes
  GROUP BY name
  HAVING count(*) > 1
);

-- Duplikat-Prototypen löschen
DELETE FROM player_prototypes p
WHERE p.id IN (
  SELECT unnest(array_remove(array_agg(id ORDER BY created_at NULLS LAST, id), (array_agg(id ORDER BY created_at NULLS LAST, id))[1]))
  FROM player_prototypes
  GROUP BY name
  HAVING count(*) > 1
);

-- Index auf position_codes Array-Elementen (für Filterung nach Position)
CREATE INDEX IF NOT EXISTS idx_prototypes_position_codes ON player_prototypes USING GIN (position_codes);
