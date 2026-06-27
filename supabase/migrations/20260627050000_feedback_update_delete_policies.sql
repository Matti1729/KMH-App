-- Feedback "Erledigt"/"Löschen" funktionierte nicht: per RLS blockierte UPDATE/DELETE
-- liefern bei Supabase KEINEN Fehler (nur 0 Zeilen) -> UI entfernt optimistisch, DB-Zeile
-- bleibt und taucht beim Neuladen wieder auf. Wir erlauben Berater/Admin UPDATE + DELETE.

-- Diagnose: bestehende Policies + RLS-Status ausgeben.
do $$
declare r record;
begin
  raise notice 'feedback RLS aktiv: %', (select relrowsecurity from pg_class where oid = 'public.feedback'::regclass);
  for r in
    select pol.polname, pol.polcmd,
           pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
           pg_get_expr(pol.polwithcheck, pol.polrelid) as withcheck_expr
    from pg_policy pol where pol.polrelid = 'public.feedback'::regclass
  loop
    raise notice 'feedback POLICY % cmd=% USING=% WITHCHECK=%', r.polname, r.polcmd, coalesce(r.using_expr,'-'), coalesce(r.withcheck_expr,'-');
  end loop;
end $$;

alter table public.feedback enable row level security;

drop policy if exists feedback_staff_update on public.feedback;
create policy feedback_staff_update on public.feedback
  for update to authenticated
  using (public.is_kmh_staff())
  with check (public.is_kmh_staff());

drop policy if exists feedback_staff_delete on public.feedback;
create policy feedback_staff_delete on public.feedback
  for delete to authenticated
  using (public.is_kmh_staff());
