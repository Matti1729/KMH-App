-- Täglich Verein + Liga aller Spieler mit Transfermarkt-Link aktualisieren.
-- Ruft die Edge Function sync-player-data (verify_jwt=false, öffentlich wie notify-dispatch)
-- im "fast"-Modus auf, damit alle Spieler in einem Durchlauf durchlaufen werden.
-- URL hardgecodet (Projekt-URL ist öffentlich); keine DB-Settings nötig
-- (app.settings.* sind in diesem Projekt nicht gesetzt).
create extension if not exists pg_cron;

select cron.unschedule('sync-player-club-league-daily') where exists (
  select 1 from cron.job where jobname = 'sync-player-club-league-daily'
);

-- Täglich um 04:00 UTC (≈ 06:00 Uhr Sommerzeit).
select cron.schedule(
  'sync-player-club-league-daily',
  '0 4 * * *',
  $$
  select net.http_post(
    url := 'https://ozggtruvnwozhwjbznsm.supabase.co/functions/v1/sync-player-data',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{"fast": true}'::jsonb
  );
  $$
);
