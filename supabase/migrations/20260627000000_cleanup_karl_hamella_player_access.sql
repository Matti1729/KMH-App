-- Einmal-Bereinigung: Karl Hamella wurde als Spieler registriert; der Zugang soll
-- wieder entfernt werden, sodass auf der Spielerseite E-Mail und Spieler-Einträge
-- raus sind. Der player_details-Datensatz (Berater-Verwaltung) bleibt erhalten.
--
-- Maßnahmen:
--  1. Verwaisten Auth-Account zur Registrierungs-E-Mail löschen (Sicherheits-Guard:
--     nur ein KÜRZLICH angelegtes Konto, damit kein fremder Bestandsaccount getroffen wird).
--  2. Spieler-Einträge zurücksetzen: email_player + birth_date_player leeren, Verknüpfung lösen.

do $$
declare
  v_uid uuid; v_created timestamptz;
  v_pid uuid := '833cc8a3-18c2-47f1-92e3-e892c230e1a8'; -- Karl Hamella
begin
  select id, created_at into v_uid, v_created
  from auth.users
  where lower(email) = lower('info@pm-sportmanagement.com')
  limit 1;

  if v_uid is null then
    raise notice 'CLEANUP: kein Auth-Konto fuer info@pm-sportmanagement.com gefunden';
  elsif v_created < now() - interval '3 days' then
    raise notice 'CLEANUP: Auth-Konto % ist aelter (created %), wird zur Sicherheit NICHT geloescht', v_uid, v_created;
  else
    delete from auth.users where id = v_uid;
    raise notice 'CLEANUP: Auth-Konto % (created %) geloescht', v_uid, v_created;
  end if;

  update public.player_details
    set email_player = null,
        birth_date_player = null,
        linked_user_id = null
    where id = v_pid;
  raise notice 'CLEANUP: player_details Karl Hamella zurueckgesetzt (email_player/birth_date_player geleert, entkoppelt)';
end $$;
