-- Reihenfolge der Role Models für "Innenverteidiger – Spielstarker Athlet"
-- an das Hero-Bild anpassen: links Schlotterbeck (BVB gelb), rechts van Dijk (Liverpool rot)
UPDATE player_prototypes
SET role_models = ARRAY['Nico Schlotterbeck', 'Virgil van Dijk']
WHERE name = 'Innenverteidiger – Spielstarker Athlet';
