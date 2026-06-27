-- Kategorie/Typ für Einträge in der Spielerübersicht.
-- Ermöglicht neben Fußballspielern auch Funktionäre (Trainer, Sportdirektoren …)
-- und Athleten anderer Sportarten in derselben Liste zu verwalten.
-- Bestand bleibt unverändert "Fußball" (Default greift für vorhandene Zeilen).
alter table public.player_details
  add column if not exists category text not null default 'Fußball';
