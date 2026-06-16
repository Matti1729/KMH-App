-- Fix: trigger pings to notify-dispatch lieferten NULL als URL, weil die DB-Settings
-- (app.settings.supabase_url, app.settings.service_role_key) nicht gesetzt sind.
-- Der gesamte EXCEPTION-Block hat damit den Outbox-INSERT mit-rolled-back, sodass
-- gar keine Outbox-Einträge entstanden.
--
-- Lösung:
--  1) URL hardcoden (project-URL ist öffentlich).
--  2) Outbox-Insert NIE in einem Block der durch http_post-Failures gerollt wird.
--  3) http_post in eigenen BEGIN/EXCEPTION-Block, der nichts rollbackt.
--  4) Keine Authorization mehr nötig — notify-dispatch nutzt verify_jwt = false.

CREATE OR REPLACE FUNCTION enqueue_new_player() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- 1) Outbox-Insert (transaktional, MUSS committen)
  INSERT INTO notification_outbox (event_type, payload)
  VALUES ('new_player', jsonb_build_object(
    'player_id', NEW.id,
    'first_name', NEW.first_name,
    'last_name', NEW.last_name,
    'club', NEW.club
  ));

  -- 2) Dispatcher-Ping in eigenem Subblock — Fehler hier dürfen den INSERT nie rollbacken
  BEGIN
    PERFORM net.http_post(
      url := 'https://ozggtruvnwozhwjbznsm.supabase.co/functions/v1/notify-dispatch',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    -- ignoriert; Backup-Cron räumt die Outbox später ab
    NULL;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enqueue_club_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(NEW.club,'') <> coalesce(OLD.club,'') AND coalesce(NEW.club,'') <> '' THEN
    INSERT INTO notification_outbox (event_type, payload)
    VALUES ('club_change', jsonb_build_object(
      'player_id', NEW.id,
      'first_name', NEW.first_name,
      'last_name', NEW.last_name,
      'old_club', OLD.club,
      'new_club', NEW.club
    ));

    BEGIN
      PERFORM net.http_post(
        url := 'https://ozggtruvnwozhwjbznsm.supabase.co/functions/v1/notify-dispatch',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- Backup-Cron auch ohne Auth-Header neu aufsetzen (notify-dispatch ist jwt-frei)
SELECT cron.unschedule('notify-dispatch-5min') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'notify-dispatch-5min'
);
SELECT cron.schedule(
  'notify-dispatch-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ozggtruvnwozhwjbznsm.supabase.co/functions/v1/notify-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
