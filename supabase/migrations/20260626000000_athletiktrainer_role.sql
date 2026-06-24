-- Dritte Rolle: Athletiktrainer. Wird (wie advisor/admin) in der advisors-Tabelle
-- mit role = 'athletiktrainer' gespeichert. Registrierung per eigenem Einladungscode.

-- Einladungscode für Athletiktrainer in settings ablegen (Default — bei Bedarf ändern).
insert into public.settings (key, value)
select 'trainer_invitation_code', 'KMH-ATHLETIK-2026'
where not exists (select 1 from public.settings where key = 'trainer_invitation_code');

-- Anonyme Prüfung des Trainer-Codes (Spiegel von verify_advisor_invitation_code).
create or replace function public.verify_trainer_invitation_code(p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from settings
    where key = 'trainer_invitation_code'
      and value is not null
      and value = trim(p_code)
  );
$$;

revoke all on function public.verify_trainer_invitation_code(text) from public;
grant execute on function public.verify_trainer_invitation_code(text) to anon, authenticated;
