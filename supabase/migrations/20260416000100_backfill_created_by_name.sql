-- Rückwirkend: Bestehende Kontakte ohne created_by_name auf "Matti" setzen
UPDATE football_network_contacts
SET created_by_name = 'Matti'
WHERE created_by_name IS NULL;
