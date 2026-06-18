-- Storage-Policies für signierte PDFs unter documents/signed/<doc_id>.pdf.
-- Die sign-document Edge-Function schreibt mit Service-Role (RLS-bypass),
-- aber das Lesen via createSignedUrl läuft als authenticated User —
-- ohne SELECT-Policy schlägt der Download mit "Object not found" fehl.

DROP POLICY IF EXISTS "signed_docs_read" ON storage.objects;
CREATE POLICY "signed_docs_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'signed');

-- Update + Delete fürs Re-Signieren (Service-Role bypasst RLS, aber falls
-- wir mal vom Client aus löschen wollen, wäre die Policy schon da).
DROP POLICY IF EXISTS "signed_docs_delete" ON storage.objects;
CREATE POLICY "signed_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'signed');
