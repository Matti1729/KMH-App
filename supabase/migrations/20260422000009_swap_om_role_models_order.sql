-- Reihenfolge der Role Models für "Offensives Mittelfeld – Kreativspieler"
-- an das Hero-Bild anpassen: links Musiala (Bayern rot, #42), rechts Xavi Simons (NL orange, #7)
-- Außerdem 'Xavi' → 'Xavi Simons' umbenennen
UPDATE player_prototypes
SET role_models = ARRAY['Jamal Musiala', 'Xavi Simons']
WHERE name = 'Offensives Mittelfeld – Kreativspieler';
