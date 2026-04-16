-- Täglicher Sync aller Football Network Kontakte mit TM-URL
-- Ruft die sync-network-data Edge Function täglich um 6:00 Uhr auf

-- pg_cron Extension aktivieren (falls nicht bereits aktiv)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Bestehenden Job löschen falls vorhanden
SELECT cron.unschedule('sync-network-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-network-daily'
);

-- Täglichen Cron-Job erstellen: 6:00 Uhr morgens
SELECT cron.schedule(
  'sync-network-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-network-data',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"fast": false}'::jsonb
  );
  $$
);
