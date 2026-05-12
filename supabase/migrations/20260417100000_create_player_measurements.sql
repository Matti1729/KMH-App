CREATE TABLE player_measurements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES player_details(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  measured_at DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX idx_measurements_player ON player_measurements(player_id, type);

ALTER TABLE player_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Measurements viewable by all authenticated" ON player_measurements
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Measurements insertable by all authenticated" ON player_measurements
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Measurements updatable by all authenticated" ON player_measurements
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Measurements deletable by all authenticated" ON player_measurements
  FOR DELETE USING (auth.role() = 'authenticated');
