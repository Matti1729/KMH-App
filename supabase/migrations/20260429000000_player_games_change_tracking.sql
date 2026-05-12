-- Change-Tracking für Spiele: erkennt Verschiebungen, Absagen und zeigt sie im UI als Badge
-- Außerdem iCal-Sequence-Counter für korrekte Update-Erkennung in Kalender-Apps
ALTER TABLE player_games
  ADD COLUMN IF NOT EXISTS last_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS change_summary jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  ADD COLUMN IF NOT EXISTS sequence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_seen_at timestamptz;

-- Index für schnelles Filtern nach "ungelesenen Änderungen"
CREATE INDEX IF NOT EXISTS idx_player_games_unread_changes
  ON player_games (last_changed_at)
  WHERE last_changed_at IS NOT NULL AND user_seen_at IS NULL;
