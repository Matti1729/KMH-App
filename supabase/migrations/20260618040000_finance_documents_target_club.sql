-- Ziel-Verein pro Dokument: bei Transfer-Vereinbarungen weicht der Bezug
-- vom aktuellen Verein des Spielers ab (Beispiel: Spieler unter Vertrag bei
-- Hallescher FC bis 30.06., wechselt zum 01.07. zu einem neuen Verein, die
-- Provisionsvereinbarung gehört zum neuen Verein). NULL = der zum Zeitpunkt
-- des Renderns hinterlegte aktuelle Verein (Bestandsdokumente).
ALTER TABLE finance_documents
  ADD COLUMN IF NOT EXISTS target_club TEXT;
