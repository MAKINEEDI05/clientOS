CREATE INDEX idx_projects_client              ON projects(client_id);

CREATE INDEX idx_interactions_timeline        ON interactions(project_id, occurred_at DESC);
CREATE INDEX idx_interactions_client          ON interactions(client_id);
CREATE INDEX idx_interactions_retain_status   ON interactions(retain_status)
  WHERE retain_status <> 'retained';

CREATE INDEX idx_memory_refs_project          ON memory_refs(project_id, created_at DESC);
CREATE INDEX idx_memory_refs_client           ON memory_refs(client_id, created_at DESC);
CREATE UNIQUE INDEX idx_memory_refs_hs_id     ON memory_refs(hindsight_memory_id)
  WHERE hindsight_memory_id IS NOT NULL;
CREATE INDEX idx_memory_refs_type_state       ON memory_refs(project_id, memory_type, state);
CREATE INDEX idx_memory_refs_interaction      ON memory_refs(interaction_id);

CREATE INDEX idx_memory_links_from            ON memory_links(from_memory_ref_id);
CREATE INDEX idx_memory_links_to              ON memory_links(to_memory_ref_id);

CREATE INDEX idx_conflicts_open               ON preference_conflicts(project_id, status)
  WHERE status = 'pending';
CREATE INDEX idx_conflicts_client             ON preference_conflicts(client_id);

CREATE INDEX idx_recommendations_project      ON recommendations(project_id, created_at DESC);
CREATE INDEX idx_feedback_recommendation      ON recommendation_feedback(recommendation_id);

CREATE INDEX idx_directives_client            ON hindsight_directives(client_id) WHERE is_active;
