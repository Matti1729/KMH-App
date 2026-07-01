-- Diagnose (nur RAISE NOTICE): Position von Philipp Hilmer nach dem Sync.
do $$
declare r record;
begin
  for r in select first_name, last_name, coalesce(position,'-') as pos, coalesce(club,'-') as club
           from player_details where lower(last_name) like '%hilmer%'
  loop
    raise notice 'HILMER: % % | Position: % | Verein: %', r.first_name, r.last_name, r.pos, r.club;
  end loop;
end $$;
