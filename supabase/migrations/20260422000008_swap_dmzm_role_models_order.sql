-- Reihenfolge der Role Models für "DM/ZM – B2B & Verbindungsspieler"
-- an das Hero-Bild anpassen: links Modric (AC Milan rot-schwarz), rechts Szoboszlai (Liverpool rot)
UPDATE player_prototypes
SET role_models = ARRAY['Luka Modric', 'Dominik Szoboszlai']
WHERE name = 'DM/ZM – B2B & Verbindungsspieler';
