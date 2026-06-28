-- DIAGNOSE v2 (read-only, rollt zurück): simuliert die echte Spieler-Verknüpfung
-- (linked_user_id NULL -> uuid), um den echten Trigger-Fehler beim Signup zu zeigen.
do $$
declare
  pd uuid;
  errm text;
  errd text;
begin
  select id into pd from public.player_details where linked_user_id is null order by created_at limit 1;
  raise notice 'Test-Spieler (unregistriert): %', pd;
  begin
    update public.player_details set linked_user_id = gen_random_uuid() where id = pd;
    raise notice 'UPDATE+Trigger OK — kein Fehler in der Verknüpfungskette';
    raise exception 'ROLLBACK_TEST_OK';
  exception
    when others then
      get stacked diagnostics errm = message_text, errd = pg_exception_detail;
      if errm = 'ROLLBACK_TEST_OK' then
        raise notice 'Test sauber zurückgerollt (kein echter Fehler).';
      else
        raise notice 'TRIGGER-FEHLER: % | DETAIL: %', errm, coalesce(errd, '-');
      end if;
  end;
end $$;
