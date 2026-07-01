-- Diagnose (nur RAISE NOTICE): TM-Link + club von Sargis Adamyan (vereinslos).
do $$
declare r record;
begin
  for r in select first_name, last_name, coalesce(club,'(leer)') as club, coalesce(league,'(leer)') as league, coalesce(transfermarkt_url,'-') as tm
           from player_details where lower(last_name) like '%adamyan%'
  loop
    raise notice 'ADAMYAN: % % | club="%" | league="%" | TM: %', r.first_name, r.last_name, r.club, r.league, r.tm;
  end loop;
end $$;
