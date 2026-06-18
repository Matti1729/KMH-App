-- Berater-Signaturen für das automatische Signieren von PDF-Dokumenten.
-- Jeder Berater hinterlegt einmalig ein transparentes PNG; Edge-Function
-- sign-document fügt es per pdf-lib unten rechts auf der letzten Seite ein.

CREATE TABLE IF NOT EXISTS advisor_signatures (
  advisor_id UUID PRIMARY KEY REFERENCES advisors(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,                 -- documents/signatures/<advisor_id>.png
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE advisor_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS advisor_signatures_select_own ON advisor_signatures;
CREATE POLICY advisor_signatures_select_own ON advisor_signatures FOR SELECT TO authenticated
  USING (advisor_id = auth.uid());

DROP POLICY IF EXISTS advisor_signatures_upsert_own ON advisor_signatures;
CREATE POLICY advisor_signatures_upsert_own ON advisor_signatures FOR INSERT TO authenticated
  WITH CHECK (advisor_id = auth.uid());

DROP POLICY IF EXISTS advisor_signatures_update_own ON advisor_signatures;
CREATE POLICY advisor_signatures_update_own ON advisor_signatures FOR UPDATE TO authenticated
  USING (advisor_id = auth.uid()) WITH CHECK (advisor_id = auth.uid());

DROP POLICY IF EXISTS advisor_signatures_delete_own ON advisor_signatures;
CREATE POLICY advisor_signatures_delete_own ON advisor_signatures FOR DELETE TO authenticated
  USING (advisor_id = auth.uid());

-- Storage-Policies für documents/signatures/-Prefix (eigener Owner)
DROP POLICY IF EXISTS "signature_read_own" ON storage.objects;
CREATE POLICY "signature_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'signatures' AND owner = auth.uid());

DROP POLICY IF EXISTS "signature_upload_own" ON storage.objects;
CREATE POLICY "signature_upload_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'signatures');

DROP POLICY IF EXISTS "signature_update_own" ON storage.objects;
CREATE POLICY "signature_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'signatures' AND owner = auth.uid());

-- finance_documents braucht den signed_path um das signierte PDF zu adressieren
ALTER TABLE finance_documents ADD COLUMN IF NOT EXISTS signed_path TEXT;
ALTER TABLE finance_documents ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE finance_documents ADD COLUMN IF NOT EXISTS signed_by UUID REFERENCES advisors(id) ON DELETE SET NULL;
