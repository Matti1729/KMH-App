-- Role-Model-Feld für Prototypen (Vergleichs-Spieler)

ALTER TABLE player_prototypes
  ADD COLUMN IF NOT EXISTS role_models TEXT[] DEFAULT '{}';
