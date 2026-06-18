-- Telegram-Notification beim Signieren eines Dokuments. Trigger feuert nur,
-- wenn signed von FALSE auf TRUE wechselt (kein Spam beim Setzen anderer Felder
-- oder beim Un-Signieren).

-- 1) Event-Typ erlauben
ALTER TABLE notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_event_type_check;
ALTER TABLE notification_outbox
  ADD CONSTRAINT notification_outbox_event_type_check
  CHECK (event_type IN ('birthday','club_change','new_player','player_deleted','new_document','document_signed'));

-- 2) Trigger-Funktion
CREATE OR REPLACE FUNCTION enqueue_document_signed() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_club TEXT;
  v_advisor_first TEXT;
  v_advisor_last TEXT;
BEGIN
  -- Nur feuern bei Übergang FALSE -> TRUE
  IF NEW.signed IS DISTINCT FROM TRUE OR OLD.signed IS NOT DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.player_id IS NOT NULL THEN
    SELECT first_name, last_name, club
      INTO v_first_name, v_last_name, v_club
      FROM player_details
     WHERE id = NEW.player_id;
  END IF;

  IF NEW.signed_by IS NOT NULL THEN
    SELECT first_name, last_name
      INTO v_advisor_first, v_advisor_last
      FROM advisors
     WHERE id = NEW.signed_by;
  END IF;

  INSERT INTO notification_outbox (event_type, payload)
  VALUES ('document_signed', jsonb_build_object(
    'document_id', NEW.id,
    'doc_type', NEW.doc_type,
    'filename', NEW.filename,
    'player_id', NEW.player_id,
    'first_name', v_first_name,
    'last_name', v_last_name,
    'club', v_club,
    'advisor_first_name', v_advisor_first,
    'advisor_last_name', v_advisor_last
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

DROP TRIGGER IF EXISTS trg_finance_documents_signed ON finance_documents;
CREATE TRIGGER trg_finance_documents_signed
  AFTER UPDATE OF signed ON finance_documents
  FOR EACH ROW EXECUTE FUNCTION enqueue_document_signed();
