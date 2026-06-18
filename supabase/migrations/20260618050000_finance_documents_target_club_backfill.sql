-- Bestandsdokumente bekommen ihren target_club einmalig nachgetragen, basierend
-- auf dem damals aktuellen Verein des Spielers. Damit ändert sich die
-- Vereins-Anzeige in der Documents-Liste in Zukunft nicht mehr, wenn der
-- Spieler den Verein wechselt — Verträge frieren ihren Vereinsbezug ein.
UPDATE finance_documents fd
   SET target_club = pd.club
  FROM player_details pd
 WHERE fd.target_club IS NULL
   AND fd.player_id = pd.id
   AND pd.club IS NOT NULL;
