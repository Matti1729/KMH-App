CREATE TABLE IF NOT EXISTS custom_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  bereich TEXT NOT NULL CHECK (bereich IN ('Herren', 'Nachwuchs')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, bereich)
);

ALTER TABLE custom_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read custom_positions" ON custom_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert custom_positions" ON custom_positions FOR INSERT TO authenticated WITH CHECK (true);
