-- Positions-Prototyp-System
-- Prototypen beschreiben eine Spielrolle (z.B. "Moderner 6er – Spielmacher")
-- mit Anforderungen, Attribut-Scores, Bild und Freitext-Beschreibung.
-- Admins verwalten die Prototypen; alle Berater können sie Spielern zuordnen (N:N).

CREATE TABLE IF NOT EXISTS player_prototypes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  position_code TEXT NOT NULL,
  description TEXT DEFAULT '',
  requirements TEXT[] DEFAULT '{}',
  attributes JSONB DEFAULT '{}'::jsonb,
  image_path TEXT,
  created_by UUID REFERENCES advisors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prototypes_position ON player_prototypes(position_code);

ALTER TABLE player_prototypes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prototypes readable by authenticated" ON player_prototypes;
CREATE POLICY "Prototypes readable by authenticated" ON player_prototypes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin-only write (alle Advisors mit role = 'admin')
DROP POLICY IF EXISTS "Only admins can manage prototypes" ON player_prototypes;
CREATE POLICY "Only admins can manage prototypes" ON player_prototypes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM advisors WHERE advisors.id = auth.uid() AND advisors.role = 'admin')
  );


-- Zuordnung Spieler <-> Prototyp (N:N)
CREATE TABLE IF NOT EXISTS player_prototype_assignments (
  player_id UUID NOT NULL REFERENCES player_details(id) ON DELETE CASCADE,
  prototype_id UUID NOT NULL REFERENCES player_prototypes(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, prototype_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_player ON player_prototype_assignments(player_id);
CREATE INDEX IF NOT EXISTS idx_assignments_prototype ON player_prototype_assignments(prototype_id);

ALTER TABLE player_prototype_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Assignments readable by authenticated" ON player_prototype_assignments;
CREATE POLICY "Assignments readable by authenticated" ON player_prototype_assignments
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Assignments writable by authenticated" ON player_prototype_assignments;
CREATE POLICY "Assignments writable by authenticated" ON player_prototype_assignments
  FOR ALL USING (auth.role() = 'authenticated');


-- Storage-Bucket muss manuell im Supabase Dashboard angelegt werden:
-- Name: player-prototypes, Public: true, Allowed MIME: image/*, Max Size: 10MB
-- Pfad-Pattern: {prototype_id}/image_{timestamp}.{ext}
