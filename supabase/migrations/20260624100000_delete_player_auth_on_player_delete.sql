-- Beim Löschen eines Spielers (player_details) auch den verknüpften Auth-Account
-- entfernen, damit der Spieler seinen App-Zugang verliert.
--
-- Hintergrund: Bisher löschte der Berater nur die player_details-Zeile. Der
-- auth.users-Eintrag blieb bestehen — der gelöschte Spieler hätte sich weiter
-- einloggen können (und sich beim Login sogar ein leeres Profil neu angelegt).
--
-- Lösung: SECURITY-DEFINER-Trigger löscht den auth.users-Eintrag. Das kaskadiert
-- in der auth-Schema (Sessions/Tokens) und entzieht den Zugang sofort.

create or replace function public.handle_player_details_deleted_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.linked_user_id is not null then
    delete from auth.users where id = old.linked_user_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_player_details_delete_auth on public.player_details;
create trigger trg_player_details_delete_auth
  after delete on public.player_details
  for each row execute function public.handle_player_details_deleted_auth();
