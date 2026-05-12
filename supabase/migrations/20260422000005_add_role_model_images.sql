-- Parallel-Array für Role-Model-Bilder (index-synchron zu role_models)
ALTER TABLE player_prototypes
  ADD COLUMN IF NOT EXISTS role_model_images TEXT[] DEFAULT '{}';
