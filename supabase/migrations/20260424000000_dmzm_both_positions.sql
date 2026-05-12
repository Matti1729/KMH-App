-- Der DM/ZM-Prototyp soll beide Positionen (DM + ZM) im Spielfeld grün markiert haben
UPDATE player_prototypes
SET position_codes = ARRAY['DM', 'ZM']
WHERE name = 'DM/ZM – B2B & Verbindungsspieler';
