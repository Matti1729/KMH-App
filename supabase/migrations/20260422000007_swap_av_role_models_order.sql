-- Reihenfolge der Role Models für "Außenverteidiger – Moderner Flügel"
-- an das Hero-Bild anpassen: links Davies (Bayern rot), rechts Hakimi (PSG dunkelblau)
UPDATE player_prototypes
SET role_models = ARRAY['Alphonso Davies', 'Achraf Hakimi']
WHERE name = 'Außenverteidiger – Moderner Flügel';
