-- Wechseldatum für zukünftige Vereinswechsel (auch mitten in der Vertragslaufzeit,
-- z.B. Slamar: Vertrag bis 2028, wechselt aber zur Saison 26/27).
-- Ab diesem Datum wird future_club zum aktuellen Verein.
alter table public.player_details
  add column if not exists future_transfer_date date;

-- Fällige Wechsel anwenden: sobald das Wechseldatum erreicht ist, wird der zukünftige
-- Verein zum aktuellen Verein. Fällt kein Wechseldatum vorliegt, greift weiterhin das
-- Vertragsende als Auslöser (Abwärtskompatibilität für Freie-Transfer-Einträge).
create or replace function public.apply_due_transfers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.player_details
  set
    club = future_club,
    contract_end = future_contract_end,
    salary_month = coalesce(nullif(future_salary_month, ''), salary_month),
    future_club = null,
    future_contract_end = null,
    future_transfer_date = null,
    future_salary_month = null
  where future_club is not null
    and (
      (future_transfer_date is not null and future_transfer_date <= current_date)
      or (future_transfer_date is null and contract_end is not null and contract_end < current_date)
    );
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Täglicher Cron um 03:00 Uhr: fällige Wechsel global anwenden.
create extension if not exists pg_cron;
select cron.unschedule('apply-due-transfers') where exists (
  select 1 from cron.job where jobname = 'apply-due-transfers'
);
select cron.schedule('apply-due-transfers', '0 3 * * *', $$select public.apply_due_transfers()$$);

-- Einmalig sofort ausführen, damit bereits fällige Wechsel (z.B. Saisonstart heute) sofort greifen.
select public.apply_due_transfers();
