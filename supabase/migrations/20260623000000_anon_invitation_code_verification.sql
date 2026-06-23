-- Anonyme Einladungscode-Prüfung für Login / Registrierung.
--
-- Problem: Der Login-Screen ist NICHT authentifiziert. `player_details` und
-- `settings` sind per RLS nur für die Rolle `authenticated` lesbar. Dadurch
-- liefert die direkte anon-Abfrage des Codes immer ein leeres Ergebnis →
-- jeder gültige Spieler-/Berater-Code wird fälschlich als "ungültig" abgelehnt.
--
-- Lösung: Die Prüfung in SECURITY-DEFINER-Funktionen kapseln, die der anon-Rolle
-- NUR das Nötigste zurückgeben (kein breiter Lesezugriff auf die Tabellen).
-- Ein Treffer ist nur bei exakt passendem Code möglich; es lässt sich nichts
-- enumerieren, was das Feature nicht ohnehin offenlegt.

-- Spieler-Einladungscode → minimale Spielerdaten (oder NULL bei keinem Treffer).
-- Rückgabe als jsonb, damit die Funktion unabhängig von den konkreten
-- Spaltentypen der player_details-Tabelle ist.
create or replace function public.verify_player_invitation_code(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(t) from (
    select
      pd.id,
      pd.first_name,
      pd.last_name,
      (pd.linked_user_id is not null) as already_linked
    from player_details pd
    where pd.invitation_code is not null
      and pd.invitation_code = upper(trim(p_code))
    limit 1
  ) t;
$$;

revoke all on function public.verify_player_invitation_code(text) from public;
grant execute on function public.verify_player_invitation_code(text) to anon, authenticated;

-- Berater-Einladungscode → gültig (true) / ungültig (false).
-- Vergleicht mit settings.value bei key = 'invitation_code'.
create or replace function public.verify_advisor_invitation_code(p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from settings
    where key = 'invitation_code'
      and value is not null
      and value = trim(p_code)
  );
$$;

revoke all on function public.verify_advisor_invitation_code(text) from public;
grant execute on function public.verify_advisor_invitation_code(text) to anon, authenticated;
