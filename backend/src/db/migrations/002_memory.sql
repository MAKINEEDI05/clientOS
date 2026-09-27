-- Pointers into Hindsight plus a display cache for the timeline.
-- Hindsight remains authoritative: hindsight_memory_id is the source of truth.
CREATE TABLE memory_refs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id              uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id             uuid REFERENCES projects(id) ON DELETE CASCADE,
  interaction_id         uuid REFERENCES interactions(id) ON DELETE SET NULL,
  -- NULL until reconciled against Hindsight (retain does not return memory ids).
  hindsight_memory_id    text,
  hindsight_document_id  text,
  memory_type            text NOT NULL
                         CHECK (memory_type IN ('preference','approval','rejection','decision','constraint','outcome','preference_change')),
  statement              text NOT NULL,
  scope                  text NOT NULL
                         CHECK (scope IN ('interaction','revision','project','client','future')),
  tags                   jsonb NOT NULL DEFAULT '[]'::jsonb,
  state                  text NOT NULL DEFAULT 'valid'
                         CHECK (state IN ('valid','superseded','invalidated')),
  confidence             numeric(3,2) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  source_quote           text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- The supersession graph Hindsight does not model.
CREATE TABLE memory_links (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_memory_ref_id  uuid NOT NULL REFERENCES memory_refs(id) ON DELETE CASCADE,
  to_memory_ref_id    uuid NOT NULL REFERENCES memory_refs(id) ON DELETE CASCADE,
  relation            text NOT NULL DEFAULT 'supersedes'
                      CHECK (relation IN ('supersedes','refines','contradicts')),
  scope               text NOT NULL
                      CHECK (scope IN ('interaction','revision','project','client','future')),
  conflict_id         uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (from_memory_ref_id <> to_memory_ref_id),
  UNIQUE (from_memory_ref_id, to_memory_ref_id, relation)
);

-- Local record of tag-scoped Hindsight directives (hard rules applied during reflect).
CREATE TABLE hindsight_directives (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id              uuid REFERENCES projects(id) ON DELETE CASCADE,
  hindsight_directive_id  text NOT NULL,
  name                    text NOT NULL,
  content                 text NOT NULL,
  scope                   text NOT NULL CHECK (scope IN ('project','client')),
  tags                    jsonb NOT NULL DEFAULT '[]'::jsonb,
  conflict_id             uuid,
  is_active               boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now()
);
