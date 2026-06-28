-- BUGFIX: Registrierung schlug fehl ("Database error saving new user").
-- Ursache: der Trigger enqueue_player_registered schreibt event_type='player_registered'
-- in notification_outbox, aber die CHECK-Constraint notification_outbox_event_type_check
-- kannte diesen Wert nicht → INSERT scheitert → die Spieler-Verknüpfung (Trigger auf
-- auth.users) scheitert → der gesamte Signup bricht ab.

-- 1) Constraint um 'player_registered' erweitern.
alter table public.notification_outbox drop constraint if exists notification_outbox_event_type_check;
alter table public.notification_outbox
  add constraint notification_outbox_event_type_check
  check (event_type in ('birthday','club_change','new_player','player_deleted','new_document','document_signed','player_registered'));

-- 2) Defensive: ein Fehler beim Benachrichtigen darf die Registrierung NIE blockieren.
--    Outbox-Insert + Realtime-Ping in einen eigenen Exception-Block kapseln.
create or replace function enqueue_player_registered() returns trigger
language plpgsql as $$
begin
  if old.linked_user_id is null and new.linked_user_id is not null then
    begin
      insert into notification_outbox (event_type, payload)
      values ('player_registered', jsonb_build_object(
        'player_id', new.id,
        'first_name', new.first_name,
        'last_name', new.last_name,
        'club', new.club
      ));
      perform net.http_post(
        url := 'https://ozggtruvnwozhwjbznsm.supabase.co/functions/v1/notify-dispatch',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
      );
    exception when others then
      null; -- Benachrichtigung darf den Signup niemals verhindern
    end;
  end if;
  return new;
end;
$$;
