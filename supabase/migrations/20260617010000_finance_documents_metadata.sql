-- Dokumente-Tab um Metadaten erweitern: Spieler-Zuordnung, Art, Signatur-Status.
-- Liste zeigt damit Name/Vorname/Verein des verlinkten Spielers, Art und Signiert-Status.

ALTER TABLE finance_documents
  ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES player_details(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS doc_type TEXT,
  ADD COLUMN IF NOT EXISTS signed BOOLEAN NOT NULL DEFAULT false;

-- doc_type auf 2 erlaubte Werte begrenzen (NULL für Legacy-Einträge möglich)
ALTER TABLE finance_documents DROP CONSTRAINT IF EXISTS finance_documents_doc_type_check;
ALTER TABLE finance_documents
  ADD CONSTRAINT finance_documents_doc_type_check
  CHECK (doc_type IS NULL OR doc_type IN ('Provisionsvereinbarung', 'Wegvermittlung'));

CREATE INDEX IF NOT EXISTS idx_finance_documents_player ON finance_documents(player_id);
