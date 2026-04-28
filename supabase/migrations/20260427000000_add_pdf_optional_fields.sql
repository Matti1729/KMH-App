-- Optionale Felder im Spielerprofil-PDF (z.B. "Vertrag gilt für", "Option")
-- JSON-Map: { contract_scope: true, contract_option: false } - Default: alles aus
ALTER TABLE player_details
  ADD COLUMN IF NOT EXISTS pdf_optional_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
