-- Spieler-Account ↔ player_details Verknüpfung + Lesezugriff für Spieler.
--
-- Hintergrund:
-- * Die einzige echte Verknüpfung ist player_details.linked_user_id (eine
--   profiles.player_details_id-Spalte existiert NICHT; die profiles-Tabelle ist
--   ungenutzt). Das clientseitige Verknüpfen lief deshalb immer ins Leere.
-- * Bei aktiver E-Mail-Bestätigung gibt es nach signUp keine Session, daher
--   muss die Verknüpfung server-seitig (SECURITY DEFINER Trigger) passieren.

-- 1) Trigger: verknüpft den neuen Spieler-Account mit seinem player_details-Datensatz.
--    Die player_details-ID wird beim signUp in den User-Metadaten mitgegeben.
create or replace function public.handle_player_account_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pd_id uuid;
begin
  if (new.raw_user_meta_data->>'role') = 'player' then
    pd_id := nullif(new.raw_user_meta_data->>'player_details_id', '')::uuid;
    if pd_id is not null then
      update player_details
        set linked_user_id = new.id
        where id = pd_id
          and linked_user_id is null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_player_link on auth.users;
create trigger on_auth_user_created_player_link
  after insert on auth.users
  for each row execute function public.handle_player_account_link();

-- 2) RLS: ein verknüpfter Spieler darf seinen eigenen Datensatz lesen & bearbeiten.
--    Additive (permissive) Policies — erweitern nur den Zugriff, ändern bestehende
--    Berater-Policies nicht. RLS ist auf player_details bereits aktiv.
alter table public.player_details enable row level security;

drop policy if exists player_details_linked_player_select on public.player_details;
create policy player_details_linked_player_select on public.player_details
  for select to authenticated
  using (linked_user_id = auth.uid());

drop policy if exists player_details_linked_player_update on public.player_details;
create policy player_details_linked_player_update on public.player_details
  for update to authenticated
  using (linked_user_id = auth.uid())
  with check (linked_user_id = auth.uid());
