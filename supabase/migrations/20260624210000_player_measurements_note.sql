-- Optionale Notiz/Ort je Mess-Eintrag (z.B. "wo wurde der Test gemacht").
alter table public.player_measurements add column if not exists note text;
