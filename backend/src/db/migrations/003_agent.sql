-- A detected preference conflict awaiting human scope confirmation.
-- Nothing is retained in Hindsight until this is resolved.
CREATE TABLE preference_conflicts (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id               uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  interaction_id           uuid REFERENCES interactions(id) ON DELETE CASCADE,
  new_statement            text NOT NULL,
  new_memory_type          text NOT NULL
                           CHECK (new_memory_type IN ('preference','approval','rejection','decision','constraint','outcome','preference_change')),
  new_source_quote         text,
  new_confidence           numeric(3,2),
  old_memory_ref_id        uuid REFERENCES memory_refs(id) ON DELETE SET NULL,
  old_statement            text NOT NULL,
  old_hindsight_memory_id  text,
  explanation              text NOT NULL,
  status                   text NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','resolved','dismissed')),
  resolved_scope           text CHECK (resolved_scope IS NULL OR resolved_scope IN ('interaction','project','client','future')),
  resolution               text CHECK (resolution IS NULL OR resolution IN ('new_preference','keep_existing','dismissed')),
  resolved_by              uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE memory_links
  ADD CONSTRAINT memory_links_conflict_fk
  FOREIGN KEY (conflict_id) REFERENCES preference_conflicts(id) ON DELETE SET NULL;

ALTER TABLE hindsight_directives
  ADD CONSTRAINT hindsight_directives_conflict_fk
  FOREIGN KEY (conflict_id) REFERENCES preference_conflicts(id) ON DELETE SET NULL;

-- Audit of agent outputs. `evidence` is a point-in-time snapshot and must not
-- change when memory later changes, hence jsonb rather than a join.
CREATE TABLE recommendations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  request_text   text NOT NULL,
  summary        text NOT NULL,
  items          jsonb NOT NULL DEFAULT '[]'::jsonb,
  avoid          jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes          jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Honesty flags: never claim memory was used when these are false.
  memory_used    boolean NOT NULL,
  memory_count   integer NOT NULL DEFAULT 0,
  hindsight_ok   boolean NOT NULL,
  model          text NOT NULL,
  latency_ms     integer,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recommendation_feedback (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id      uuid NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  verdict                text NOT NULL CHECK (verdict IN ('accepted','rejected','corrected')),
  comment                text,
  retained_memory_ref_id uuid REFERENCES memory_refs(id) ON DELETE SET NULL,
  created_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now()
);
