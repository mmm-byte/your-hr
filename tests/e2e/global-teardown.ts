/**
 * The E2E global teardown.
 *
 * Purpose: remove the seeded database and the temporary directory the global
 * setup created, so a run leaves nothing behind.
 *
 * The server is stopped by the setup's own process handle. The teardown only
 * removes the files: the setup's process is a child of the Playwright
 * runner, which terminates it when the run ends.
 */
import { rm } from 'node:fs/promises';

export default async function globalTeardown(): Promise<void> {
  const workDir = process.env.E2E_WORK_DIR;
  if (workDir !== undefined) {
    await rm(workDir, { recursive: true, force: true });
  }
}
