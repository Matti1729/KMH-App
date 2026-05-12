-- Trennung persönlich-bezogener Daten in Berater-Wert (`_advisor`) + Spieler-Wert (`_player`).
-- Anzeige im Berater-View: `_player ?? _advisor` (Spieler-Wert hat Vorrang, leer = Berater-Wert sichtbar).
-- Spieler-View liest und schreibt ausschließlich `_player`-Spalten — kein Zugriff auf Berater-Daten.
-- Bestehende Werte in den unsuffixed Spalten werden initial in `_advisor` kopiert (User-Aussage:
-- aktuell stammen die meisten Daten ohnehin vom Berater; Spieler-Accounts sind noch jung).
-- Alte Spalten bleiben für Backwards-Compat erhalten (Phase 2: cleanup).

-- ============================================================================
-- 1. Spalten-Definitionen (advisor + player Suffix)
-- ============================================================================

-- Kontakt
ALTER TABLE player_details
  ADD COLUMN IF NOT EXISTS phone_advisor TEXT,
  ADD COLUMN IF NOT EXISTS phone_player TEXT,
  ADD COLUMN IF NOT EXISTS phone_country_code_advisor TEXT,
  ADD COLUMN IF NOT EXISTS phone_country_code_player TEXT,
  ADD COLUMN IF NOT EXISTS email_advisor TEXT,
  ADD COLUMN IF NOT EXISTS email_player TEXT,
  ADD COLUMN IF NOT EXISTS street_advisor TEXT,
  ADD COLUMN IF NOT EXISTS street_player TEXT,
  ADD COLUMN IF NOT EXISTS postal_code_advisor TEXT,
  ADD COLUMN IF NOT EXISTS postal_code_player TEXT,
  ADD COLUMN IF NOT EXISTS city_advisor TEXT,
  ADD COLUMN IF NOT EXISTS city_player TEXT;

-- Familie
ALTER TABLE player_details
  ADD COLUMN IF NOT EXISTS father_name_advisor TEXT,
  ADD COLUMN IF NOT EXISTS father_name_player TEXT,
  ADD COLUMN IF NOT EXISTS father_phone_advisor TEXT,
  ADD COLUMN IF NOT EXISTS father_phone_player TEXT,
  ADD COLUMN IF NOT EXISTS father_phone_country_code_advisor TEXT,
  ADD COLUMN IF NOT EXISTS father_phone_country_code_player TEXT,
  ADD COLUMN IF NOT EXISTS father_job_advisor TEXT,
  ADD COLUMN IF NOT EXISTS father_job_player TEXT,
  ADD COLUMN IF NOT EXISTS mother_name_advisor TEXT,
  ADD COLUMN IF NOT EXISTS mother_name_player TEXT,
  ADD COLUMN IF NOT EXISTS mother_phone_advisor TEXT,
  ADD COLUMN IF NOT EXISTS mother_phone_player TEXT,
  ADD COLUMN IF NOT EXISTS mother_phone_country_code_advisor TEXT,
  ADD COLUMN IF NOT EXISTS mother_phone_country_code_player TEXT,
  ADD COLUMN IF NOT EXISTS mother_job_advisor TEXT,
  ADD COLUMN IF NOT EXISTS mother_job_player TEXT,
  ADD COLUMN IF NOT EXISTS siblings_advisor TEXT,
  ADD COLUMN IF NOT EXISTS siblings_player TEXT;

-- Ausbildung
ALTER TABLE player_details
  ADD COLUMN IF NOT EXISTS education_advisor TEXT,
  ADD COLUMN IF NOT EXISTS education_player TEXT,
  ADD COLUMN IF NOT EXISTS training_advisor TEXT,
  ADD COLUMN IF NOT EXISTS training_player TEXT,
  ADD COLUMN IF NOT EXISTS job_advisor TEXT,
  ADD COLUMN IF NOT EXISTS job_player TEXT;

-- Social Media
ALTER TABLE player_details
  ADD COLUMN IF NOT EXISTS instagram_advisor TEXT,
  ADD COLUMN IF NOT EXISTS instagram_player TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_advisor TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_player TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_advisor TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_player TEXT;

-- Sport (Verletzungen + Internat)
ALTER TABLE player_details
  ADD COLUMN IF NOT EXISTS injuries_advisor TEXT,
  ADD COLUMN IF NOT EXISTS injuries_player TEXT,
  ADD COLUMN IF NOT EXISTS internat_advisor BOOLEAN,
  ADD COLUMN IF NOT EXISTS internat_player BOOLEAN;

-- Stamm (Geburtsdatum + Nationalität — von TM vorgeschlagen, beide editierbar)
ALTER TABLE player_details
  ADD COLUMN IF NOT EXISTS birth_date_advisor DATE,
  ADD COLUMN IF NOT EXISTS birth_date_player DATE,
  ADD COLUMN IF NOT EXISTS nationality_advisor TEXT,
  ADD COLUMN IF NOT EXISTS nationality_player TEXT;

-- "Weitere Informationen"-Feld nur für Spieler (Berater nutzt weiterhin
-- `interests` als Fallback und `other_notes` für private Notizen).
ALTER TABLE player_details
  ADD COLUMN IF NOT EXISTS additional_info_player TEXT;

-- ============================================================================
-- 2. Daten-Migration: bestehende Werte in `_advisor`-Spalten kopieren
-- ============================================================================

UPDATE player_details SET
  phone_advisor = phone,
  phone_country_code_advisor = phone_country_code,
  email_advisor = email,
  street_advisor = street,
  postal_code_advisor = postal_code,
  city_advisor = city,
  father_name_advisor = father_name,
  father_phone_advisor = father_phone,
  father_phone_country_code_advisor = father_phone_country_code,
  father_job_advisor = father_job,
  mother_name_advisor = mother_name,
  mother_phone_advisor = mother_phone,
  mother_phone_country_code_advisor = mother_phone_country_code,
  mother_job_advisor = mother_job,
  siblings_advisor = siblings,
  education_advisor = education,
  training_advisor = training,
  job_advisor = job,
  instagram_advisor = instagram,
  tiktok_advisor = tiktok,
  linkedin_advisor = linkedin,
  injuries_advisor = injuries,
  internat_advisor = internat,
  birth_date_advisor = birth_date,
  nationality_advisor = nationality
WHERE TRUE;
