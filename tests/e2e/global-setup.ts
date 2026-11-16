/**
 * The E2E global setup (D-009, D-010).
 *
 * Purpose: give the Playwright suite a **seeded** database and a **running**
 * application, so a spec exercises the real cohort rather than a fixture
 * that drifts from it.
 *
 * How it works:
 *
 * 1. A file-backed PGlite database is created at a temporary path, the
 *    committed migrations are applied to it, and the approved 10,000-person
 *    cohort is seeded through the same `buildSeedDataset` the seed script
 *    uses.
 * 2. The application is **built** and started as a standalone server with
 *    `PGLITE_PATH` pointing at that database. `output: 'standalone'` means
 *    `next start` does not work, so the server is `node .next/standalone/server.js`.
 * 3. The static assets are copied into the standalone bundle, because the
 *    build writes them outside it.
 *
 * The database is seeded once for the whole run. A spec that writes to it
 * must therefore either use a row nothing else touches, or clean up after
 * itself — the suite runs with `workers: 1`, so the writes are serialised.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgliteDateParsers } from '../../src/db/date-parsers';
import { applyMigrationsTo } from './helpers/seed-database';

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3399);
export const E2E_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${E2E_PORT}`;

let server: ChildProcess | undefined;
let databasePath: string | undefined;

/**
 * Build the application and start it against a seeded database.
 */
export default async function globalSetup(): Promise<void> {
  // The Playwright runner loads this file as CommonJS, so `__dirname` is
  // the portable way to find the project root here.
  const projectRoot = join(__dirname, '..', '..');
  const workDir = await mkdtemp(join(tmpdir(), 'your-hr-e2e-'));
  databasePath = join(workDir, 'cohort');

  // The teardown runs in a separate process, so the directory is handed over
  // through the environment.
  process.env.E2E_WORK_DIR = workDir;
  process.env.PGLITE_PATH = databasePath;
  process.env.NEXT_PUBLIC_APP_URL = E2E_BASE_URL;

  await seedDatabase(databasePath);

  await run('pnpm', ['build'], projectRoot);

  // The standalone bundle does not include the static assets; the build
  // writes them beside it.
  await cp(join(projectRoot, '.next', 'static'), join(projectRoot, '.next', 'standalone', '.next', 'static'), {
    recursive: true,
  });

  server = spawn('node', ['.next/standalone/server.js'], {
    cwd: join(projectRoot, '.next', 'standalone'),
    env: { ...process.env, PORT: String(E2E_PORT), HOSTNAME: '127.0.0.1' },
    stdio: 'inherit',
  });

  await waitForServer(`${E2E_BASE_URL}/api/health`);
}

/**
 * Create the seeded database at `path`.
 *
 * The rows come from the approved dataset through the same builder the seed
 * script uses, so a spec that passes here is testing the real cohort.
 */
async function seedDatabase(path: string): Promise<void> {
  const client = await PGlite.create(path, { parsers: pgliteDateParsers });
  try {
    await applyMigrationsTo(client);
  } finally {
    await client.close();
  }

  // The seed script writes the rows; the application never imports it, so
  // it is run as a child process rather than imported (scripts/README.md).
  await run('pnpm', ['db:seed'], join(__dirname, '..', '..'));
}

/**
 * Run a command, rejecting when it fails.
 */
function run(command: string, args: readonly string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd,
      env: { ...process.env, PGLITE_PATH: databasePath },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
      }
    });
  });
}

/**
 * Wait for the server to answer.
 *
 * The build and the start are both asynchronous, so the suite must not
 * begin before the server is actually listening. A failed health check is
 * retried, because the first request after the start can arrive before the
 * server has finished binding.
 */
async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 60_000;

  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // The server is not up yet.
    }

    if (Date.now() > deadline) {
      throw new Error(`The application did not answer at ${url} within 60 seconds.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Stop the server and remove the database.
 */
export async function globalTeardown(): Promise<void> {
  server?.kill();
  server = undefined;

  if (databasePath !== undefined) {
    await rm(join(databasePath, '..'), { recursive: true, force: true });
    databasePath = undefined;
  }
}
