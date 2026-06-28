-- DIAGNOSE (read-only, rollt zurück): bestätigt, dass die Verknüpfungskette jetzt fehlerfrei läuft.
do $$
declare pd uuid; errm text;
begin
  select id into pd from public.player_details where linked_user_id is null order by created_at limit 1;
  begin
    update public.player_details set linked_user_id = gen_random_uuid() where id = pd;
    raise exception 'ROLLBACK_TEST_OK';
  exception
    when others then
      get stacked diagnostics errm = message_text;
      if errm = 'ROLLBACK_TEST_OK' then raise notice 'VERIFY: Verknüpfung läuft jetzt fehlerfrei (Signup ok).';
      else raise notice 'VERIFY-FEHLER: %', errm; end if;
  end;
end $$;
