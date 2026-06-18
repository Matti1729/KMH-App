-- Telegram-Trigger nutzen jetzt finance_documents.target_club als primären
-- Vereinsbezug — fällt auf player_details.club zurück, wenn target_club NULL
-- ist (sollte nach Backfill nicht mehr vorkommen). Damit zeigt die Telegram-
-- Nachricht den Verein, auf den sich die Vereinbarung bezieht — auch bei
-- Transfer-Vereinbarungen.

CREATE OR REPLACE FUNCTION enqueue_new_document() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_club TEXT;
BEGIN
  IF NEW.player_id IS NOT NULL THEN
    SELECT first_name, last_name, club
      INTO v_first_name, v_last_name, v_club
      FROM player_details
     WHERE id = NEW.player_id;
  END IF;

  -- target_club ist der explizit beim Upload gewählte Vereinsbezug
  v_club := COALESCE(NEW.target_club, v_club);

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

CREATE OR REPLACE FUNCTION enqueue_document_signed() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_club TEXT;
  v_advisor_first TEXT;
  v_advisor_last TEXT;
BEGIN
  IF NEW.signed IS DISTINCT FROM TRUE OR OLD.signed IS NOT DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.player_id IS NOT NULL THEN
    SELECT first_name, last_name, club
      INTO v_first_name, v_last_name, v_club
      FROM player_details
     WHERE id = NEW.player_id;
  END IF;

  v_club := COALESCE(NEW.target_club, v_club);

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
