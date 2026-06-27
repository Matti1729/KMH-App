-- Telegram-Benachrichtigung, wenn sich ein Spieler registriert.
-- Die Registrierung verknüpft player_details mit dem Auth-Account, d.h.
-- linked_user_id wechselt von NULL auf eine User-ID. Genau darauf triggern wir.
-- Muster identisch zu enqueue_new_player (Outbox-Insert + Realtime-Ping an notify-dispatch).

create or replace function enqueue_player_registered() returns trigger
language plpgsql as $$
begin
  if old.linked_user_id is null and new.linked_user_id is not null then
    insert into notification_outbox (event_type, payload)
    values ('player_registered', jsonb_build_object(
      'player_id', new.id,
      'first_name', new.first_name,
      'last_name', new.last_name,
      'club', new.club
    ));

    begin
      perform net.http_post(
        url := 'https://ozggtruvnwozhwjbznsm.supabase.co/functions/v1/notify-dispatch',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
      );
    exception when others then
      null; -- Backup-Cron räumt die Outbox später ab
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_player_details_registered on player_details;
create trigger trg_player_details_registered
  after update of linked_user_id on player_details
  for each row execute function enqueue_player_registered();
