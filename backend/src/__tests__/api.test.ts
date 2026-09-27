/**
 * Integration tests against the REAL Express app and REAL PostgreSQL.
 *
 * These do not stub the database. They require the Postgres container from
 * docker-compose to be running and migrations to have been applied.
 *
 * They deliberately do NOT require Hindsight or Groq keys: everything asserted
 * here is either pure application behaviour or the honest degraded path.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../app.js';
import { query, closePool } from '../db/pool.js';
import * as clientsRepo from '../repositories/clients.repo.js';
import * as projectsRepo from '../repositories/projects.repo.js';
import { bankIdForClient } from '../utils/slug.js';

let server: Server;
let base: string;

// Distinct slugs so these tests never collide with seeded demo data.
const A = { slug: 'test-client-alpha', name: 'Test Client Alpha' };
const B = { slug: 'test-client-beta', name: 'Test Client Beta' };
let clientA: { id: string };
let clientB: { id: string };
let projectA: { id: string };
let projectB: { id: string };

async function cleanup(): Promise<void> {
  await query(`DELETE FROM clients WHERE slug = ANY($1::text[])`, [[A.slug, B.slug]]);
}

before(async () => {
  await cleanup();

  const app = createApp();
  server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  base = `http://127.0.0.1:${port}/api`;

  const a = await clientsRepo.createClient({
    slug: A.slug, name: A.name, hindsightBankId: bankIdForClient(A.slug),
  });
  const b = await clientsRepo.createClient({
    slug: B.slug, name: B.name, hindsightBankId: bankIdForClient(B.slug),
  });
  clientA = a;
  clientB = b;
  projectA = await projectsRepo.createProject({ clientId: a.id, slug: 'alpha-site', name: 'Alpha Site' });
  projectB = await projectsRepo.createProject({ clientId: b.id, slug: 'beta-site', name: 'Beta Site' });
});

after(async () => {
  await cleanup();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closePool();
});

async function get(path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, body: await res.json() };
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe('response envelope', () => {
  test('success responses use { success: true, data }', async () => {
    const { status, body } = await get('/health');
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data);
    assert.equal(body.data.db, true);
  });

  test('error responses use { success: false, error: { code, message } }', async () => {
    const { status, body } = await get('/clients/no-such-client');
    assert.equal(status, 404);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.ok(typeof body.error.message === 'string');
  });

  test('every response carries a request id for correlation', async () => {
    const res = await fetch(`${base}/health`);
    assert.ok(res.headers.get('x-request-id'));
  });

  test('x-powered-by is not advertised', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

describe('client and project isolation', () => {
  test("a project id from client B cannot be reached through client A's context", async () => {
    // This is the cross-client leakage guard: the agent route resolves BOTH and
    // asserts the relationship before touching any memory bank.
    const { status, body } = await post('/agent/recommend', {
      clientId: clientA.id,
      projectId: projectB.id,
      message: 'Create the next homepage direction.',
    });
    assert.equal(status, 404, 'must not resolve another client\'s project');
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  test('findProjectForClient refuses a mismatched pair', async () => {
    const wrong = await projectsRepo.findProjectForClient(clientA.id, projectB.id);
    assert.equal(wrong, null);
    const right = await projectsRepo.findProjectForClient(clientA.id, projectA.id);
    assert.ok(right);
    assert.equal(right?.id, projectA.id);
  });

  test('each client gets its own Hindsight bank', async () => {
    const a = await clientsRepo.findClient(A.slug);
    const b = await clientsRepo.findClient(B.slug);
    assert.ok(a && b);
    assert.notEqual(a?.hindsight_bank_id, b?.hindsight_bank_id);
    assert.equal(a?.hindsight_bank_id, 'client-test-client-alpha');
  });

  test("client A's memory listing never contains client B's rows", async () => {
    const { body } = await get(`/clients/${A.slug}/memory`);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.memories));
    // Both clients are empty of memory here; the important assertion is that the
    // query is client-scoped and returns an array rather than everything.
    assert.equal(body.data.memories.length, 0);
  });

  test('a client can be addressed by slug or uuid, and both resolve identically', async () => {
    const bySlug = await get(`/clients/${A.slug}`);
    const byId = await get(`/clients/${clientA.id}`);
    assert.equal(bySlug.body.data.client.id, byId.body.data.client.id);
  });
});

describe('validation', () => {
  test('rejects an empty agent message before calling any external service', async () => {
    const { status, body } = await post('/agent/recommend', {
      clientId: clientA.id, projectId: projectA.id, message: '',
    });
    assert.equal(status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  test('rejects an over-long agent message', async () => {
    const { status } = await post('/agent/recommend', {
      clientId: clientA.id, projectId: projectA.id, message: 'x'.repeat(1001),
    });
    assert.equal(status, 400);
  });

  test('rejects an unknown interaction source', async () => {
    const { status, body } = await post(`/projects/${projectA.id}/interactions`, {
      label: 'Test #1', source: 'telepathy', content: 'hello',
    });
    assert.equal(status, 400);
    assert.ok(body.error.details.some((d: any) => d.field === 'source'));
  });

  test('rejects empty interaction content', async () => {
    const { status } = await post(`/projects/${projectA.id}/interactions`, {
      label: 'Test #2', source: 'note', content: '   ',
    });
    assert.equal(status, 400);
  });

  test('rejects an identifier containing path traversal characters', async () => {
    const res = await fetch(`${base}/clients/${encodeURIComponent('../../etc/passwd')}`);
    assert.equal(res.status, 400);
  });

  test('rejects an unknown conflict status filter', async () => {
    const { status } = await get(`/projects/${projectA.id}/conflicts?status=whatever`);
    assert.equal(status, 400);
  });

  test('accepts a valid conflict status filter and returns an empty list', async () => {
    const { status, body } = await get(`/projects/${projectA.id}/conflicts?status=pending`);
    assert.equal(status, 200);
    assert.deepEqual(body.data.conflicts, []);
  });
});

describe('memory honesty', () => {
  test('hindsight health always answers 200 with a boolean verdict', async () => {
    // The badge must be able to render whether or not memory is reachable.
    const { status, body } = await get('/health/hindsight');
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(typeof body.data.connected, 'boolean');
    assert.equal(typeof body.data.configured, 'boolean');
    if (!body.data.connected) {
      assert.ok(body.data.reason, 'a disconnected verdict must explain itself');
    }
  });

  test('a recommendation request either succeeds honestly or fails loudly — never both', async () => {
    const { status, body } = await post('/agent/recommend', {
      clientId: clientA.id, projectId: projectA.id, message: 'Create the next homepage direction.',
    });

    if (status === 200) {
      // Client A has no memories, so it MUST report that rather than inventing history.
      assert.equal(body.success, true);
      assert.equal(body.data.memoryUsed, false, 'a client with no memory cannot report memory use');
      assert.equal(body.data.memoryCount, 0);
      const citations = [...body.data.items, ...body.data.avoid].flatMap((i: any) => i.evidence);
      assert.equal(citations.length, 0, 'no evidence can exist without memory');
      assert.ok(
        body.data.notes.some((n: string) => /no relevant client history/i.test(n)),
        'the answer must state that no history was found',
      );
    } else {
      // A dependency was unavailable: no recommendation may be returned at all.
      assert.equal(status, 503);
      assert.equal(body.success, false);
      assert.ok(['MEMORY_UNAVAILABLE', 'LLM_UNAVAILABLE'].includes(body.error.code));
      assert.equal(body.data, undefined);
    }
  });

  test('a memory failure is never reported as an LLM failure', async () => {
    const { status, body } = await post('/agent/recommend', {
      clientId: clientA.id, projectId: projectA.id, message: 'Create the next homepage direction.',
    });
    if (status === 503 && body.error.code === 'MEMORY_UNAVAILABLE') {
      assert.match(body.error.message, /could not safely use client history/i);
      assert.doesNotMatch(body.error.message, /recommendation could not be generated/i);
    }
  });
});

describe('demo endpoint authorization', () => {
  test('reset is rejected without a token', async () => {
    const { status, body } = await post('/demo/reset', { stage: 'history' });
    assert.equal(status, 401);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  test('reset is rejected with a wrong token', async () => {
    const { status } = await post('/demo/reset', { stage: 'history' }, { 'x-demo-token': 'wrong' });
    assert.equal(status, 401);
  });

  test('demo state is readable without a token', async () => {
    const { status, body } = await get('/demo/state');
    assert.equal(status, 200);
    assert.ok(['empty', 'history', 'post_conflict'].includes(body.data.stage));
  });
});

describe('duplicate submission protection', () => {
  test('the same interaction label cannot be recorded twice for one project', async () => {
    // Insert directly, because the HTTP path needs Groq for extraction.
    await query(
      `INSERT INTO interactions (client_id, project_id, label, label_slug, source, content, occurred_at)
       VALUES ($1,$2,'Dup #1','dup-1','note','first',now())`,
      [clientA.id, projectA.id],
    );
    await assert.rejects(
      () =>
        query(
          `INSERT INTO interactions (client_id, project_id, label, label_slug, source, content, occurred_at)
           VALUES ($1,$2,'Dup #1','dup-1','note','second',now())`,
          [clientA.id, projectA.id],
        ),
      /duplicate key|unique/i,
    );
  });

  test('the same label IS allowed under a different project', async () => {
    await query(
      `INSERT INTO interactions (client_id, project_id, label, label_slug, source, content, occurred_at)
       VALUES ($1,$2,'Dup #1','dup-1','note','other project',now())`,
      [clientB.id, projectB.id],
    );
    const rows = await query(`SELECT count(*) AS n FROM interactions WHERE label = 'Dup #1'`);
    assert.equal(Number((rows[0] as any).n), 2);
  });
});

describe('error handling', () => {
  test('an unmatched route returns a structured 404', async () => {
    const { status, body } = await get('/does/not/exist');
    assert.equal(status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  test('no error response leaks a stack trace', async () => {
    const { body } = await get('/clients/no-such-client');
    const text = JSON.stringify(body);
    assert.ok(!/\bat \/|\.ts:\d+|node_modules/.test(text), 'must not expose internals');
  });

  test('no response leaks credential material', async () => {
    const results = await Promise.all([
      get('/health/hindsight'),
      get('/health'),
      get('/clients'),
    ]);
    for (const r of results) {
      const text = JSON.stringify(r.body);
      assert.ok(!/hsk_|gsk_|postgresql:\/\/|password/i.test(text), 'no secrets in responses');
    }
  });
});
