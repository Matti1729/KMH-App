-- Diagnose (nur RAISE NOTICE, keine Änderungen): welche aktiven Profile haben keinen
-- Transfermarkt-Link und wurden daher vom Sync nicht erfasst?
do $$
declare
  r record;
  c_active int;
  c_active_url int;
  c_all_url int;
begin
  select count(*) into c_active from player_details where (provision_only is null or provision_only = false);
  select count(*) into c_active_url from player_details where (provision_only is null or provision_only = false) and transfermarkt_url is not null and transfermarkt_url <> '';
  select count(*) into c_all_url from player_details where transfermarkt_url is not null and transfermarkt_url <> '';
  raise notice 'AKTIVE PROFILE (provision_only!=true): %', c_active;
  raise notice 'davon MIT Transfermarkt-URL: %', c_active_url;
  raise notice 'davon OHNE Transfermarkt-URL: %', c_active - c_active_url;
  raise notice 'ALLE player_details mit TM-URL (Sync-Basis): %', c_all_url;
  raise notice '--- Aktive Profile OHNE Transfermarkt-URL ---';
  for r in
    select last_name, first_name, coalesce(category,'-') as cat, coalesce(club,'-') as club
    from player_details
    where (provision_only is null or provision_only = false)
      and (transfermarkt_url is null or transfermarkt_url = '')
    order by category, last_name
  loop
    raise notice '  % %  | Kategorie: %  | Verein: %', r.last_name, r.first_name, r.cat, r.club;
  end loop;
end $$;
