/**
 * CRITICAL FIRST MILESTONE (implementation brief §36).
 *
 * Proves the core loop against the REAL services, end to end:
 *
 *   client feedback -> Hindsight retain -> Hindsight recall -> Groq -> recommendation -> evidence
 *
 * Run:  npm run verify:memory
 *
 * This script makes live calls. It fails loudly if Hindsight or Groq are not
 * configured — it never simulates either, because a passing result here is the
 * evidence that the memory layer genuinely works.
 *
 * It writes into a throwaway bank (`verify-<timestamp>`) and deletes it at the
 * end, so it never touches demo data.
 */
import { env } from '../config/env.js';
import { getHindsight, probeHindsight } from '../hindsight/client.js';
import { ensureBank, deleteBank } from '../hindsight/banks.js';
import { retainForBank } from '../hindsight/retain.js';
import { recallMemories, toEvidenceSnapshot } from '../hindsight/recall.js';
import { invalidateMemory } from '../hindsight/curate.js';
import { listMemoriesByDocument } from '../hindsight/recall.js';
import { generateRecommendation } from '../agents/recommend.js';
import { documentIdFor } from '../services/memory.service.js';
import { buildWhyLine } from '../agents/evidence.js';

const CLIENT_SLUG = 'verify-studio';
const PROJECT_SLUG = 'verify-project';
const BANK_ID = `verify-${Date.now()}`;

type Status = 'PASS' | 'FAIL' | 'SKIP';
const results: Array<{ step: string; status: Status; detail: string }> = [];

function record(step: string, status: Status, detail: string): void {
  results.push({ step, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'SKIP' ? '–' : '✗';
  console.log(`${icon} ${step}: ${detail}`);
}

async function main(): Promise<number> {
  console.log('\n=== ClientOS core memory loop verification ===\n');

  // ---- Step 0: configuration ----
  if (!env.hindsightConfigured) {
    record('config', 'FAIL', 'HINDSIGHT_API_KEY is not set. Cannot verify the memory loop.');
    console.log('\nSet HINDSIGHT_API_KEY in backend/.env and re-run.\n');
    return 1;
  }
  if (!env.groqConfigured) {
    record('config', 'FAIL', 'GROQ_API_KEY is not set. Cannot verify reasoning.');
    console.log('\nSet GROQ_API_KEY in backend/.env and re-run.\n');
    return 1;
  }
  record('config', 'PASS', `Hindsight + Groq configured (model: ${env.GROQ_MODEL})`);

  // ---- Step 1: connection ----
  const probe = await probeHindsight();
  if (!probe.connected) {
    record('connection', 'FAIL', probe.reason);
    return 1;
  }
  record('connection', 'PASS', `Hindsight reachable (version ${probe.version})`);

  let exitCode = 0;

  try {
    // ---- Step 2: bank ----
    await ensureBank({ bankId: BANK_ID, clientName: 'Verify Studio', clientContext: 'Test bank.' });
    record('createBank', 'PASS', `bank ${BANK_ID} created`);

    // ---- Step 3: retain ----
    const documentId = 'interaction:verify-1';
    const facts: Array<{ statement: string; type: 'preference' | 'rejection' | 'approval' }> = [
      { statement: 'The client rejected heavy animation.', type: 'rejection' },
      { statement: 'The client approved serif typography.', type: 'approval' },
      { statement: 'The client wants shorter headlines.', type: 'preference' },
      { statement: 'The client wants to avoid bright, saturated colours.', type: 'rejection' },
    ];

    for (const f of facts) {
      await retainForBank(BANK_ID, {
        statement: f.statement,
        memoryType: f.type,
        scope: 'project',
        clientSlug: CLIENT_SLUG,
        projectSlug: PROJECT_SLUG,
        contextLabel: 'Revision #3 — revision',
        sourceLabelSlug: 'revision-3',
        occurredAt: new Date(),
        documentId: documentIdFor(documentId, f.statement),
      });
    }
    record('retain', 'PASS', `${facts.length} memories retained (async:false)`);

    // ---- Step 4: id reconciliation ----
    const unitsPerFact = await Promise.all(
      facts.map((f) => listMemoriesByDocument(BANK_ID, documentIdFor(documentId, f.statement))),
    );
    const units = unitsPerFact.flat();
    if (units.length < facts.length) {
      record(
        'listMemories',
        'FAIL',
        `only ${units.length} of ${facts.length} retained memories resolved — memories are overwriting each other`,
      );
      exitCode = 1;
    } else {
      record('listMemories', 'PASS', `all ${units.length} retained memories resolved with real ids`);
    }

    // ---- Step 5: recall ----
    const recalled = await recallMemories({
      bankId: BANK_ID,
      clientSlug: CLIENT_SLUG,
      projectSlug: PROJECT_SLUG,
      query: 'Create the next homepage direction.',
      budget: 'mid',
    });

    if (recalled.length === 0) {
      record('recall', 'FAIL', 'recall returned zero memories after a successful retain');
      exitCode = 1;
    } else {
      record(
        'recall',
        'PASS',
        `${recalled.length} memories recalled; first: "${recalled[0]?.text.slice(0, 60)}…"`,
      );
    }

    // ---- Step 6: tag scoping isolation ----
    const otherProject = await recallMemories({
      bankId: BANK_ID,
      clientSlug: CLIENT_SLUG,
      projectSlug: 'a-different-project',
      query: 'Create the next homepage direction.',
      budget: 'low',
    });
    if (otherProject.length === 0) {
      record('tag scoping', 'PASS', 'memories tagged to one project do not leak into another');
    } else {
      record(
        'tag scoping',
        'FAIL',
        `${otherProject.length} memories leaked into an unrelated project scope`,
      );
      exitCode = 1;
    }

    // ---- Step 7: memory-aware recommendation ----
    const withMemory = await generateRecommendation({
      bankId: BANK_ID,
      clientName: 'Verify Studio',
      clientSlug: CLIENT_SLUG,
      projectName: 'Verify Project',
      projectSlug: PROJECT_SLUG,
      request: 'Create the next homepage direction.',
      useMemory: true,
      pendingConflicts: [],
      activeDirectives: [],
    });

    if (!withMemory.memoryUsed || withMemory.memoryCount === 0) {
      record('recommendation (memory)', 'FAIL', 'recommendation reported no memory used');
      exitCode = 1;
    } else {
      record(
        'recommendation (memory)',
        'PASS',
        `${withMemory.items.length} items, ${withMemory.avoid.length} avoid, ${withMemory.memoryCount} memories`,
      );
    }

    // ---- Step 8: evidence is real ----
    const cited = [...withMemory.items, ...withMemory.avoid].flatMap((i) => i.evidence);
    // Compare against the snapshot of what THIS recommendation recalled — the
    // earlier standalone recall was a separate call and may differ.
    const groundedIds = new Set(withMemory.evidence.map((e) => e.memoryId));
    const fabricated = cited.filter((e) => !groundedIds.has(e.memoryId));

    if (cited.length === 0) {
      record('evidence', 'FAIL', 'no recommendation cited any memory');
      exitCode = 1;
    } else if (fabricated.length > 0) {
      record('evidence', 'FAIL', `${fabricated.length} citation(s) did not come from recall`);
      exitCode = 1;
    } else {
      record('evidence', 'PASS', `${cited.length} citation(s), all traceable to recalled memory`);
      const sample = [...withMemory.items, ...withMemory.avoid].find((i) => i.evidence.length > 0);
      if (sample) {
        console.log(`    e.g. "${sample.text}"`);
        console.log(`         Why: ${buildWhyLine(sample.evidence)}`);
      }
    }

    if (withMemory.droppedCitations > 0 || withMemory.droppedItems > 0) {
      record(
        'anti-fabrication',
        'PASS',
        `dropped ${withMemory.droppedCitations} bogus citation(s) and ${withMemory.droppedItems} unsupported item(s)`,
      );
    }

    // ---- Step 9: generic vs memory-aware differ ----
    const withoutMemory = await generateRecommendation({
      bankId: BANK_ID,
      clientName: 'Verify Studio',
      clientSlug: CLIENT_SLUG,
      projectName: 'Verify Project',
      projectSlug: PROJECT_SLUG,
      request: 'Create the next homepage direction.',
      useMemory: false,
      pendingConflicts: [],
      activeDirectives: [],
    });

    if (withoutMemory.memoryUsed || withoutMemory.memoryCount > 0) {
      record('no-memory path', 'FAIL', 'memory-free request still reported memory use');
      exitCode = 1;
    } else if (withoutMemory.evidence.length > 0) {
      record('no-memory path', 'FAIL', 'memory-free request produced evidence');
      exitCode = 1;
    } else {
      record('no-memory path', 'PASS', 'generic answer, no evidence, memoryUsed=false');
    }

    if (withMemory.summary.trim() === withoutMemory.summary.trim()) {
      record('memory changes behaviour', 'FAIL', 'memory-aware and generic answers were identical');
      exitCode = 1;
    } else {
      record('memory changes behaviour', 'PASS', 'memory produced a different recommendation');
    }

    // ---- Step 10: invalidation removes from recall ----
    const target = units[0];
    if (target) {
      const inv = await invalidateMemory(BANK_ID, target.id, 'verification: supersede check');
      if (!inv.ok) {
        record('invalidate', 'FAIL', inv.reason);
        exitCode = 1;
      } else {
        const after = await recallMemories({
          bankId: BANK_ID,
          clientSlug: CLIENT_SLUG,
          projectSlug: PROJECT_SLUG,
          query: target.text,
          budget: 'mid',
        });
        const stillThere = after.some((m) => m.id === target.id);
        if (stillThere) {
          record('invalidate', 'FAIL', 'invalidated memory still appears in recall');
          exitCode = 1;
        } else {
          record('invalidate', 'PASS', 'invalidated memory no longer recalled (history preserved)');
        }
      }
    } else {
      record('invalidate', 'SKIP', 'no memory id available to invalidate');
    }
  } catch (e) {
    record('unexpected', 'FAIL', e instanceof Error ? e.message : String(e));
    exitCode = 1;
  } finally {
    // Always clean up the throwaway bank.
    try {
      await deleteBank(BANK_ID);
      console.log(`\n(cleaned up bank ${BANK_ID})`);
    } catch {
      console.log(`\n(WARNING: could not delete bank ${BANK_ID} — delete it manually)`);
    }
  }

  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const skip = results.filter((r) => r.status === 'SKIP').length;

  console.log('\n=== Result ===');
  console.log(`PASS ${pass}   FAIL ${fail}   SKIP ${skip}`);
  console.log(
    exitCode === 0
      ? '\nCORE MEMORY LOOP VERIFIED. Hindsight retain -> recall -> Groq -> evidence works.\n'
      : '\nCORE MEMORY LOOP FAILED. Fix Hindsight/Groq before building further.\n',
  );

  void getHindsight; // referenced for clarity that this script uses the real client
  return exitCode;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error('verification crashed:', e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
