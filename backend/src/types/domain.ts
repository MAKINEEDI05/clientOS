/** ClientOS memory categories. Asserted by ClientOS via Hindsight `type:` tags. */
export const MEMORY_TYPES = [
  'preference',
  'approval',
  'rejection',
  'decision',
  'constraint',
  'outcome',
  'preference_change',
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

/** Durability scope. Physically represented as a Hindsight `scope:` tag. */
export const MEMORY_SCOPES = ['interaction', 'revision', 'project', 'client', 'future'] as const;
export type MemoryScope = (typeof MEMORY_SCOPES)[number];

/** Mirrors Hindsight curation state plus a local "superseded but still valid" marker. */
export const MEMORY_STATES = ['valid', 'superseded', 'invalidated'] as const;
export type MemoryState = (typeof MEMORY_STATES)[number];

export const INTERACTION_SOURCES = ['meeting', 'design-review', 'revision', 'email', 'note'] as const;
export type InteractionSource = (typeof INTERACTION_SOURCES)[number];

export const RETAIN_STATUSES = ['pending', 'retained', 'failed', 'awaiting_confirmation', 'not_durable'] as const;
export type RetainStatus = (typeof RETAIN_STATUSES)[number];

export const CONFLICT_STATUSES = ['pending', 'resolved', 'dismissed'] as const;
export type ConflictStatus = (typeof CONFLICT_STATUSES)[number];

/** Scope choices offered in the conflict UI. `interaction` = temporary exception. */
export const CONFLICT_SCOPES = ['interaction', 'project', 'client', 'future'] as const;
export type ConflictScope = (typeof CONFLICT_SCOPES)[number];

export const DEMO_STAGES = ['empty', 'history', 'post_conflict'] as const;
export type DemoStage = (typeof DEMO_STAGES)[number];

export interface ClientRow {
  id: string;
  slug: string;
  name: string;
  hindsight_bank_id: string;
  industry: string | null;
  context: string | null;
  created_at: Date;
}

export interface ProjectRow {
  id: string;
  client_id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  created_at: Date;
}

export interface InteractionRow {
  id: string;
  client_id: string;
  project_id: string;
  label: string;
  label_slug: string;
  source: InteractionSource;
  content: string;
  occurred_at: Date;
  retain_status: RetainStatus;
  retain_error: string | null;
  hindsight_document_id: string | null;
  created_at: Date;
}

export interface MemoryRefRow {
  id: string;
  client_id: string;
  project_id: string | null;
  interaction_id: string | null;
  hindsight_memory_id: string | null;
  hindsight_document_id: string | null;
  memory_type: MemoryType;
  statement: string;
  scope: MemoryScope;
  tags: string[];
  state: MemoryState;
  confidence: number | null;
  source_quote: string | null;
  created_at: Date;
}

export interface MemoryLinkRow {
  id: string;
  from_memory_ref_id: string;
  to_memory_ref_id: string;
  relation: string;
  scope: MemoryScope;
  conflict_id: string | null;
  created_at: Date;
}

export interface ConflictRow {
  id: string;
  client_id: string;
  project_id: string;
  interaction_id: string | null;
  new_statement: string;
  new_memory_type: MemoryType;
  new_source_quote: string | null;
  new_confidence: number | null;
  old_memory_ref_id: string | null;
  old_statement: string;
  old_hindsight_memory_id: string | null;
  explanation: string;
  status: ConflictStatus;
  resolved_scope: ConflictScope | null;
  resolution: string | null;
  resolved_at: Date | null;
  created_at: Date;
}

export interface RecommendationRow {
  id: string;
  client_id: string;
  project_id: string;
  request_text: string;
  summary: string;
  items: RecommendationItem[];
  avoid: RecommendationItem[];
  notes: string[];
  evidence: EvidenceSnapshot[];
  memory_used: boolean;
  memory_count: number;
  hindsight_ok: boolean;
  model: string;
  latency_ms: number | null;
  created_at: Date;
}

export interface RecommendationItem {
  id: string;
  text: string;
  rationale: string;
  evidenceMemoryIds: string[];
}

/** Point-in-time snapshot of one recalled memory. Never mutated after the fact. */
export interface EvidenceSnapshot {
  memoryId: string;
  statement: string;
  memoryType: MemoryType | 'unknown';
  scope: MemoryScope | 'unknown';
  sourceLabel: string | null;
  occurredAt: string | null;
  tags: string[];
}
