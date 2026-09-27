import type {
  ClientDetail, Conflict, MemoryItem, ProjectDetail, ProjectSummary, Recommendation,
} from '../types/api';

/**
 * Shared test data shaped exactly like the API responses.
 *
 * One client with TWO projects, because that is the case the product has to get
 * right: the active project decides which memories are in play, and a sibling
 * project's decisions must never appear.
 */

export const WEBSITE: ProjectSummary = {
  id: 'p-web', slug: 'premium-website-redesign', name: 'Premium Website Redesign',
  description: 'Full redesign of the marketing site.', status: 'active',
  interactionCount: 8, memoryCount: 10, openConflicts: 0,
};

export const MOBILE: ProjectSummary = {
  id: 'p-app', slug: 'mobile-app', name: 'Mobile App',
  description: 'Companion mobile app.', status: 'active',
  interactionCount: 2, memoryCount: 3, openConflicts: 0,
};

export const CLIENT: ClientDetail = {
  client: {
    id: 'c-vive', slug: 'vive-studio', name: 'Vive Studio',
    industry: 'Design', context: 'Premium studio.', hindsightBankId: 'client-vive-studio',
  },
  projects: [WEBSITE, MOBILE],
};

export function memory(over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: 'm1',
    hindsightMemoryId: 'hm1',
    memoryType: 'preference',
    statement: 'The client prefers restrained colours.',
    scope: 'project',
    state: 'valid',
    tags: [],
    confidence: 0.9,
    sourceQuote: 'restrained colours',
    occurredAt: '2026-06-15T10:00:00Z',
    project: { id: WEBSITE.id, slug: WEBSITE.slug, name: WEBSITE.name },
    interaction: {
      id: 'i1', label: 'Design Review #1', labelDisplay: 'Design Review #1', source: 'design-review',
    },
    sourceLabelDisplay: 'Design Review #1',
    supersedes: [],
    supersededBy: null,
    ...over,
  };
}

/** A memory owned by the client rather than by any one project. */
export const CLIENT_WIDE = memory({
  id: 'm-wide',
  statement: 'The client values premium positioning.',
  scope: 'client',
  project: null,
  sourceLabelDisplay: 'Relationship Review #1',
});

export const WEBSITE_MEMORY = memory();

export const MOBILE_MEMORY = memory({
  id: 'm-app',
  statement: 'The client wants simple navigation in the mobile app.',
  project: { id: MOBILE.id, slug: MOBILE.slug, name: MOBILE.name },
  sourceLabelDisplay: 'UX Review #1',
});

const EMPTY_GROUPS = {
  preferences: [], approvals: [], rejections: [],
  constraints: [], decisions: [], outcomes: [], changes: [],
};

export function projectDetail(
  project: ProjectSummary,
  preferences: MemoryItem[],
): ProjectDetail {
  return {
    project: { id: project.id, slug: project.slug, name: project.name, status: project.status },
    client: {
      id: CLIENT.client.id, slug: CLIENT.client.slug, name: CLIENT.client.name,
      context: CLIENT.client.context, hindsightBankId: CLIENT.client.hindsightBankId,
    },
    memory: { ...EMPTY_GROUPS, preferences },
    memoryCount: preferences.length,
    openConflicts: 0,
  };
}

export function conflict(over: Partial<Conflict> = {}): Conflict {
  return {
    id: 'c1',
    status: 'pending',
    newStatement: 'The client is now open to brighter accent colours.',
    newMemoryType: 'preference_change',
    oldStatement: 'The client wants to avoid bright, saturated colours.',
    oldMemoryId: 'mem_old',
    oldMemoryRefId: 'ref_old',
    explanation: 'The new feedback conflicts with an existing client preference for this scope.',
    interactionLabel: 'Revision #6',
    resolvedScope: null,
    resolution: null,
    createdAt: '2026-09-26T10:00:00Z',
    resolvedAt: null,
    ...over,
  };
}

export function recommendation(over: Partial<Recommendation> = {}): Recommendation {
  return {
    recommendationId: 'r1',
    memoryUsed: true,
    memoryCount: 2,
    hindsightOk: true,
    summary: 'Keep the palette restrained and lead with the case studies.',
    items: [],
    avoid: [],
    notes: [],
    caveats: [],
    model: 'openai/gpt-oss-120b',
    latencyMs: 1200,
    ...over,
  };
}
