-- Vierter Event-Typ: player_deleted (Spieler gelöscht).
-- Trigger feuert AFTER DELETE auf player_details und schreibt sofort in
-- die Outbox + pingt den Dispatcher (gleicher Pattern wie new_player).

-- 1) CHECK-Constraint um 'player_deleted' erweitern
ALTER TABLE notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_event_type_check;
ALTER TABLE notification_outbox
  ADD CONSTRAINT notification_outbox_event_type_check
  CHECK (event_type IN ('birthday','club_change','new_player','player_deleted'));

-- 2) Trigger-Function für Delete
CREATE OR REPLACE FUNCTION enqueue_player_deleted() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO notification_outbox (event_type, payload)
  VALUES ('player_deleted', jsonb_build_object(
    'player_id', OLD.id,
    'first_name', OLD.first_name,
    'last_name', OLD.last_name,
    'club', OLD.club
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

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_player_details_deleted ON player_details;
CREATE TRIGGER trg_player_details_deleted
  AFTER DELETE ON player_details
  FOR EACH ROW EXECUTE FUNCTION enqueue_player_deleted();
