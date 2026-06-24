-- Reparatur: Patrices bestehender Account hat keine advisors-Zeile (advisor-Insert
-- war durch die alte role-CHECK-Constraint gescheitert -> galt als Spieler).
-- Wir legen die advisors-Zeile mit role='athletiktrainer' an (Login/Passwort bleiben).
-- Name/E-Mail kommen aus seinen Anmeldedaten in auth.users.

do $$
declare
  v_id uuid; v_email text; v_fn text; v_ln text;
begin
  select id, email,
         coalesce(raw_user_meta_data->>'first_name',''),
         coalesce(raw_user_meta_data->>'last_name','')
    into v_id, v_email, v_fn, v_ln
  from auth.users
  where lower(email) = lower('patrice.bochinger@web.de')
  limit 1;

  if v_id is null then
    raise notice 'REPAIR: kein auth.users-Eintrag fuer diese E-Mail gefunden';
  else
    insert into public.advisors (id, email, first_name, last_name, role, created_at, updated_at)
    values (v_id, v_email, v_fn, v_ln, 'athletiktrainer', now(), now())
    on conflict (id) do update set role = 'athletiktrainer';
    raise notice 'REPAIR: advisors-Zeile fuer % (% %) als athletiktrainer gesetzt', v_email, v_fn, v_ln;
  end if;
end $$;
