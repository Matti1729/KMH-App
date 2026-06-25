-- Folge-Bereinigung: Karls Auth-Konto über den Namen finden und löschen, falls ein
-- KÜRZLICH (letzte 3 Tage) angelegtes Konto mit Nachname/Vorname „Hamella" existiert.
-- (Die Registrierungs-E-Mail war nicht eindeutig auffindbar.) Recency-Guard schützt
-- vor versehentlichem Löschen eines Bestandskontos.

do $$
declare
  r record; n int := 0;
begin
  for r in
    select id, email, created_at
    from auth.users
    where (
        (raw_user_meta_data->>'last_name') ilike '%hamella%'
        or (raw_user_meta_data->>'first_name') ilike '%hamella%'
      )
      and created_at > now() - interval '3 days'
  loop
    raise notice 'KARL-ACC geloescht: id=% email=% created=%', r.id, r.email, r.created_at;
    delete from auth.users where id = r.id;
    n := n + 1;
  end loop;
  if n = 0 then
    raise notice 'KARL-ACC: kein kuerzliches Auth-Konto mit Name Hamella gefunden';
  end if;
end $$;
