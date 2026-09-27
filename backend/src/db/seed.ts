import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { resetDemo } from '../services/demo.service.js';
import { closePool } from './pool.js';
import { runMigrations } from './migrate.js';

/**
 * Seed the demo dataset.
 *
 * This writes memories through the SAME Hindsight retain path the live
 * application uses — seeded memory is real Hindsight memory, not a fixture.
 *
 * It therefore REQUIRES a Hindsight API key, and fails loudly without one rather
 * than writing a local imitation of memory.
 *
 *   npm run db:seed                 -> stage "history"  (interactions 1-7)
 *   npm run db:seed -- empty        -> no interactions
 *   npm run db:seed -- post_conflict-> history + the resolved preference change
 */
const STAGES = ['empty', 'history', 'post_conflict'] as const;
type Stage = (typeof STAGES)[number];

async function main(): Promise<number> {
  const requested = (process.argv[2] ?? 'history') as Stage;
  if (!STAGES.includes(requested)) {
    console.error(`Unknown stage "${requested}". Use one of: ${STAGES.join(', ')}`);
    return 1;
  }

  if (!env.hindsightConfigured) {
    console.error(
      '\nCannot seed: HINDSIGHT_API_KEY is not set.\n\n' +
        'ClientOS stores client memory in Hindsight, and the seed writes through the same\n' +
        'path the app uses. There is no local memory fallback by design — seeding without\n' +
        'Hindsight would produce a demo that only looked like it remembered.\n\n' +
        'Add HINDSIGHT_API_KEY to backend/.env and run again.\n',
    );
    return 1;
  }

  await runMigrations();

  const result = await resetDemo(requested);

  console.log('\nDemo data seeded.');
  console.log(`  stage:         ${result.stage}`);
  console.log(`  client:        ${result.clientSlug}`);
  console.log(`  project:       ${result.projectSlug}`);
  console.log(`  memory bank:   ${result.bankId}`);
  console.log(`  interactions:  ${result.interactionsSeeded}`);
  console.log(`  memories:      ${result.memoriesRetained}`);
  for (const w of result.warnings) console.log(`  warning:       ${w}`);
  console.log('');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main()
    .then(async (code) => {
      await closePool().catch(() => undefined);
      process.exit(code);
    })
    .catch(async (e) => {
      console.error('\nSeed failed:', e instanceof Error ? e.message : String(e), '\n');
      await closePool().catch(() => undefined);
      process.exit(1);
    });
}
