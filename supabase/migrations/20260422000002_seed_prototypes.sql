-- Seed: Initiale Positions-Prototypen
-- Kann mehrfach ausgeführt werden (ON CONFLICT DO NOTHING bei gleichem Namen)

-- Außenverteidiger (Linker + Rechter)
INSERT INTO player_prototypes (name, position_code, description, requirements, role_models, attributes) VALUES
(
  'Außenverteidiger – Moderner Flügel',
  'LV',
  E'- schaltet sich immer nach vorne mit ein, hinterläuft und überläuft viel\n- 1v1 Spieler sowohl offensiv als auch defensiv\n- viel Geschwindigkeit gepaart mit Ausdauer\n- Qualität in Flanken, Rückpässe\n- "an mir kommt keiner vorbei"-Mentalität',
  ARRAY['Athletik / Tempo', '1v1', 'Flanken'],
  ARRAY['Hakimi', 'Alphonso Davies'],
  '{"tempo":9,"technik":7,"koerper":7,"kopfball":5,"schuss":6}'::jsonb
),
(
  'Außenverteidiger – Moderner Flügel',
  'RV',
  E'- schaltet sich immer nach vorne mit ein, hinterläuft und überläuft viel\n- 1v1 Spieler sowohl offensiv als auch defensiv\n- viel Geschwindigkeit gepaart mit Ausdauer\n- Qualität in Flanken, Rückpässe\n- "an mir kommt keiner vorbei"-Mentalität',
  ARRAY['Athletik / Tempo', '1v1', 'Flanken'],
  ARRAY['Hakimi', 'Alphonso Davies'],
  '{"tempo":9,"technik":7,"koerper":7,"kopfball":5,"schuss":6}'::jsonb
),

-- Innenverteidiger
(
  'Innenverteidiger – Spielstarker Athlet',
  'IV',
  E'- nach vorne verteidigen, große Räume im Rücken verteidigen, gutes frontales 1v1 Verhalten\n- guter, gelassener Spielaufbau unter Druck, Ebenen überspielen oder überdribbeln\n- "an mir kommt keiner vorbei"-Mentalität / Charakter (lautstark)\n- immer online sein',
  ARRAY['Athletik / Tempo', 'Spielaufbau', 'Defensives Bewusstsein'],
  ARRAY['Virgil van Dijk', 'Nico Schlotterbeck'],
  '{"tempo":8,"technik":7,"koerper":9,"kopfball":8,"schuss":5}'::jsonb
),

-- DM Spielmacher
(
  'DM – Spielmacher',
  'DM',
  E'- immer in Anspielposition, auch unter Druck — sehr sauberes Passspiel, wenn freier Fuß dann vertikal\n- hohes Spielverständnis, wissen wohin man sich bewegt und welchen Pass man spielt\n- sehr gute Vororientierung\n- weiß jederzeit was um ihn rum passiert\n- aggressives Verteidigen in Ballnähe, gutes Anschlussverhalten\n- immer online, hohe Antizipation\n- macht keine Fehler, hohes Bewusstsein für Entscheidungen',
  ARRAY['Spielintelligenz / Strategische Skills', 'Technische Fähigkeiten', 'Keine Fehler'],
  ARRAY['Joshua Kimmich', 'Vitinha', 'Toni Kroos'],
  '{"tempo":6,"technik":9,"koerper":7,"kopfball":5,"schuss":7}'::jsonb
),

-- DM/ZM B2B
(
  'DM/ZM – B2B & Verbindungsspieler',
  'ZM',
  E'- gute Anspielbarkeit zwischen den Linien, bewegt sich schlau\n- hohes Spielverständnis, sehr gute Vororientierung\n- sehr gute Entscheidungsfindung auch unter Druck\n- gegnerüberwindendes Dribbling\n- aggressives Verteidigen in Ballnähe, gutes Anschlussverhalten\n- hohe Intensität im Spiel / viel unterwegs\n- sauberer erster Kontakt, präzise kurze und lange Bälle\n- spielt vorletzte Pässe\n- kann Ball halten',
  ARRAY['Spielintelligenz / Strategische Skills', 'Technische Fähigkeiten', 'Athletik'],
  ARRAY['Dominik Szoboszlai', 'Luka Modric'],
  '{"tempo":7,"technik":8,"koerper":8,"kopfball":6,"schuss":7}'::jsonb
),

-- OM Kreativ
(
  'Offensives Mittelfeld – Kreativspieler',
  'OM',
  E'- gutes Bewegen zwischen den Linien, bewegt sich schlau\n- dynamische Bewegungen\n- sehr gute Vororientierung\n- Ballsicherheit unter Druck\n- letzter Pass, vorletzter Pass\n- 1v1, Spielen & Gehen\n- guter Impuls im Anlaufen',
  ARRAY['Athletik', 'Technische Fähigkeiten / Kreativität', '1v1 / Torgefahr'],
  ARRAY['Xavi', 'Jamal Musiala'],
  '{"tempo":7,"technik":10,"koerper":6,"kopfball":5,"schuss":8}'::jsonb
),

-- Außenbahnspieler (Links + Rechts)
(
  'Außenbahn – Dribbler',
  'LA',
  E'- 1v1 Spieler auch auf engem Raum und im Halbraum\n- explosive Dribblings nach Innen und nach außen, Torgefahr und Flankenspiel\n- Technik, Explosivität sind Grundvoraussetzungen\n- Tiefenläufe, Spielen & Gehen\n- guter Impuls beim Anlaufen',
  ARRAY['Sprintfähigkeiten', 'Technische Fähigkeiten', '1v1 / Torgefahr'],
  ARRAY['Lamine Yamal', 'Malick Diomande', 'Michael Olise'],
  '{"tempo":9,"technik":9,"koerper":6,"kopfball":5,"schuss":8}'::jsonb
),
(
  'Außenbahn – Dribbler',
  'RA',
  E'- 1v1 Spieler auch auf engem Raum und im Halbraum\n- explosive Dribblings nach Innen und nach außen, Torgefahr und Flankenspiel\n- Technik, Explosivität sind Grundvoraussetzungen\n- Tiefenläufe, Spielen & Gehen\n- guter Impuls beim Anlaufen',
  ARRAY['Sprintfähigkeiten', 'Technische Fähigkeiten', '1v1 / Torgefahr'],
  ARRAY['Lamine Yamal', 'Malick Diomande', 'Michael Olise'],
  '{"tempo":9,"technik":9,"koerper":6,"kopfball":5,"schuss":8}'::jsonb
),

-- Stürmer Mitspielende Spitze
(
  'Stürmer – Mitspielende Spitze',
  'ST',
  E'- Boxbesetzung / Box belaufen\n- kann Bälle festmachen und klatschen lassen\n- kann Tiefenläufe machen\n- lässt sich auch mal fallen in Halbräume\n- 1v1 auf engem Raum und Gelassenheit\n- läuft in hohem Tempo an',
  ARRAY['1v1 / Torgefahr', 'Sprintfähigkeiten', 'Wandspieler'],
  ARRAY['Robert Lewandowski', 'Erling Haaland', 'Hugo Ekitiké'],
  '{"tempo":8,"technik":8,"koerper":9,"kopfball":8,"schuss":10}'::jsonb
);
