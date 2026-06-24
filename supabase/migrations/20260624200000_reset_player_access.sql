-- Spieler-Zugang zurücksetzen (Recovery bei vergessenem Login).
--
-- Vergisst ein Spieler sein Passwort/seine E-Mail, setzt der Berater den Zugang
-- zurück: der alte Auth-Account wird gelöscht (alter Login ungültig, E-Mail wieder
-- frei), die Verknüpfung gelöst und ein neuer Einladungscode gesetzt. Der Spieler
-- registriert sich damit neu (neues Passwort); die Profildaten auf player_details
-- bleiben erhalten und werden vom Link-Trigger wieder verknüpft.

create or replace function public.reset_player_access(p_player_id uuid, p_new_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  -- Nur Berater dürfen einen Reset auslösen.
  if not exists (select 1 from advisors where id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  select linked_user_id into v_uid
  from player_details
  where id = p_player_id;

  -- Alten Auth-Account entfernen (kaskadiert Sessions/Tokens).
  if v_uid is not null then
    delete from auth.users where id = v_uid;
  end if;

  -- Verknüpfung lösen + neuen Code setzen.
  update player_details
    set linked_user_id = null,
        invitation_code = p_new_code
    where id = p_player_id;
end;
$$;

revoke all on function public.reset_player_access(uuid, text) from public;
grant execute on function public.reset_player_access(uuid, text) to authenticated;
