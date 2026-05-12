-- Storage-Bucket für Prototyp-Bilder
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('player-prototypes', 'player-prototypes', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Policies: alle authenticated können lesen+schreiben (Uploads vom Admin im UI)
DROP POLICY IF EXISTS "prototype-bucket-read" ON storage.objects;
CREATE POLICY "prototype-bucket-read" ON storage.objects
  FOR SELECT USING (bucket_id = 'player-prototypes');

DROP POLICY IF EXISTS "prototype-bucket-write" ON storage.objects;
CREATE POLICY "prototype-bucket-write" ON storage.objects
  FOR ALL USING (bucket_id = 'player-prototypes' AND auth.role() = 'authenticated');
