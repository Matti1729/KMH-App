-- Screenshot zum Feedback speichern (als Data-URL), damit der Admin das Bild sieht.
alter table public.feedback add column if not exists image_data text;
