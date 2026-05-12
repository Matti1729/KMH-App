-- Phase-Spalte für Potenzial-Videos: Negativ- + Positiv-Beispiel-Paare
-- Stärken bleiben 'neutral' (unverändert, Default), Potenziale bekommen 'negative' oder 'positive'
ALTER TABLE player_videos
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'neutral'
    CHECK (phase IN ('negative', 'positive', 'neutral'));

-- Index für schnelles Sortieren pro Label/Typ
CREATE INDEX IF NOT EXISTS idx_player_videos_phase ON player_videos (phase);
