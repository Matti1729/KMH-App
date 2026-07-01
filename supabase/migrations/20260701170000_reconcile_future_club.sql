-- Wenn der aktuelle Verein dem zukünftigen Verein bzw. dem Leihgeber entspricht
-- (z.B. weil der TM-Sync am Saisonstart den neuen Verein übernommen hat), wird
-- der zukünftige Verein / die Leihe automatisch geleert und das zukünftige
-- Vertragsende ins reguläre Vertragsende übernommen.
-- Vergleich normalisiert (Klein-/Leer-/Sonderzeichen egal): "1. FC X" == "1.FC X".

create or replace function public.reconcile_future_club()
returns trigger
language plpgsql
as $$
declare
  norm_club text;
begin
  norm_club := regexp_replace(lower(coalesce(NEW.club, '')), '[^a-z0-9]', '', 'g');

  -- Zukünftiger Verein erreicht → in aktuellen Verein übernehmen, Zukunft leeren.
  if NEW.future_club is not null and norm_club <> ''
     and norm_club = regexp_replace(lower(NEW.future_club), '[^a-z0-9]', '', 'g') then
    NEW.contract_end := coalesce(NEW.future_contract_end, NEW.contract_end);
    NEW.future_club := null;
    NEW.future_contract_end := null;
    NEW.future_transfer_date := null;
  end if;

  -- Ausgeliehen von == aktueller Verein → Leihe aufheben.
  if NEW.loan_from_club is not null and norm_club <> ''
     and norm_club = regexp_replace(lower(NEW.loan_from_club), '[^a-z0-9]', '', 'g') then
    NEW.loan_from_club := null;
    NEW.loan_from_club_league := null;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_reconcile_future_club on public.player_details;
create trigger trg_reconcile_future_club
  before insert or update on public.player_details
  for each row execute function public.reconcile_future_club();

-- Einmalig bestehende Fälle bereinigen (aktueller == zukünftiger Verein / Leihgeber).
update public.player_details
set contract_end = coalesce(future_contract_end, contract_end),
    future_club = null, future_contract_end = null, future_transfer_date = null
where future_club is not null and club is not null
  and regexp_replace(lower(club), '[^a-z0-9]', '', 'g') = regexp_replace(lower(future_club), '[^a-z0-9]', '', 'g');

update public.player_details
set loan_from_club = null, loan_from_club_league = null
where loan_from_club is not null and club is not null
  and regexp_replace(lower(club), '[^a-z0-9]', '', 'g') = regexp_replace(lower(loan_from_club), '[^a-z0-9]', '', 'g');
