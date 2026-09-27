-- Single-row table controlling which demo history stage is loaded.
CREATE TABLE demo_state (
  id          boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  stage       text NOT NULL DEFAULT 'empty' CHECK (stage IN ('empty','history','post_conflict')),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO demo_state (id, stage) VALUES (true, 'empty')
ON CONFLICT (id) DO NOTHING;
