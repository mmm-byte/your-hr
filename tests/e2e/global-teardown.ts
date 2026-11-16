/**
 * The E2E global teardown.
 *
 * Purpose: remove the seeded database and the temporary directory the global
 * setup created, so a run leaves nothing behind.
 *
 * Global setup and teardown run in separate processes, so the teardown reads
 * the exact child PID written by setup, stops that standalone server, then
 * removes the files. Leaving it running would make the next suite silently
 * target a stale build on the same port.
 */
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

export default async function globalTeardown(): Promise<void> {
  const workDir = process.env.E2E_WORK_DIR;
  if (workDir !== undefined) {
    await stopServer(workDir);
    await rm(workDir, { recursive: true, force: true });
  }
}

async function stopServer(workDir: string): Promise<void> {
  const rawPid = await readFile(join(workDir, 'server.pid'), 'utf8').catch(() => undefined);
  const pid = rawPid === undefined ? Number.NaN : Number.parseInt(rawPid, 10);

  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch (error: unknown) {
    if (isMissingProcess(error)) {
      return;
    }
    throw error;
  }

  const deadline = Date.now() + 5_000;
  while (isRunning(pid) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    return !isMissingProcess(error);
  }
}

function isMissingProcess(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ESRCH';
}
