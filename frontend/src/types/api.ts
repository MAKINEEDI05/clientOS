export type MemoryType =
  | 'preference' | 'approval' | 'rejection' | 'decision'
  | 'constraint' | 'outcome' | 'preference_change';

export type MemoryScope = 'interaction' | 'revision' | 'project' | 'client' | 'future';
export type MemoryState = 'valid' | 'superseded' | 'invalidated';
export type InteractionSource = 'meeting' | 'design-review' | 'revision' | 'email' | 'note';
export type RetainStatus = 'pending' | 'retained' | 'failed' | 'awaiting_confirmation' | 'not_durable';
export type ConflictScope = 'interaction' | 'project' | 'client' | 'future';

export type ErrorCode =
  | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'UNAUTHORIZED' | 'FORBIDDEN'
  | 'MEMORY_UNAVAILABLE' | 'LLM_UNAVAILABLE' | 'DATABASE_UNAVAILABLE'
  | 'PAYLOAD_TOO_LARGE' | 'INTERNAL' | 'NETWORK';

export interface ApiErrorShape {
  code: ErrorCode;
  message: string;
  details?: Array<{ field: string; message: string }>;
  requestId?: string;
}

export interface HealthStatus {
  connected: boolean;
  reason?: string;
  version?: string;
  configured: boolean;
  baseUrl: string;
  tenant: string;
  llmConfigured: boolean;
  model: string;
  demoStage: 'empty' | 'history' | 'post_conflict';
}

export interface ClientSummary {
  id: string;
  slug: string;
  name: string;
  industry: string | null;
  context: string | null;
  projectCount: number;
  interactionCount: number;
  openConflicts: number;
  lastInteractionAt: string | null;
  counts: Record<MemoryType, number>;
}

export interface ProjectSummary {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  status: string;
  interactionCount: number;
  memoryCount: number;
  openConflicts: number;
}

export interface ClientDetail {
  client: {
    id: string; slug: string; name: string;
    industry: string | null; context: string | null; hindsightBankId: string;
  };
  projects: ProjectSummary[];
}

export interface MemoryItem {
  id: string;
  hindsightMemoryId: string | null;
  memoryType: MemoryType;
  statement: string;
  scope: MemoryScope;
  state: MemoryState;
  tags: string[];
  confidence: number | null;
  sourceQuote: string | null;
  occurredAt: string;
  /** Owning project, or null when the memory is client-wide. */
  project: { id: string; slug: string | null; name: string | null } | null;
  interaction: { id: string | null; label: string; labelDisplay: string; source: string | null } | null;
  sourceLabelDisplay: string | null;
  supersedes: Array<{ memoryRefId: string; statement: string; scope: MemoryScope }>;
  supersededBy: { memoryRefId: string; statement: string; scope: MemoryScope } | null;
}

export interface ProjectDetail {
  project: { id: string; slug: string; name: string; status: string };
  client: { id: string; slug: string; name: string; context: string | null; hindsightBankId: string };
  memory: {
    preferences: MemoryItem[]; approvals: MemoryItem[]; rejections: MemoryItem[];
    constraints: MemoryItem[]; decisions: MemoryItem[]; outcomes: MemoryItem[]; changes: MemoryItem[];
  };
  memoryCount: number;
  openConflicts: number;
}

export interface Interaction {
  id: string;
  label: string;
  source: InteractionSource;
  content: string;
  occurredAt: string;
  retainStatus: RetainStatus;
  retainError: string | null;
  memoryCount: number;
  createdAt: string;
}

export interface EvidenceItem {
  memoryId: string;
  statement: string;
  memoryType: MemoryType | 'unknown';
  scope: MemoryScope | 'unknown';
  sourceLabel: string | null;
  sourceLabelDisplay: string | null;
  occurredAt: string | null;
  tags: string[];
}

export interface RecommendationLine {
  id: string;
  text: string;
  rationale: string;
  why: string;
  evidence: EvidenceItem[];
}

export interface Recommendation {
  recommendationId: string;
  memoryUsed: boolean;
  memoryCount: number;
  hindsightOk: boolean;
  summary: string;
  items: RecommendationLine[];
  avoid: RecommendationLine[];
  notes: string[];
  caveats: string[];
  model: string;
  latencyMs: number;
}

export interface Conflict {
  id: string;
  status: 'pending' | 'resolved' | 'dismissed';
  newStatement: string;
  newMemoryType: MemoryType;
  oldStatement: string;
  oldMemoryId: string | null;
  oldMemoryRefId: string | null;
  explanation: string;
  interactionLabel: string | null;
  resolvedScope: ConflictScope | null;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ExtractedCandidate {
  memoryType: MemoryType;
  statement: string;
  scope: MemoryScope;
  confidence: number;
  sourceQuote: string;
  retained: boolean;
  needsScopeConfirmation: boolean;
}

export interface SubmitInteractionResult {
  interaction: { id: string; label: string; source: string; content: string; occurredAt: string; retainStatus: RetainStatus };
  extracted: ExtractedCandidate[];
  discarded: Array<{ text: string; reason: string }>;
  retained: number;
  conflicts: Conflict[];
  warnings: string[];
}

export interface ResolveConflictResult {
  conflictId: string;
  status: string;
  resolvedScope: ConflictScope | null;
  newMemory: { memoryRefId: string; hindsightMemoryId: string | null; statement: string; scope: MemoryScope } | null;
  supersededMemory: { memoryRefId: string | null; statement: string; state: string } | null;
  directive: { id: string; scope: 'project' | 'client' } | null;
  warnings: string[];
}

export interface DemoResetResult {
  stage: string;
  clientId: string;
  projectId: string;
  clientSlug: string;
  projectSlug: string;
  interactionsSeeded: number;
  memoriesRetained: number;
  bankId: string;
  warnings: string[];
}

export interface CreateClientResult {
  client: { id: string; slug: string; name: string; industry: string | null; context: string | null };
  projectId: string | null;
  projectSlug: string | null;
  memoryReady: boolean;
}

export interface InvalidateMemoryResult {
  memoryRefId: string;
  statement: string;
  state: MemoryState;
  retiredInMemoryService: boolean;
  warnings: string[];
}
