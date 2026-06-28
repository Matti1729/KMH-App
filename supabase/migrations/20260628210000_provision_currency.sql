-- Währung pro Provision speichern (EUR/USD). Bisher wurde die Modal-Auswahl ($/€)
-- nirgends persistiert und beim erneuten Öffnen immer als EUR angezeigt.
alter table public.player_provisions
  add column if not exists currency text not null default 'EUR';
