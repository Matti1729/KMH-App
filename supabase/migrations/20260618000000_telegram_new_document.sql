-- Telegram-Notification für neu hochgeladene Dokumente (Provisionsvereinbarung /
-- Wegvermittlung im Finanzen-Dokumente-Tab).

-- 1) Event-Typ erlauben
ALTER TABLE notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_event_type_check;
ALTER TABLE notification_outbox
  ADD CONSTRAINT notification_outbox_event_type_check
  CHECK (event_type IN ('birthday','club_change','new_player','player_deleted','new_document'));

-- 2) Trigger-Funktion: bei INSERT in finance_documents Outbox-Eintrag + Dispatcher-Ping
CREATE OR REPLACE FUNCTION enqueue_new_document() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_club TEXT;
BEGIN
  -- Spielerdaten dazuholen (falls verknüpft)
  IF NEW.player_id IS NOT NULL THEN
    SELECT first_name, last_name, club
      INTO v_first_name, v_last_name, v_club
      FROM player_details
     WHERE id = NEW.player_id;
  END IF;

  INSERT INTO notification_outbox (event_type, payload)
  VALUES ('new_document', jsonb_build_object(
    'document_id', NEW.id,
    'doc_type', NEW.doc_type,
    'filename', NEW.filename,
    'player_id', NEW.player_id,
    'first_name', v_first_name,
    'last_name', v_last_name,
    'club', v_club
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_documents_new ON finance_documents;
CREATE TRIGGER trg_finance_documents_new
  AFTER INSERT ON finance_documents
  FOR EACH ROW EXECUTE FUNCTION enqueue_new_document();
