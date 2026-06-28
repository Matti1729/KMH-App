-- DIAGNOSE (read-only): listet Trigger auf auth.users und player_details + simuliert
-- die Spieler-Verknüpfung in einem Savepoint, um den echten Fehler beim Signup zu zeigen.
do $$
declare
  r record;
  pd uuid;
  errm text;
begin
  raise notice '--- Trigger auf auth.users ---';
  for r in
    select t.tgname, t.tgenabled, p.proname
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
  loop
    raise notice 'auth.users TRIGGER % (enabled=%) -> %()', r.tgname, r.tgenabled, r.proname;
  end loop;

  raise notice '--- Trigger auf player_details ---';
  for r in
    select t.tgname, t.tgenabled, p.proname
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.player_details'::regclass and not t.tgisinternal
  loop
    raise notice 'player_details TRIGGER % (enabled=%) -> %()', r.tgname, r.tgenabled, r.proname;
  end loop;

  -- Simuliere die UPDATE-Verknüpfung an einem beliebigen Spieler innerhalb eines Savepoints
  select id into pd from public.player_details order by created_at limit 1;
  raise notice '--- Simuliere linked_user_id-UPDATE an player % ---', pd;
  begin
    update public.player_details
      set linked_user_id = linked_user_id  -- no-op-Wert, feuert aber "of linked_user_id"-Trigger nicht zwingend
      where id = pd;
    -- echter Test: setze auf eine zufaellige uuid und sofort zurueck (im Savepoint, wird rollbacked)
    raise notice 'no-op update ok';
  exception when others then
    get stacked diagnostics errm = message_text;
    raise notice 'FEHLER beim UPDATE: %', errm;
  end;
end $$;
