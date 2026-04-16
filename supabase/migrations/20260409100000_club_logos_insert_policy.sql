-- Allow authenticated users to upsert club logos (for manual club selection)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'club_logos' AND policyname = 'Authenticated users can insert club_logos'
  ) THEN
    CREATE POLICY "Authenticated users can insert club_logos" ON club_logos FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'club_logos' AND policyname = 'Authenticated users can update club_logos'
  ) THEN
    CREATE POLICY "Authenticated users can update club_logos" ON club_logos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
