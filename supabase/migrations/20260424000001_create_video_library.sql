-- ============================================================================
-- Video-Library für Berater: Stärken/Potenziale-Videos
-- ============================================================================

-- 1. Storage-Bucket 'player-videos'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'player-videos',
  'player-videos',
  true,
  31457280, -- 30 MB
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Storage-Policies: alle Authenticated lesen + schreiben (Upload-UI prüft Berater-Rolle clientseitig)
DROP POLICY IF EXISTS "player-videos-read" ON storage.objects;
CREATE POLICY "player-videos-read" ON storage.objects
  FOR SELECT USING (bucket_id = 'player-videos');

DROP POLICY IF EXISTS "player-videos-write" ON storage.objects;
CREATE POLICY "player-videos-write" ON storage.objects
  FOR ALL USING (bucket_id = 'player-videos' AND auth.role() = 'authenticated');

-- 2. Tabelle 'player_videos' — zentrale Clip-Bibliothek
CREATE TABLE IF NOT EXISTS player_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Video-Quelle (genau eine der beiden gesetzt)
  video_path TEXT,                -- Supabase Storage-Pfad
  video_url TEXT,                 -- externe URL (YouTube/Vimeo/MP4)
  -- Metadata
  label TEXT NOT NULL,            -- Stärken-/Potenzial-Label (z.B. "Ruhe unter Druck")
  description TEXT,               -- Beschreibungstext
  role_model_name TEXT,
  role_model_club TEXT,
  role_model_image_path TEXT,     -- optional Portrait im Storage
  -- Verwaltung
  created_by UUID,                -- FK zu advisors.id (nicht strikt enforced)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK ((video_path IS NOT NULL) OR (video_url IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_player_videos_label ON player_videos (label);
CREATE INDEX IF NOT EXISTS idx_player_videos_created_by ON player_videos (created_by);

-- 3. Tabelle 'player_video_assignments' — N:M Spieler × Video × Typ
CREATE TABLE IF NOT EXISTS player_video_assignments (
  player_id UUID REFERENCES player_details(id) ON DELETE CASCADE,
  video_id UUID REFERENCES player_videos(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('strength', 'potential')),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (player_id, video_id, type)
);

CREATE INDEX IF NOT EXISTS idx_player_video_assignments_player ON player_video_assignments (player_id, type);
CREATE INDEX IF NOT EXISTS idx_player_video_assignments_video ON player_video_assignments (video_id);

-- 4. RLS: lesen für alle Authenticated, schreiben für Authenticated (Berater-Rolle-Check clientseitig)
ALTER TABLE player_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_video_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "player_videos_read" ON player_videos;
CREATE POLICY "player_videos_read" ON player_videos
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "player_videos_write" ON player_videos;
CREATE POLICY "player_videos_write" ON player_videos
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "player_video_assignments_read" ON player_video_assignments;
CREATE POLICY "player_video_assignments_read" ON player_video_assignments
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "player_video_assignments_write" ON player_video_assignments;
CREATE POLICY "player_video_assignments_write" ON player_video_assignments
  FOR ALL USING (auth.role() = 'authenticated');
