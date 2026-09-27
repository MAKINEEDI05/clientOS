import type { InteractionSource, MemoryScope, MemoryType } from '../types/domain.js';

/**
 * The single fictional demo client (HACKATHON_MASTER_SPEC.md §16).
 *
 * Interaction text is taken verbatim from the project specification. Labels are
 * verbatim too, because they become the `source:` tag and therefore the evidence
 * citation shown in the UI ("Heavy animation was rejected during Revision #3").
 *
 * All data is synthetic. No real client information appears anywhere.
 */

export const DEMO_CLIENT = {
  slug: 'vive-studio',
  name: 'Vive Studio',
  industry: 'Design studio',
  context:
    'Premium design studio repositioning its brand upmarket. Values restraint, ' +
    'craft and clarity over decoration.',
} as const;

export const DEMO_PROJECT = {
  slug: 'premium-website-redesign',
  name: 'Premium Website Redesign',
} as const;

export interface DemoInteraction {
  label: string;
  source: InteractionSource;
  content: string;
  /** Days before "now", so the timeline always looks plausibly historical. */
  daysAgo: number;
  /**
   * The memories we EXPECT Hindsight to extract. Used for the deterministic seed
   * path so seeding does not depend on LLM availability; the live interaction
   * endpoint lets the real extraction agent decide instead.
   */
  expectedMemories: Array<{ type: MemoryType; statement: string; scope: MemoryScope }>;
}

/**
 * Interactions 1-7 form the client's history. Interaction 8 (Revision #6) is the
 * conflict trigger and is deliberately NOT seeded — it is submitted live on
 * stage so conflict detection runs for real.
 */
export const DEMO_INTERACTIONS: DemoInteraction[] = [
  {
    label: 'Meeting #1',
    source: 'meeting',
    content: 'Premium positioning is important for the brand.',
    daysAgo: 120,
    expectedMemories: [
      {
        type: 'preference',
        statement: 'The client wants premium positioning for the brand.',
        scope: 'project',
      },
    ],
  },
  {
    label: 'Design Review #1',
    source: 'design-review',
    content: 'Keep the colour palette restrained and muted — avoid bright, saturated colours.',
    daysAgo: 104,
    expectedMemories: [
      {
        type: 'preference',
        statement: 'The client prefers a restrained, muted colour palette.',
        scope: 'project',
      },
      {
        type: 'rejection',
        statement: 'The client wants to avoid bright, saturated colours.',
        scope: 'project',
      },
    ],
  },
  {
    label: 'Design Review #2',
    source: 'design-review',
    content: 'Serif typography feels premium. Approved.',
    daysAgo: 88,
    expectedMemories: [
      { type: 'approval', statement: 'The client approved serif typography.', scope: 'project' },
    ],
  },
  {
    label: 'Revision #2',
    source: 'revision',
    content: "The blue-heavy version doesn't feel right.",
    daysAgo: 66,
    expectedMemories: [
      {
        type: 'rejection',
        statement: 'The client rejected the blue-heavy visual direction.',
        scope: 'project',
      },
    ],
  },
  {
    label: 'Revision #3',
    source: 'revision',
    content: 'The animations feel too heavy. Keep motion restrained.',
    daysAgo: 45,
    expectedMemories: [
      { type: 'rejection', statement: 'The client rejected heavy animation.', scope: 'project' },
      { type: 'preference', statement: 'The client prefers restrained motion.', scope: 'project' },
    ],
  },
  {
    label: 'Revision #4',
    source: 'revision',
    content: 'Headlines should be shorter.',
    daysAgo: 30,
    expectedMemories: [
      { type: 'preference', statement: 'The client wants shorter headlines.', scope: 'project' },
    ],
  },
  {
    label: 'Revision #5',
    source: 'revision',
    content: 'Customer proof should appear above the fold.',
    daysAgo: 14,
    expectedMemories: [
      {
        type: 'approval',
        statement: 'The client approved placing customer proof above the fold.',
        scope: 'project',
      },
    ],
  },
];

/**
 * The conflict trigger. Submitted through the normal interaction endpoint during
 * the demo so detection, scope confirmation and retention all run for real.
 */
export const DEMO_CONFLICT_INTERACTION: DemoInteraction = {
  label: 'Revision #6',
  source: 'revision',
  content: "We're now open to brighter accent colours.",
  daysAgo: 1,
  expectedMemories: [
    {
      type: 'preference_change',
      statement: 'The client is now open to brighter accent colours.',
      scope: 'project',
    },
  ],
};

/** The request used throughout the demo. */
export const DEMO_REQUEST = 'Create the next homepage direction.';

/** A second client, used to prove cross-client memory isolation. */
export const ISOLATION_CLIENT = {
  slug: 'northwind-labs',
  name: 'Northwind Labs',
  industry: 'B2B software',
  context: 'Technical B2B software company with a playful, high-energy brand.',
} as const;

export const ISOLATION_PROJECT = {
  slug: 'marketing-site',
  name: 'Marketing Site',
} as const;

export const ISOLATION_INTERACTIONS: DemoInteraction[] = [
  {
    label: 'Kickoff #1',
    source: 'meeting',
    content: 'We want bold, saturated colours and playful motion throughout the site.',
    daysAgo: 20,
    expectedMemories: [
      {
        type: 'preference',
        statement: 'The client wants bold, saturated colours and playful motion.',
        scope: 'project',
      },
    ],
  },
];

export function daysAgoToDate(daysAgo: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(10, 0, 0, 0);
  return d;
}
