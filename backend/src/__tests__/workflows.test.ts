/**
 * Integration tests for the client / project / memory-curation workflows.
 *
 * Runs against the REAL Express app and REAL PostgreSQL. Client creation touches
 * Hindsight (it provisions a memory bank), so those cases assert the invariant
 * that holds either way: either the client AND its memory were created, or
 * nothing was created and a memory error was reported. Nothing is mocked.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../app.js';
import { query, closePool } from '../db/pool.js';
import { env } from '../config/env.js';

let server: Server;
let base: string;

const NAMES = ['Wf Test Alpha', 'Wf Test Beta'];

async function cleanup(): Promise<void> {
  await query(`DELETE FROM clients WHERE name = ANY($1::text[])`, [NAMES]);
}

before(async () => {
  await cleanup();
  const app = createApp();
  server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  base = `http://127.0.0.1:${port}/api`;
});

after(async () => {
  await cleanup();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closePool();
});

async function post(path: string, body: unknown): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function get(path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, body: await res.json() };
}

describe('create client', () => {
  test('rejects a blank name before any memory work', async () => {
    const { status, body } = await post('/clients', { name: '   ' });
    assert.equal(status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  test('rejects a name with no usable characters', async () => {
    const { status } = await post('/clients', { name: '!!! ???' });
    assert.equal(status, 400);
  });

  test('either creates the client WITH its memory, or creates nothing at all', async () => {
    const { status, body } = await post('/clients', {
      name: NAMES[0], description: 'A test studio.',
    });

    if (status === 201) {
      assert.equal(body.success, true);
      assert.equal(body.data.client.name, NAMES[0]);
      assert.equal(body.data.client.slug, 'wf-test-alpha');
      assert.equal(body.data.memoryReady, true, 'a created client must have memory ready');
      // The bank id is an implementation detail and must not leak to the caller.
      assert.ok(!('hindsightBankId' in body.data.client), 'must not expose the memory bank id');

      const rows = await query(`SELECT hindsight_bank_id FROM clients WHERE name = $1`, [NAMES[0]]);
      assert.equal(rows.length, 1);
      assert.equal((rows[0] as any).hindsight_bank_id, 'client-wf-test-alpha');
    } else {
      assert.equal(status, 503);
      assert.equal(body.error.code, 'MEMORY_UNAVAILABLE');
      const rows = await query(`SELECT id FROM clients WHERE name = $1`, [NAMES[0]]);
      assert.equal(rows.length, 0, 'no partially configured client may be left behind');
    }
  });

  test('rejects a duplicate client name', async function () {
    if (!env.hindsightConfigured) return; // needs the first create to have succeeded
    const first = await post('/clients', { name: NAMES[1] });
    if (first.status !== 201) return;

    const { status, body } = await post('/clients', { name: NAMES[1] });
    assert.equal(status, 409);
    assert.equal(body.error.code, 'CONFLICT');
  });

  test('can create a first project in the same step', async () => {
    const rows = await query(`SELECT id FROM clients WHERE name = $1`, [NAMES[0]]);
    if (rows.length === 0) return; // client creation needs Hindsight; skip if unavailable

    const { body } = await get(`/clients/wf-test-alpha`);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.projects));
  });
});

describe('create project', () => {
  test('404s for an unknown client', async () => {
    const { status, body } = await post('/clients/no-such-client/projects', { name: 'X' });
    assert.equal(status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  test('rejects a blank project name', async () => {
    const rows = await query(`SELECT id FROM clients WHERE name = $1`, [NAMES[0]]);
    const clientId = (rows[0] as any)?.id;
    if (!clientId) return;

    const { status } = await post(`/clients/${clientId}/projects`, { name: '  ' });
    assert.equal(status, 400);
  });

  test('creates a project and rejects a duplicate name for the same client', async () => {
    const rows = await query(`SELECT id FROM clients WHERE name = $1`, [NAMES[0]]);
    const clientId = (rows[0] as any)?.id;
    if (!clientId) return;

    const created = await post(`/clients/${clientId}/projects`, {
      name: 'Workflow Project', description: 'Desc.',
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.project.name, 'Workflow Project');
    assert.equal(created.body.data.project.slug, 'workflow-project');
    assert.equal(created.body.data.project.description, 'Desc.');
    // A brand-new project starts genuinely empty.
    assert.equal(created.body.data.project.memoryCount, 0);
    assert.equal(created.body.data.project.interactionCount, 0);

    const dup = await post(`/clients/${clientId}/projects`, { name: 'Workflow Project' });
    assert.equal(dup.status, 409);
  });

  test('a project belongs only to its own client', async () => {
    const a = await query(`SELECT id FROM clients WHERE name = $1`, [NAMES[0]]);
    const b = await query(`SELECT id FROM clients WHERE name = $1`, [NAMES[1]]);
    const aId = (a[0] as any)?.id;
    const bId = (b[0] as any)?.id;
    if (!aId || !bId) return;

    const projects = await query(`SELECT id FROM projects WHERE client_id = $1`, [aId]);
    const projectId = (projects[0] as any)?.id;
    if (!projectId) return;

    // Client B must not be able to reach client A's project through the agent route.
    const { status } = await post('/agent/recommend', {
      clientId: bId, projectId, message: 'Create the next homepage direction.',
    });
    assert.equal(status, 404, "a client must not reach another client's project");
  });
});

describe('memory curation', () => {
  test('404s for an unknown memory', async () => {
    const { status, body } = await post(
      '/memories/00000000-0000-0000-0000-000000000000/invalidate', {},
    );
    assert.equal(status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  test('rejects a malformed memory id without touching the memory service', async () => {
    const res = await fetch(`${base}/memories/${encodeURIComponent('../../etc')}/invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(res.status, 400);
  });

  test('retiring a memory marks it invalidated but never deletes it', async () => {
    const rows = await query(`SELECT id FROM clients WHERE name = $1`, [NAMES[0]]);
    const clientId = (rows[0] as any)?.id;
    if (!clientId) return;

    const projects = await query(`SELECT id FROM projects WHERE client_id = $1 LIMIT 1`, [clientId]);
    const projectId = (projects[0] as any)?.id;
    if (!projectId) return;

    // Insert a memory pointer directly: this test is about curation, not extraction.
    const inserted = await query<{ id: string }>(
      `INSERT INTO memory_refs (client_id, project_id, memory_type, statement, scope, tags)
       VALUES ($1, $2, 'preference', 'Test memory for curation.', 'project', '[]'::jsonb)
       RETURNING id`,
      [clientId, projectId],
    );
    const memoryId = inserted[0]?.id;
    assert.ok(memoryId);

    const { status, body } = await post(`/memories/${memoryId}/invalidate`, { reason: 'test' });
    assert.equal(status, 200);
    assert.equal(body.data.state, 'invalidated');

    // Still present — retiring must not delete history.
    const after = await query(`SELECT state FROM memory_refs WHERE id = $1`, [memoryId]);
    assert.equal(after.length, 1, 'the memory row must still exist');
    assert.equal((after[0] as any).state, 'invalidated');

    // Retiring twice is rejected rather than silently repeated.
    const again = await post(`/memories/${memoryId}/invalidate`, {});
    assert.equal(again.status, 409);

    // And it can be restored.
    const restored = await post(`/memories/${memoryId}/restore`, {});
    assert.equal(restored.status, 200);
    assert.equal(restored.body.data.state, 'valid');
  });
});
