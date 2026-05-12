-- Analysen-Archiv pro Spieler (nach Zoom-Terminen)
-- Felder: Datum, Themen-Array, ToDo-Array, optional Video-Pfad

CREATE TABLE IF NOT EXISTS player_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES player_details(id) ON DELETE CASCADE,
  advisor_id UUID REFERENCES advisors(id) ON DELETE SET NULL,
  analysis_date DATE NOT NULL,
  topics TEXT[] DEFAULT '{}',
  todos TEXT[] DEFAULT '{}',
  video_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyses_player ON player_analyses(player_id, analysis_date DESC);

ALTER TABLE player_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Analyses readable by authenticated" ON player_analyses;
CREATE POLICY "Analyses readable by authenticated" ON player_analyses
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can manage analyses" ON player_analyses;
CREATE POLICY "Authenticated can manage analyses" ON player_analyses
  FOR ALL USING (auth.role() = 'authenticated');

-- Hinweis: Storage-Bucket "player-analysis-videos" muss manuell im Supabase Dashboard
-- oder via `supabase storage` CLI angelegt werden (public bucket).
-- Pfad-Pattern: {player_id}/{analysis_id}_{timestamp}.{ext}
