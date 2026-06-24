-- Spieler-E-Mail automatisch aus der Registrierung übernehmen.
--
-- Die Spieler-Ansicht zeigt die E-Mail read-only als Registrierungs-/Login-E-Mail
-- und schreibt sie beim Speichern nach email_player. Damit der Berater die E-Mail
-- aber AUCH ohne ein erstes Speichern des Spielers sieht, setzt der Link-Trigger
-- email_player direkt beim Verknüpfen, und bestehende verknüpfte Spieler werden
-- einmalig backfilled.

-- 1) Link-Trigger erweitern: beim Verknüpfen email_player = auth-E-Mail setzen.
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
        set linked_user_id = new.id,
            email_player = coalesce(nullif(email_player, ''), new.email)
        where id = pd_id
          and linked_user_id is null;
    end if;
  end if;
  return new;
end;
$$;

-- 2) Backfill: bereits verknüpfte Spieler bekommen ihre Registrierungs-E-Mail.
update public.player_details pd
  set email_player = u.email
  from auth.users u
  where pd.linked_user_id = u.id
    and u.email is not null;
