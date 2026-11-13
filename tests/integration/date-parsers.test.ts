/**
 * Covers:
 * - RPT-004 a `date` column reads back as the exact calendar day it stores
 * - RPT-004 the same reading is identical east and west of UTC
 * - D-021 the configured driver path never builds a `Date` for a `date` column
 * - MON-002 money still arrives as an exact decimal string alongside the fix
 *
 * Does not cover:
 * - The parser configuration itself (tests/unit/date-parsers.test.ts)
 * - A live Neon server (never targeted by tests; ENVIRONMENT.md)
 *
 * Why a child process
 * -------------------
 * The defect only appears when the process timezone is east of UTC, because
 * Neon's built-in `date` parser builds a `Date` at *local* midnight and
 * Drizzle then re-slices it in UTC. A child process with `TZ` set before
 * startup reproduces that production condition exactly, and the assertion
 * fails if the parser configuration is ever removed.
 */
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const probeScript = join(projectRoot, 'tests', 'integration', 'fixtures', 'date-parser-probe.ts');

interface ProbeResult {
  timezone: string | undefined;
  scriptPathDate: unknown;
  scriptPathDateType: string;
  scriptPathMoney: unknown;
  neonDefaultUtcDay: string;
  neonOverrideDate: unknown;
  pgliteDefaultUtcDay: string;
}

/**
 * Run the probe in a child process with the given timezone.
 */
async function runProbe(timezone: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--import', 'tsx', probeScript],
    {
      cwd: projectRoot,
      env: { ...process.env, TZ: timezone },
    },
  );

  const line = stdout.split('\n').find((candidate) => candidate.startsWith('PROBE_RESULT:'));
  if (!line) {
    throw new Error(`The date-parser probe produced no result under TZ=${timezone}.`);
  }
  return JSON.parse(line.slice('PROBE_RESULT:'.length)) as ProbeResult;
}

describe('date columns are timezone-stable (RPT-004)', () => {
  it('reads the stored calendar day unchanged east of UTC', async () => {
    // Asia/Kolkata is UTC+05:30. A `Date` at local midnight is
    // 2023-05-08T18:30:00Z, so the default driver path loses a day here.
    const result = await runProbe('Asia/Kolkata');

    expect(result.timezone).toBe('Asia/Kolkata');
    expect(result.scriptPathDate).toBe('2023-05-09');
    expect(result.scriptPathDateType).toBe('string');
  });

  it('reads the stored calendar day unchanged west of UTC', async () => {
    const result = await runProbe('America/Chicago');

    expect(result.timezone).toBe('America/Chicago');
    expect(result.scriptPathDate).toBe('2023-05-09');
    expect(result.scriptPathDateType).toBe('string');
  });

  it('reads the stored calendar day unchanged in UTC', async () => {
    const result = await runProbe('UTC');

    expect(result.scriptPathDate).toBe('2023-05-09');
    expect(result.scriptPathDateType).toBe('string');
  });

  it('reads the same calendar day in every timezone', async () => {
    const timezones = ['Pacific/Kiritimati', 'Europe/Berlin', 'America/Los_Angeles'];
    const days = await Promise.all(timezones.map(async (tz) => (await runProbe(tz)).scriptPathDate));

    expect(days).toEqual(['2023-05-09', '2023-05-09', '2023-05-09']);
  });
});

describe('the defect this configuration prevents (D-021)', () => {
  it('shows the built-in Neon parser losing a day east of UTC', async () => {
    // This is the behaviour the override replaces. If Neon's parser ever
    // changes to be timezone-safe, this assertion fails and the override can
    // be reconsidered rather than left in place forever.
    const result = await runProbe('Asia/Kolkata');

    expect(result.neonDefaultUtcDay).toBe('2023-05-08');
    expect(result.neonOverrideDate).toBe('2023-05-09');
  });

  it('shows PGlite already decoding `date` as UTC midnight', async () => {
    // PGlite is correct by default, which is exactly why the defect was
    // invisible in the test suite while production was wrong.
    const result = await runProbe('Asia/Kolkata');

    expect(result.pgliteDefaultUtcDay).toBe('2023-05-09');
  });
});

describe('the fix does not disturb money (MON-002)', () => {
  it('still reads numeric as an exact decimal string', async () => {
    const result = await runProbe('Asia/Kolkata');

    expect(result.scriptPathMoney).toBe('12345.67');
  });
});