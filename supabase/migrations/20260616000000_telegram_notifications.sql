-- Telegram-Push-Notifications für App-Events.
-- Drei Event-Quellen → notification_outbox → notify-dispatch (Edge-Function) → Telegram-Bot-API
--   • Geburtstag eines Spielers (täglich morgens via pg_cron)
--   • Vereinswechsel (DB-Trigger auf player_details.club)
--   • Neuer Spieler in der Agentur (DB-Trigger auf player_details INSERT)
-- Routing: Broadcast an alle Berater in advisor_telegram_links.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- player_details.created_at: für Audit + sauberen Insert-Trigger
ALTER TABLE player_details ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ── Berater ↔ Telegram-Chat-Mapping ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS advisor_telegram_links (
  advisor_id UUID PRIMARY KEY REFERENCES advisors(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  telegram_chat_id BIGINT NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE advisor_telegram_links ENABLE ROW LEVEL SECURITY;
-- Jeder authenticated darf sehen ob er selbst verknüpft ist (für Status-Anzeige).
DROP POLICY IF EXISTS advisor_telegram_links_select ON advisor_telegram_links;
CREATE POLICY advisor_telegram_links_select ON advisor_telegram_links FOR SELECT TO authenticated
  USING (advisor_id = auth.uid());
DROP POLICY IF EXISTS advisor_telegram_links_delete ON advisor_telegram_links;
CREATE POLICY advisor_telegram_links_delete ON advisor_telegram_links FOR DELETE TO authenticated
  USING (advisor_id = auth.uid());
-- Inserts laufen ausschließlich über Service-Role (Bot/Edge-Function) — keine User-Policy nötig.

-- ── Einmalcodes für den Linking-Flow ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_link_codes (
  code TEXT PRIMARY KEY,
  advisor_id UUID NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_advisor ON telegram_link_codes(advisor_id, used_at);

-- ── Outbox für ausstehende Notifications ────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('birthday','club_change','new_player')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending ON notification_outbox(sent_at) WHERE sent_at IS NULL;

-- ── Trigger: neuer Spieler ──────────────────────────────────────────────
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_player_details_new_player ON player_details;
CREATE TRIGGER trg_player_details_new_player
  AFTER INSERT ON player_details
  FOR EACH ROW EXECUTE FUNCTION enqueue_new_player();

-- ── Trigger: Vereinswechsel ────────────────────────────────────────────
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_player_details_club_change ON player_details;
CREATE TRIGGER trg_player_details_club_change
  AFTER UPDATE OF club ON player_details
  FOR EACH ROW EXECUTE FUNCTION enqueue_club_change();

-- ── Geburtstags-Enqueue (täglich aufgerufen vom Cron) ──────────────────
CREATE OR REPLACE FUNCTION enqueue_birthday_notifications() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO notification_outbox (event_type, payload)
  SELECT 'birthday', jsonb_build_object(
    'player_id', id,
    'first_name', first_name,
    'last_name', last_name,
    'birth_date', coalesce(birth_date_player, birth_date_advisor, birth_date),
    'age', date_part('year', age(coalesce(birth_date_player, birth_date_advisor, birth_date)::date))
  )
  FROM player_details
  WHERE coalesce(birth_date_player, birth_date_advisor, birth_date) IS NOT NULL
    AND to_char(coalesce(birth_date_player, birth_date_advisor, birth_date)::date, 'MM-DD')
        = to_char(current_date, 'MM-DD');
END;
$$;

-- ── Cron: täglich Geburtstage einqueuen (07:00 UTC = 08-09 lokal D) ────
SELECT cron.unschedule('enqueue-birthdays-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'enqueue-birthdays-daily'
);
SELECT cron.schedule(
  'enqueue-birthdays-daily',
  '0 7 * * *',
  $$ SELECT enqueue_birthday_notifications(); $$
);

-- ── Cron: alle 5 Minuten den Dispatcher pingen ─────────────────────────
SELECT cron.unschedule('notify-dispatch-5min') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'notify-dispatch-5min'
);
SELECT cron.schedule(
  'notify-dispatch-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/notify-dispatch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
