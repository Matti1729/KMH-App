-- Dokumente-Tab im Finanzen-Screen: PDF-Uploads sichtbar für alle Berater.
-- MVP — kein Mail-Polling, keine Signatur. Manueller Upload, Liste, Download, Löschen.

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS finance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID REFERENCES advisors(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_documents_created ON finance_documents(created_at DESC);

ALTER TABLE finance_documents ENABLE ROW LEVEL SECURITY;

-- Lesen: alle authenticated (Kollegen-Workflow)
DROP POLICY IF EXISTS finance_documents_select ON finance_documents;
CREATE POLICY finance_documents_select ON finance_documents FOR SELECT TO authenticated USING (true);

-- Hochladen: authenticated, uploaded_by = self
DROP POLICY IF EXISTS finance_documents_insert ON finance_documents;
CREATE POLICY finance_documents_insert ON finance_documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- Löschen: nur eigene
DROP POLICY IF EXISTS finance_documents_delete ON finance_documents;
CREATE POLICY finance_documents_delete ON finance_documents FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

-- Storage-Bucket Policies für finance/-Prefix
DROP POLICY IF EXISTS "finance_docs_read" ON storage.objects;
CREATE POLICY "finance_docs_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'finance');

DROP POLICY IF EXISTS "finance_docs_upload" ON storage.objects;
CREATE POLICY "finance_docs_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'finance');

DROP POLICY IF EXISTS "finance_docs_delete" ON storage.objects;
CREATE POLICY "finance_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'finance' AND owner = auth.uid());
