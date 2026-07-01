-- Diagnose (nur RAISE NOTICE): Kategorie + TM-Link von Philipp Hilmer.
do $$
declare r record;
begin
  for r in
    select last_name, first_name, coalesce(category,'-') as cat, coalesce(transfermarkt_url,'-') as tm, coalesce(club,'-') as club
    from player_details
    where lower(last_name) like '%hilmer%' or (lower(first_name) like '%philipp%' and lower(last_name) like '%hilmer%')
  loop
    raise notice 'HILMER: % % | Kategorie: % | Verein: % | TM: %', r.first_name, r.last_name, r.cat, r.club, r.tm;
  end loop;
end $$;
