-- Audit-Bucket für hochgeladene Performance-Dateien (CSV/Excel/PDF/Bild).
-- Originaldatei wird zur Nachvollziehbarkeit abgelegt; die ausgelesenen Werte
-- werden separat (nach Bestätigung) in player_measurements geschrieben.

INSERT INTO storage.buckets (id, name, public)
VALUES ('performance-imports', 'performance-imports', false)
ON CONFLICT (id) DO NOTHING;

-- Lesen/Hochladen für eingeloggte Nutzer (Berater + Spieler) im Ordner performance/.
DROP POLICY IF EXISTS "performance_imports_read" ON storage.objects;
CREATE POLICY "performance_imports_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'performance-imports' AND (storage.foldername(name))[1] = 'performance');

DROP POLICY IF EXISTS "performance_imports_upload" ON storage.objects;
CREATE POLICY "performance_imports_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'performance-imports' AND (storage.foldername(name))[1] = 'performance');
