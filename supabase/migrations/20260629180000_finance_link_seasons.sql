-- Auch aus der KMH-Liste verknüpfte Provisions-Spieler sollen nur in ausgewählten
-- Saisons in der Finanzen-Liste erscheinen. seasons hält die Saisons der Verknüpfung;
-- null/leer = in allen Saisons sichtbar (Abwärtskompatibilität für Altbestand).
alter table public.finance_provision_links
  add column if not exists seasons text[];
