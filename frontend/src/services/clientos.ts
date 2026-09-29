import { request } from '../lib/api';
import type {
  ClientDetail, ClientSummary, Conflict, CreateClientResult, DeleteClientResult, DemoResetResult, HealthStatus,
  Interaction, InvalidateMemoryResult, MemoryItem, ProjectDetail, ProjectSummary,
  Recommendation, ResolveConflictResult, SubmitInteractionResult,
  ConflictScope, InteractionSource,
} from '../types/api';

/** Every backend call the UI makes lives here. Components never call fetch. */

export const health = {
  app: () => request<{ status: string; db: boolean; uptimeMs: number }>('/health'),
  memory: () => request<HealthStatus>('/health/hindsight'),
};

export const clients = {
  list: (signal?: AbortSignal) => request<{ clients: ClientSummary[] }>('/clients', { signal }),
  get: (clientId: string, signal?: AbortSignal) =>
    request<ClientDetail>(`/clients/${encodeURIComponent(clientId)}`, { signal }),
  memory: (clientId: string, signal?: AbortSignal) =>
    request<{ memories: MemoryItem[]; total: number }>(
      `/clients/${encodeURIComponent(clientId)}/memory`, { signal }),
  conflicts: (clientId: string, status = 'pending', signal?: AbortSignal) =>
    request<{ conflicts: Conflict[] }>(
      `/clients/${encodeURIComponent(clientId)}/conflicts?status=${status}`, { signal }),

  /** Creates the client and provisions its memory automatically. */
  create: (body: { name: string; description?: string; firstProjectName?: string }) =>
    request<CreateClientResult>('/clients', { method: 'POST', body }),

  createProject: (clientId: string, body: { name: string; description?: string }) =>
    request<{ project: ProjectSummary }>(
      `/clients/${encodeURIComponent(clientId)}/projects`, { method: 'POST', body }),

  /**
   * Permanently delete a client, its projects, everything recorded for them and
   * its memory bank. Addressed by client id, never slug. Like the demo reset, the
   * server requires the admin token — supplied by the person at call time, never
   * stored or bundled with the frontend.
   */
  remove: (clientId: string, token: string) =>
    request<DeleteClientResult>(`/clients/${encodeURIComponent(clientId)}`, {
      method: 'DELETE', headers: { 'x-demo-token': token },
    }),
};

export const memories = {
  /** Retires a memory from active reasoning. Never deletes — it stays as history. */
  invalidate: (memoryId: string, reason?: string) =>
    request<InvalidateMemoryResult>(
      `/memories/${encodeURIComponent(memoryId)}/invalidate`,
      { method: 'POST', body: reason ? { reason } : {} }),

  restore: (memoryId: string) =>
    request<InvalidateMemoryResult>(
      `/memories/${encodeURIComponent(memoryId)}/restore`, { method: 'POST', body: {} }),
};

export const projects = {
  get: (projectId: string, signal?: AbortSignal) =>
    request<ProjectDetail>(`/projects/${encodeURIComponent(projectId)}`, { signal }),
  interactions: (projectId: string, signal?: AbortSignal) =>
    request<{ interactions: Interaction[]; total: number }>(
      `/projects/${encodeURIComponent(projectId)}/interactions`, { signal }),
  memory: (projectId: string, query = '', signal?: AbortSignal) =>
    request<{ memories: MemoryItem[]; total: number; bankId: string }>(
      `/projects/${encodeURIComponent(projectId)}/memory${query}`, { signal }),
  conflicts: (projectId: string, status = 'pending', signal?: AbortSignal) =>
    request<{ conflicts: Conflict[] }>(
      `/projects/${encodeURIComponent(projectId)}/conflicts?status=${status}`, { signal }),
  submitInteraction: (
    projectId: string,
    body: { label: string; source: InteractionSource; content: string; occurredAt?: string },
  ) =>
    request<SubmitInteractionResult>(`/projects/${encodeURIComponent(projectId)}/interactions`, {
      method: 'POST', body,
    }),
};

export const agent = {
  recommend: (
    body: { clientId: string; projectId: string; message: string; useMemory?: boolean },
    signal?: AbortSignal,
  ) => request<Recommendation>('/agent/recommend', { method: 'POST', body, signal }),
  getRecommendation: (id: string, signal?: AbortSignal) =>
    request<Recommendation>(`/agent/recommendations/${encodeURIComponent(id)}`, { signal }),
  feedback: (id: string, body: { verdict: 'accepted' | 'rejected' | 'corrected'; comment?: string }) =>
    request<{ feedbackId: string; retained: number; warnings: string[] }>(
      `/agent/recommendations/${encodeURIComponent(id)}/feedback`, { method: 'POST', body }),
};

export const conflicts = {
  resolve: (
    conflictId: string,
    body: { resolution: 'new_preference' | 'keep_existing' | 'dismissed'; scope?: ConflictScope },
  ) =>
    request<ResolveConflictResult>(`/conflicts/${encodeURIComponent(conflictId)}/resolve`, {
      method: 'POST', body,
    }),
};

export const demo = {
  state: () => request<{ stage: string; demoRequest: string }>('/demo/state'),
  reset: (stage: 'empty' | 'history' | 'post_conflict', token: string) =>
    request<DemoResetResult>('/demo/reset', {
      method: 'POST', body: { stage }, headers: { 'x-demo-token': token },
    }),
};
