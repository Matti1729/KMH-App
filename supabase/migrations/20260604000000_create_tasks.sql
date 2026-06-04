-- Aufgaben / To-Dos für Berater (Tabellenname: advisor_tasks, weil
-- "tasks" bereits anderweitig in der Produktiv-DB belegt ist).
-- scope='team': für alle Berater sichtbar (gemeinsame Punkte wie "Trainingscamps 2027",
-- "Anbieter Partner finden"). owner_advisor_id ist NULL.
-- scope='personal': private Aufgaben eines einzelnen Beraters.
-- owner_advisor_id ist gesetzt.
CREATE TABLE IF NOT EXISTS advisor_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('team', 'personal')),
  owner_advisor_id UUID REFERENCES advisors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES advisors(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Konsistenz: team-Tasks haben keinen Owner, personal-Tasks brauchen einen
  CONSTRAINT advisor_tasks_scope_owner_check CHECK (
    (scope = 'team' AND owner_advisor_id IS NULL) OR
    (scope = 'personal' AND owner_advisor_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_advisor_tasks_scope_owner ON advisor_tasks(scope, owner_advisor_id);
CREATE INDEX IF NOT EXISTS idx_advisor_tasks_completed ON advisor_tasks(completed_at);

ALTER TABLE advisor_tasks ENABLE ROW LEVEL SECURITY;

-- SELECT: Team-Tasks sehen alle authenticated; persönliche Tasks nur der Owner.
CREATE POLICY advisor_tasks_select ON advisor_tasks FOR SELECT TO authenticated USING (
  scope = 'team' OR owner_advisor_id = auth.uid()
);

-- INSERT: Berater darf Team- und eigene persönliche Tasks anlegen.
CREATE POLICY advisor_tasks_insert ON advisor_tasks FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid() AND (
    (scope = 'team' AND owner_advisor_id IS NULL) OR
    (scope = 'personal' AND owner_advisor_id = auth.uid())
  )
);

-- UPDATE: Team-Tasks darf jeder togglen/umbenennen (kollaborativ); persönliche nur der Owner.
CREATE POLICY advisor_tasks_update ON advisor_tasks FOR UPDATE TO authenticated USING (
  scope = 'team' OR owner_advisor_id = auth.uid()
) WITH CHECK (
  scope = 'team' OR owner_advisor_id = auth.uid()
);

-- DELETE: Team-Tasks darf nur der Ersteller löschen; persönliche nur der Owner.
CREATE POLICY advisor_tasks_delete ON advisor_tasks FOR DELETE TO authenticated USING (
  (scope = 'team' AND created_by = auth.uid()) OR
  (scope = 'personal' AND owner_advisor_id = auth.uid())
);
