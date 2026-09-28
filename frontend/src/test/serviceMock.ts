import { vi } from 'vitest';
import {
  CLIENT, CLIENT_WIDE, MOBILE, NORTHWIND_SUMMARY, VIVE_SUMMARY, WEBSITE,
  memory, projectDetail, recommendation,
} from './fixtures';
import type { EvidenceItem, MemoryItem } from '../types/api';

/**
 * Stand-in for the API layer.
 *
 * The numbers match what the real system was verified to return: the website
 * project has 9 decisions of its own, the mobile project 2, and both share the
 * ONE client-wide memory — 10 and 3 relevant memories respectively. A sibling
 * project's memories are never in a project's response, because they are never
 * recalled.
 */
export const WEBSITE_MEMORIES: MemoryItem[] = [
  ...Array.from({ length: 9 }, (_, i) =>
    memory({
      id: `w${i}`,
      statement: `The client prefers restrained colours (website decision ${i + 1}).`,
      sourceLabelDisplay: `Design Review #${i + 1}`,
    })),
  CLIENT_WIDE,
];

export const MOBILE_MEMORIES: MemoryItem[] = [
  ...Array.from({ length: 2 }, (_, i) =>
    memory({
      id: `a${i}`,
      statement: `The client wants simple navigation in the mobile app (decision ${i + 1}).`,
      project: { id: MOBILE.id, slug: MOBILE.slug, name: MOBILE.name },
      sourceLabelDisplay: `UX Review #${i + 1}`,
    })),
  CLIENT_WIDE,
];

function memoriesFor(projectId: string): MemoryItem[] {
  return projectId === MOBILE.id ? MOBILE_MEMORIES : WEBSITE_MEMORIES;
}

export const health = { app: vi.fn(), memory: vi.fn() };
export const clients = {
  list: vi.fn(), get: vi.fn(), memory: vi.fn(), conflicts: vi.fn(),
  create: vi.fn(), createProject: vi.fn(),
};
export const memories = { invalidate: vi.fn(), restore: vi.fn() };
export const projects = {
  get: vi.fn(), interactions: vi.fn(), memory: vi.fn(), conflicts: vi.fn(),
  submitInteraction: vi.fn(),
};
export const agent = { recommend: vi.fn(), getRecommendation: vi.fn(), feedback: vi.fn() };
export const conflicts = { resolve: vi.fn() };
export const demo = { state: vi.fn(), reset: vi.fn() };

/** Point every call at the two-project fixture client. Call in beforeEach. */
export function resetServiceMock(): void {
  vi.clearAllMocks();

  health.memory.mockResolvedValue({
    connected: true, configured: true, baseUrl: 'https://example.invalid',
    tenant: 'demo', llmConfigured: true, model: 'openai/gpt-oss-120b', demoStage: 'history',
  });

  clients.list.mockResolvedValue({ clients: [VIVE_SUMMARY, NORTHWIND_SUMMARY] });
  clients.get.mockResolvedValue(CLIENT);
  clients.conflicts.mockResolvedValue({ conflicts: [] });
  // Every project's memory, which is what the all-client timeline view asks for.
  clients.memory.mockResolvedValue({
    memories: [...WEBSITE_MEMORIES.filter((m) => m.project !== null),
      ...MOBILE_MEMORIES.filter((m) => m.project !== null), CLIENT_WIDE],
    total: 12,
  });
  clients.createProject.mockResolvedValue({ project: MOBILE });

  projects.get.mockImplementation(async (projectId: string) =>
    projectDetail(projectId === MOBILE.id ? MOBILE : WEBSITE, memoriesFor(projectId)));
  projects.memory.mockImplementation(async (projectId: string) => ({
    memories: memoriesFor(projectId),
    total: memoriesFor(projectId).length,
    bankId: 'client-vive-studio',
  }));
  projects.conflicts.mockResolvedValue({ conflicts: [] });
  projects.interactions.mockResolvedValue({ interactions: [], total: 0 });
  projects.submitInteraction.mockResolvedValue({
    interaction: {
      id: 'i-new', label: 'Revision #6', source: 'revision', content: 'Brighter, please.',
      occurredAt: '2026-09-27T10:00:00Z', retainStatus: 'retained',
    },
    extracted: [], discarded: [], retained: 1, conflicts: [], warnings: [],
  });

  // The response reflects the project and the memory setting it was asked for, so
  // a test can tell whether the right context was used.
  agent.recommend.mockImplementation(async (body: {
    projectId: string; useMemory?: boolean;
  }) => {
    const used = body.useMemory !== false;
    const pool = memoriesFor(body.projectId);
    const count = pool.length;

    // Evidence mirrors the shape the backend returns: bound to recalled memories
    // when memory was used, and empty when it was not.
    const evidence: EvidenceItem[] = used
      ? pool.slice(0, 2).map((m) => ({
          memoryId: m.hindsightMemoryId ?? m.id,
          statement: m.statement,
          memoryType: m.memoryType,
          scope: m.scope,
          sourceLabel: m.sourceLabelDisplay?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? null,
          sourceLabelDisplay: m.sourceLabelDisplay,
          occurredAt: m.occurredAt,
          tags: m.tags,
        }))
      : [];

    return recommendation({
      memoryUsed: used,
      memoryCount: used ? count : 0,
      summary: used
        ? `Grounded direction for ${body.projectId === MOBILE.id ? 'the mobile app' : 'the website'}.`
        : 'A generic direction with no client history.',
      items: [{
        id: 'item-1',
        text: used ? 'Keep the palette restrained.' : 'Use a clear visual hierarchy.',
        rationale: used ? 'The client has said so before.' : 'General practice.',
        why: used ? 'The client prefers restrained colours.' : 'General design practice.',
        evidence,
      }],
      avoid: [],
    });
  });
}
