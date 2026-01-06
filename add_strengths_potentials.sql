-- Add strengths and potentials fields to player_details
ALTER TABLE player_details ADD COLUMN IF NOT EXISTS strengths TEXT;
ALTER TABLE player_details ADD COLUMN IF NOT EXISTS potentials TEXT;
