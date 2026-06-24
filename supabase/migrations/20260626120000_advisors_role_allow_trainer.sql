-- Diagnose + Fix: advisors.role muss 'athletiktrainer' erlauben.
-- Vermutlich blockiert eine alte CHECK-Constraint die neue Rolle, weshalb der
-- advisors-Insert bei der Trainer-Registrierung fehlschlägt (Patrice landet als
-- 'player'). Wir entfernen role-bezogene CHECK-Constraints (Loosening, sicher).
-- Ausgaben erscheinen als NOTICE im `supabase db push`-Log.

do $$
declare
  r record;
  found_check boolean := false;
begin
  -- CHECK-Constraints auf advisors auflisten und role-bezogene entfernen.
  for r in
    select con.conname, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    where con.conrelid = 'public.advisors'::regclass and con.contype = 'c'
  loop
    raise notice 'advisors CHECK %: %', r.conname, r.def;
    if r.def ilike '%role%' then
      execute format('alter table public.advisors drop constraint %I', r.conname);
      raise notice '  -> DROPPED %', r.conname;
      found_check := true;
    end if;
  end loop;
  if not found_check then
    raise notice 'advisors: keine role-CHECK-Constraint gefunden';
  end if;

  -- RLS-Policies auf advisors auflisten (zur Diagnose, falls Insert anderweitig blockt).
  for r in
    select pol.polname,
           pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
           pg_get_expr(pol.polwithcheck, pol.polrelid) as withcheck_expr
    from pg_policy pol
    where pol.polrelid = 'public.advisors'::regclass
  loop
    raise notice 'advisors POLICY %: USING=% WITHCHECK=%', r.polname, coalesce(r.using_expr,'-'), coalesce(r.withcheck_expr,'-');
  end loop;
end $$;
