-- Speichert den Vornamen des Users, der den Kontakt angelegt hat (Display-Snapshot)
ALTER TABLE football_network_contacts
  ADD COLUMN IF NOT EXISTS created_by_name TEXT;
