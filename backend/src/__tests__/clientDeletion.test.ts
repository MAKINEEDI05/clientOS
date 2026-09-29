/**
 * Client deletion — against the REAL PostgreSQL schema and its foreign keys.
 *
 * Every test uses its own fixture clients (slugs prefixed `del-test-`), never
 * demo data. The Hindsight side effect is injected, so no real memory bank is
 * created or deleted here: what is asserted is which bank the service asks to
 * delete, in what order, and what happens when that call fails.
 *
 * HTTP tests only exercise paths that are rejected before any deletion (auth,
 * invalid id, unknown id), so the real deleteBank() is never reached.
 */
import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../app.js';
import { query, closePool } from '../db/pool.js';
import { env } from '../config/env.js';
import * as clientsRepo from '../repositories/clients.repo.js';
import * as projectsRepo from '../repositories/projects.repo.js';
import { deleteClient, type DeleteClientDeps } from '../services/clients.service.js';
import { AppError } from '../utils/errors.js';
import { bankIdForClient } from '../utils/slug.js';

const TARGET = { slug: 'del-test-target', name: 'Del Test Target' };
const BYSTANDER = { slug: 'del-test-bystander', name: 'Del Test Bystander' };
const MISMATCH = { slug: 'del-test-mismatch', name: 'Del Test Mismatch' };
const ALL_SLUGS = [TARGET.slug, BYSTANDER.slug, MISMATCH.slug];

const TABLES = [
  'clients', 'projects', 'interactions', 'memory_refs', 'memory_links',
  'preference_conflicts', 'hindsight_directives', 'recommendations', 'recommendation_feedback',
] as const;
type Table = (typeof TABLES)[number];

/** Each table's rows, attributed to the client that owns them. */
const OWNED: Record<Table, string> = {
  clients: 'SELECT t.id AS owner_id, t.* FROM clients t',
  projects: 'SELECT t.client_id AS owner_id, t.* FROM projects t',
  interactions: 'SELECT t.client_id AS owner_id, t.* FROM interactions t',
  memory_refs: 'SELECT t.client_id AS owner_id, t.* FROM memory_refs t',
  memory_links: 'SELECT m.client_id AS owner_id, t.* FROM memory_links t JOIN memory_refs m ON m.id = t.from_memory_ref_id',
  preference_conflicts: 'SELECT t.client_id AS owner_id, t.* FROM preference_conflicts t',
  hindsight_directives: 'SELECT t.client_id AS owner_id, t.* FROM hindsight_directives t',
  recommendations: 'SELECT t.client_id AS owner_id, t.* FROM recommendations t',
  recommendation_feedback:
    'SELECT r.client_id AS owner_id, t.* FROM recommendation_feedback t JOIN recommendations r ON r.id = t.recommendation_id',
};

interface Fixture {
  id: string;
  slug: string;
  bankId: string;
  projectIds: string[];
}

async function cleanup(): Promise<void> {
  // Scoped to this file's fixtures only.
  await query('DELETE FROM clients WHERE slug = ANY($1::text[])', [ALL_SLUGS]);
}

/**
 * A client with the full shape a real one accumulates: projects, interactions,
 * project and client-wide memory references, a supersession link, a conflict,
 * a directive, recommendations and recommendation feedback.
 */
async function seedClient(
  spec: { slug: string; name: string },
  projectCount: number,
  bankId = bankIdForClient(spec.slug),
): Promise<Fixture> {
  const client = await clientsRepo.createClient({ slug: spec.slug, name: spec.name, hindsightBankId: bankId });
  const projectIds: string[] = [];

  for (let i = 0; i < projectCount; i++) {
    const project = await projectsRepo.createProject({ clientId: client.id, slug: `p${i}`, name: `Project ${i}` });
    projectIds.push(project.id);

    const [interaction] = await query<{ id: string }>(
      `INSERT INTO interactions (client_id, project_id, label, label_slug, source, content, occurred_at)
       VALUES ($1, $2, 'Revision #1', 'revision-1', 'revision', 'Keep the palette calm.', now()) RETURNING id`,
      [client.id, project.id]);
    const [older] = await query<{ id: string }>(
      `INSERT INTO memory_refs (client_id, project_id, interaction_id, memory_type, statement, scope, state)
       VALUES ($1, $2, $3, 'preference', 'Avoid bright colours.', 'project', 'superseded') RETURNING id`,
      [client.id, project.id, interaction!.id]);
    const [newer] = await query<{ id: string }>(
      `INSERT INTO memory_refs (client_id, project_id, interaction_id, memory_type, statement, scope)
       VALUES ($1, $2, $3, 'preference_change', 'Open to brighter accents.', 'project') RETURNING id`,
      [client.id, project.id, interaction!.id]);
    await query(
      `INSERT INTO memory_links (from_memory_ref_id, to_memory_ref_id, relation, scope)
       VALUES ($1, $2, 'supersedes', 'project')`,
      [newer!.id, older!.id]);
    const [conflict] = await query<{ id: string }>(
      `INSERT INTO preference_conflicts
         (client_id, project_id, interaction_id, new_statement, new_memory_type, old_statement, explanation, old_memory_ref_id)
       VALUES ($1, $2, $3, 'Open to brighter accents.', 'preference_change', 'Avoid bright colours.', 'Contradicts.', $4)
       RETURNING id`,
      [client.id, project.id, interaction!.id, older!.id]);
    await query(
      `INSERT INTO hindsight_directives (client_id, project_id, conflict_id, hindsight_directive_id, name, content, scope)
       VALUES ($1, $2, $3, $4, 'Accent rule', 'Use brighter accents.', 'project')`,
      [client.id, project.id, conflict!.id, `dir-${spec.slug}-${i}`]);
    const [rec] = await query<{ id: string }>(
      `INSERT INTO recommendations (client_id, project_id, request_text, summary, memory_used, hindsight_ok, model)
       VALUES ($1, $2, 'Next homepage direction', 'A calm direction.', true, true, 'test-model') RETURNING id`,
      [client.id, project.id]);
    await query(
      `INSERT INTO recommendation_feedback (recommendation_id, verdict, retained_memory_ref_id)
       VALUES ($1, 'accepted', $2)`,
      [rec!.id, newer!.id]);
  }

  // One client-wide memory, owned by the client rather than any project.
  await query(
    `INSERT INTO memory_refs (client_id, project_id, memory_type, statement, scope)
     VALUES ($1, NULL, 'preference', 'Premium positioning matters.', 'client')`,
    [client.id]);

  return { id: client.id, slug: spec.slug, bankId, projectIds };
}

async function countsFor(clientId: string): Promise<Record<Table, number>> {
  const out = {} as Record<Table, number>;
  for (const t of TABLES) {
    const [row] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM (${OWNED[t]}) x WHERE x.owner_id = $1`, [clientId]);
    out[t] = row!.n;
  }
  return out;
}

/** Content hash of every row a client owns, per table: "unchanged", not just "same count". */
async function fingerprint(clientId: string): Promise<Record<Table, string>> {
  const out = {} as Record<Table, string>;
  for (const t of TABLES) {
    const [row] = await query<{ h: string }>(
      `SELECT coalesce(md5(string_agg(row_to_json(x)::text, '|' ORDER BY row_to_json(x)::text)), 'empty') AS h
         FROM (${OWNED[t]}) x WHERE x.owner_id = $1`, [clientId]);
    out[t] = row!.h;
  }
  return out;
}

/** Rows anywhere that still reference the given projects. */
async function rowsForProjects(projectIds: string[]): Promise<number> {
  const [row] = await query<{ n: number }>(
    `SELECT ((SELECT count(*) FROM projects WHERE id = ANY($1::uuid[]))
           + (SELECT count(*) FROM interactions WHERE project_id = ANY($1::uuid[]))
           + (SELECT count(*) FROM memory_refs WHERE project_id = ANY($1::uuid[]))
           + (SELECT count(*) FROM preference_conflicts WHERE project_id = ANY($1::uuid[]))
           + (SELECT count(*) FROM hindsight_directives WHERE project_id = ANY($1::uuid[]))
           + (SELECT count(*) FROM recommendations WHERE project_id = ANY($1::uuid[])))::int AS n`,
    [projectIds]);
  return row!.n;
}

/** A stand-in for Hindsight's deleteBank that records what it was asked to do. */
function fakeBank(options: { fail?: boolean; delayMs?: number } = {}) {
  const calls: string[] = [];
  const deps: DeleteClientDeps = {
    deleteBank: async (bankId) => {
      calls.push(bankId);
      if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs));
      if (options.fail) throw AppError.memoryUnavailable('simulated memory service failure');
    },
    deleteClientRow: clientsRepo.deleteClientById,
  };
  return { calls, deps };
}

async function rejectsWith(promise: Promise<unknown>, code: string): Promise<AppError> {
  try {
    await promise;
  } catch (e) {
    assert.ok(e instanceof AppError, `expected AppError, got ${String(e)}`);
    assert.equal(e.code, code);
    return e;
  }
  assert.fail(`expected rejection with ${code}`);
}

after(async () => {
  await cleanup();
  await closePool();
});

describe('deleteClient — a successful deletion', () => {
  let target: Fixture;
  let bystander: Fixture;
  let before_: { target: Record<Table, number>; bystander: Record<Table, string>; northwind: Record<Table, number> | null };
  let result: Awaited<ReturnType<typeof deleteClient>>;
  const bank = fakeBank();

  before(async () => {
    await cleanup();
    target = await seedClient(TARGET, 2);
    bystander = await seedClient(BYSTANDER, 1);
    const northwind = await clientsRepo.findClient('northwind-labs');
    before_ = {
      target: await countsFor(target.id),
      bystander: await fingerprint(bystander.id),
      northwind: northwind ? await countsFor(northwind.id) : null,
    };
    result = await deleteClient(target.id, bank.deps);
  });

  test('the fixture really had data in every table before deletion', () => {
    for (const t of TABLES) assert.ok(before_.target[t] > 0, `${t} fixture is empty`);
  });

  test('deletes the client and reports the real project count', () => {
    assert.deepEqual(result, { clientId: target.id, deletedProjects: 2 });
  });

  test('the client row is removed', async () => {
    assert.equal(await clientsRepo.findClient(target.id), null);
  });

  for (const t of TABLES.filter((x) => x !== 'clients')) {
    test(`${t} owned by the client are removed through the cascade`, async () => {
      assert.equal((await countsFor(target.id))[t], 0);
    });
  }

  test('no row anywhere still references the deleted projects', async () => {
    assert.equal(await rowsForProjects(target.projectIds), 0);
  });

  test('asks Hindsight to delete exactly this client’s own bank, once', () => {
    assert.deepEqual(bank.calls, ['client-del-test-target']);
  });

  test('another client’s rows are untouched, byte for byte', async () => {
    assert.deepEqual(await fingerprint(bystander.id), before_.bystander);
  });

  test('another client’s bank is never touched', () => {
    assert.ok(!bank.calls.includes(bystander.bankId));
    assert.ok(!bank.calls.includes('client-northwind-labs'));
  });

  test('Northwind (when present) is untouched', async () => {
    const northwind = await clientsRepo.findClient('northwind-labs');
    if (!before_.northwind) return; // not seeded in this database
    assert.ok(northwind, 'Northwind must still exist');
    assert.deepEqual(await countsFor(northwind.id), before_.northwind);
  });
});

describe('deleteClient — refusals and failures', () => {
  let target: Fixture;

  beforeEach(async () => {
    await cleanup();
    target = await seedClient(TARGET, 2);
  });

  test('an unknown client returns NOT_FOUND and touches nothing', async () => {
    const bank = fakeBank();
    const err = await rejectsWith(deleteClient('00000000-0000-4000-8000-000000000000', bank.deps), 'NOT_FOUND');
    assert.equal(err.status, 404);
    assert.deepEqual(bank.calls, []);
  });

  test('an invalid id returns VALIDATION_ERROR — a slug is never accepted', async () => {
    const bank = fakeBank();
    for (const id of ['not-a-uuid', TARGET.slug, '', "'; DROP TABLE clients; --"]) {
      const err = await rejectsWith(deleteClient(id, bank.deps), 'VALIDATION_ERROR');
      assert.equal(err.status, 400);
    }
    assert.deepEqual(bank.calls, []);
    assert.ok(await clientsRepo.findClient(target.id), 'the client must still exist');
  });

  test('a Hindsight failure keeps the client and all of its data', async () => {
    const before = await fingerprint(target.id);
    const bank = fakeBank({ fail: true });
    await rejectsWith(deleteClient(target.id, bank.deps), 'MEMORY_UNAVAILABLE');
    assert.deepEqual(bank.calls, [target.bankId]);
    assert.deepEqual(await fingerprint(target.id), before);
  });

  test('a database failure after the bank is deleted is reported, never as success', async () => {
    const before = await fingerprint(target.id);
    const bank = fakeBank();
    bank.deps.deleteClientRow = async () => { throw new Error('simulated database failure'); };
    const err = await rejectsWith(deleteClient(target.id, bank.deps), 'INTERNAL');
    assert.equal(err.status, 500);
    assert.match(err.message, /memory bank was deleted, but the client record could not be removed/);
    // The transaction rolled back: the client row and everything under it remain.
    assert.deepEqual(await fingerprint(target.id), before);
  });

  test('a delete that removes no row is not reported as success', async () => {
    const bank = fakeBank();
    bank.deps.deleteClientRow = async () => 0;
    await rejectsWith(deleteClient(target.id, bank.deps), 'INTERNAL');
    assert.ok(await clientsRepo.findClient(target.id));
  });

  test('retrying after a partial failure finishes the deletion', async () => {
    const first = fakeBank();
    first.deps.deleteClientRow = async () => { throw new Error('simulated database failure'); };
    await rejectsWith(deleteClient(target.id, first.deps), 'INTERNAL');

    // deleteBank() treats an already-absent bank as done, so a retry is safe.
    const retry = fakeBank();
    const result = await deleteClient(target.id, retry.deps);
    assert.equal(result.clientId, target.id);
    assert.equal(await clientsRepo.findClient(target.id), null);
  });

  test('a bank that does not match the client is refused with CONFLICT, nothing deleted', async () => {
    const mismatched = await seedClient(MISMATCH, 1, 'client-del-test-somebody-else');
    const before = await fingerprint(mismatched.id);
    const bank = fakeBank();
    const err = await rejectsWith(deleteClient(mismatched.id, bank.deps), 'CONFLICT');
    assert.equal(err.status, 409);
    assert.deepEqual(bank.calls, []);
    assert.deepEqual(await fingerprint(mismatched.id), before);
  });

  test('deleting twice in a row: the second is NOT_FOUND', async () => {
    const bank = fakeBank();
    await deleteClient(target.id, bank.deps);
    await rejectsWith(deleteClient(target.id, bank.deps), 'NOT_FOUND');
    assert.deepEqual(bank.calls, [target.bankId], 'the bank is deleted once');
  });

  test('two concurrent deletions: exactly one succeeds, the other is NOT_FOUND', async () => {
    const bank = fakeBank({ delayMs: 150 });
    const results = await Promise.allSettled([
      deleteClient(target.id, bank.deps),
      deleteClient(target.id, bank.deps),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal((rejected[0]!.reason as AppError).code, 'NOT_FOUND');
    assert.deepEqual(bank.calls, [target.bankId], 'the row lock serialises them: one bank deletion');
    assert.equal(await clientsRepo.findClient(target.id), null);
  });
});

describe('DELETE /api/clients/:clientId', () => {
  let server: Server;
  let base: string;
  let target: Fixture;

  before(async () => {
    await cleanup();
    target = await seedClient(TARGET, 2);
    server = createApp().listen(0);
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const del = (id: string, token?: string) =>
    fetch(`${base}/clients/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: token === undefined ? {} : { 'x-demo-token': token },
    }).then(async (r) => ({ status: r.status, body: (await r.json()) as { success: boolean; error?: { code: string } } }));

  test('is rejected without a token', async () => {
    const { status, body } = await del(target.id);
    assert.equal(status, 401);
    assert.equal(body.error?.code, 'UNAUTHORIZED');
  });

  test('is rejected with a wrong token', async () => {
    const { status } = await del(target.id, 'wrong');
    assert.equal(status, 401);
  });

  test('an invalid id returns 400', async () => {
    const { status, body } = await del('not a uuid!', env.DEMO_RESET_TOKEN);
    assert.equal(status, 400);
    assert.equal(body.error?.code, 'VALIDATION_ERROR');
  });

  test('a slug is rejected with 400 — deletion is never by slug', async () => {
    const { status } = await del(TARGET.slug, env.DEMO_RESET_TOKEN);
    assert.equal(status, 400);
    assert.ok(await clientsRepo.findClient(target.id), 'the client must still exist');
  });

  test('an unknown client returns 404', async () => {
    const { status, body } = await del('00000000-0000-4000-8000-000000000000', env.DEMO_RESET_TOKEN);
    assert.equal(status, 404);
    assert.equal(body.error?.code, 'NOT_FOUND');
  });

  test('none of the rejected requests removed anything', async () => {
    const counts = await countsFor(target.id);
    assert.equal(counts.clients, 1);
    assert.equal(counts.projects, 2);
  });
});
