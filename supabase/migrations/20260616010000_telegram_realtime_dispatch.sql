-- Trigger-Funktionen für neuer-Spieler + Vereinswechsel um direkten Dispatcher-Ping
-- erweitern. Damit landen Push-Nachrichten innerhalb von ~1-2 Sekunden in Telegram,
-- statt erst beim nächsten 5-Minuten-Cron-Tick. Der Cron läuft trotzdem weiter als
-- Backup, falls ein http_post mal verschluckt wird (z.B. Edge-Function down).

CREATE OR REPLACE FUNCTION enqueue_new_player() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO notification_outbox (event_type, payload)
  VALUES ('new_player', jsonb_build_object(
    'player_id', NEW.id,
    'first_name', NEW.first_name,
    'last_name', NEW.last_name,
    'club', NEW.club
  ));
  -- Sofort den Dispatcher anpingen (fire-and-forget; Failure schadet nicht, Cron räumt nach)
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/notify-dispatch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- http_post-Fehler dürfen den INSERT nie blockieren — Backup-Cron räumt auf.
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
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/notify-dispatch',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
