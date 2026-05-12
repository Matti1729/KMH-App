-- Korrektur: der RB-Leipzig-Spieler heißt Yan Diomande (nicht Malick Diomande)
UPDATE player_prototypes
SET role_models = ARRAY['Lamine Yamal', 'Yan Diomande', 'Michael Olise']
WHERE name = 'Außenbahn – Dribbler';
