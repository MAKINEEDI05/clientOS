/**
 * Multi-project memory scoping.
 *
 * One client, one Hindsight bank, several projects. These assert the two things
 * that make that safe: a project sees its own memories plus client-wide ones,
 * and never a sibling project's.
 *
 * The tag-filter assertions are pure and always run. The end-to-end recall
 * assertions run against REAL Hindsight and are skipped (not silently passed)
 * when no credential is configured.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../config/env.js';
import { buildMemoryTags, projectScopeTagGroups, clientScopeTagGroups } from '../hindsight/tags.js';
import { ensureBank, deleteBank } from '../hindsight/banks.js';
import { retainForBank } from '../hindsight/retain.js';
import { recallMemories } from '../hindsight/recall.js';
import { closePool } from '../db/pool.js';

const CLIENT = 'iso-client';
const WEB = 'iso-website';
const APP = 'iso-mobile';

describe('tagging keeps projects apart', () => {
  test('a project memory carries its project tag', () => {
    const tags = buildMemoryTags({
      clientSlug: CLIENT, projectSlug: WEB, memoryType: 'preference', scope: 'project',
    });
    assert.ok(tags.includes(`project:${WEB}`));
    assert.ok(tags.includes('scope:project'));
  });

  test('a CLIENT-WIDE memory carries NO project tag, so it reaches every project', () => {
    const tags = buildMemoryTags({
      clientSlug: CLIENT, projectSlug: WEB, memoryType: 'preference', scope: 'client',
    });
    assert.ok(!tags.some((t) => t.startsWith('project:')), 'client-wide memory must not be project-bound');
    assert.ok(tags.includes('scope:client'));
  });

  test('a FUTURE-scoped memory is likewise not project-bound', () => {
    const tags = buildMemoryTags({
      clientSlug: CLIENT, projectSlug: WEB, memoryType: 'preference', scope: 'future',
    });
    assert.ok(!tags.some((t) => t.startsWith('project:')));
  });

  test('the recall filter admits this project, client-wide and future — and nothing else', () => {
    const groups = projectScopeTagGroups(WEB);
    const arms = groups[0]?.or ?? [];
    assert.deepEqual(arms.map((a) => a.tags[0]), [`project:${WEB}`, 'scope:client', 'scope:future']);
    // No arm admits a sibling project.
    assert.ok(!arms.some((a) => a.tags.includes(`project:${APP}`)));
  });

  test('every filter arm is strict, so untagged memories cannot slip in', () => {
    for (const arm of projectScopeTagGroups(WEB)[0]?.or ?? []) {
      assert.equal(arm.match, 'any_strict');
    }
  });

  test('client-wide recall is scoped to the client tag', () => {
    assert.deepEqual(clientScopeTagGroups(CLIENT), [
      { tags: [`client:${CLIENT}`], match: 'any_strict' },
    ]);
  });

  test('two projects of one client produce different filters', () => {
    const a = JSON.stringify(projectScopeTagGroups(WEB));
    const b = JSON.stringify(projectScopeTagGroups(APP));
    assert.notEqual(a, b);
  });
});

// ---------------------------------------------------------------------------
// End-to-end against real Hindsight.
// ---------------------------------------------------------------------------
const live = env.hindsightConfigured;
const BANK = `isotest-${Date.now()}`;
// A second client, to prove the per-client boundary as well as the per-project one.
const OTHER_BANK = `isotest-other-${Date.now()}`;
const OTHER_CLIENT = 'iso-other-client';

describe('one bank, two projects — real recall', { skip: live ? false : 'HINDSIGHT_API_KEY not configured' }, () => {
  before(async () => {
    await ensureBank({ bankId: BANK, clientName: 'Iso Client', clientContext: 'Isolation test.' });
    const facts = [
      { s: 'The client prefers a muted, restrained colour palette on the website.', p: WEB, sc: 'project' as const, src: 'design-review-1' },
      { s: 'The client wants bright, high-contrast colours in the mobile app.', p: APP, sc: 'project' as const, src: 'ux-review-1' },
      { s: 'The client values premium positioning across all of their work.', p: null, sc: 'client' as const, src: 'meeting-1' },
    ];
    for (const f of facts) {
      await retainForBank(BANK, {
        statement: f.s, memoryType: 'preference', scope: f.sc,
        clientSlug: CLIENT, projectSlug: f.p,
        contextLabel: 'isolation test', sourceLabelSlug: f.src,
        occurredAt: new Date(), documentId: `iso:${f.src}`,
      });
    }
    await ensureBank({
      bankId: OTHER_BANK, clientName: 'Other Client', clientContext: 'Isolation test — other client.',
    });
    await retainForBank(OTHER_BANK, {
      statement: 'The client insists on a neon green palette for their storefront.',
      memoryType: 'preference', scope: 'project',
      clientSlug: OTHER_CLIENT, projectSlug: 'iso-storefront',
      contextLabel: 'isolation test', sourceLabelSlug: 'meeting-1',
      occurredAt: new Date(), documentId: 'iso:other:meeting-1',
    });

    // Give consolidation a moment to settle.
    await new Promise((r) => setTimeout(r, 4000));
  });

  after(async () => {
    await deleteBank(BANK).catch(() => undefined);
    await deleteBank(OTHER_BANK).catch(() => undefined);
    await closePool().catch(() => undefined);
  });

  test('the website project sees its own memory and the client-wide one, not the app’s', async () => {
    const got = await recallMemories({
      bankId: BANK, clientSlug: CLIENT, projectSlug: WEB,
      query: 'What colour direction does the client want?', budget: 'mid',
    });
    const text = got.map((m) => m.text.toLowerCase()).join(' | ');

    assert.match(text, /muted|restrained/, 'must include its own project memory');
    assert.match(text, /premium positioning/, 'must include the client-wide memory');
    assert.doesNotMatch(text, /mobile app|high-contrast/, 'must NOT include the sibling project');

    const foreign = got.filter((m) => m.projectSlug && m.projectSlug !== WEB);
    assert.deepEqual(foreign, [], 'no memory from another project may be recalled');
  });

  test('the mobile project sees its own memory and the client-wide one, not the website’s', async () => {
    const got = await recallMemories({
      bankId: BANK, clientSlug: CLIENT, projectSlug: APP,
      query: 'What colour direction does the client want?', budget: 'mid',
    });
    const text = got.map((m) => m.text.toLowerCase()).join(' | ');

    assert.match(text, /bright|high-contrast/, 'must include its own project memory');
    assert.match(text, /premium positioning/, 'must include the client-wide memory');
    assert.doesNotMatch(text, /website/, 'must NOT include the sibling project');

    const foreign = got.filter((m) => m.projectSlug && m.projectSlug !== APP);
    assert.deepEqual(foreign, [], 'no memory from another project may be recalled');
  });

  test('the client-wide memory is the SAME memory for both projects, not a copy', async () => {
    const [web, app] = await Promise.all([
      recallMemories({ bankId: BANK, clientSlug: CLIENT, projectSlug: WEB, query: 'premium positioning', budget: 'mid' }),
      recallMemories({ bankId: BANK, clientSlug: CLIENT, projectSlug: APP, query: 'premium positioning', budget: 'mid' }),
    ]);
    const webWide = web.find((m) => m.scope === 'client');
    const appWide = app.find((m) => m.scope === 'client');
    assert.ok(webWide && appWide, 'both projects should recall the client-wide memory');
    assert.equal(webWide.id, appWide.id, 'it must be one stored memory, not duplicated per project');
  });

  test('another CLIENT’s memory is unreachable, project tags notwithstanding', async () => {
    // The query is chosen to match the other client's memory semantically, so a
    // pass means the bank boundary held rather than that the search missed it.
    const mine = await recallMemories({
      bankId: BANK, clientSlug: CLIENT, projectSlug: WEB,
      query: 'What colour palette does the client want?', budget: 'mid',
    });
    assert.doesNotMatch(
      mine.map((m) => m.text.toLowerCase()).join(' | '),
      /neon green|storefront/,
      'another client’s memory must never be recalled',
    );

    const theirs = await recallMemories({
      bankId: OTHER_BANK, clientSlug: OTHER_CLIENT, projectSlug: 'iso-storefront',
      query: 'What colour palette does the client want?', budget: 'mid',
    });
    assert.match(theirs.map((m) => m.text.toLowerCase()).join(' | '), /neon green/);
    assert.doesNotMatch(
      theirs.map((m) => m.text.toLowerCase()).join(' | '),
      /muted|restrained|premium positioning|high-contrast/,
      'isolation holds in both directions',
    );
  });

  test('a memory is never duplicated into another bank', async () => {
    const got = await recallMemories({
      bankId: BANK, clientSlug: CLIENT, projectSlug: WEB, query: 'colour', budget: 'mid',
    });
    // Every recalled memory belongs to the one client bank under test.
    assert.ok(got.length > 0);
    assert.ok(got.every((m) => m.tags.includes(`client:${CLIENT}`)));
  });
});
