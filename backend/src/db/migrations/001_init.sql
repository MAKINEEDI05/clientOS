-- ClientOS application metadata. Memory itself lives in Hindsight.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text NOT NULL UNIQUE,
  name               text NOT NULL,
  -- One Hindsight bank per client. This column is the cross-system join.
  hindsight_bank_id  text NOT NULL UNIQUE,
  industry           text,
  context            text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  slug        text NOT NULL,
  name        text NOT NULL,
  status      text NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'paused', 'complete', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, slug)
);

CREATE TABLE interactions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id              uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id             uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label                  text NOT NULL,
  label_slug             text NOT NULL,
  source                 text NOT NULL
                         CHECK (source IN ('meeting', 'design-review', 'revision', 'email', 'note')),
  content                text NOT NULL,
  occurred_at            timestamptz NOT NULL,
  retain_status          text NOT NULL DEFAULT 'pending'
                         CHECK (retain_status IN ('pending','retained','failed','awaiting_confirmation','not_durable')),
  retain_error           text,
  hindsight_document_id  text,
  created_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  -- Prevents the duplicate-submission case (Edge case 1.8 / 3.3 / 3.4).
  UNIQUE (project_id, label)
);
