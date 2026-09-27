-- Optional human description for a project, shown in the workspace.
-- Additive and nullable: existing rows and the seed path are unaffected.
ALTER TABLE projects ADD COLUMN description text;
