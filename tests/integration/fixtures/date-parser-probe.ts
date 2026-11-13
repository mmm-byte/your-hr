/**
 * Probe that reports how a `date` column decodes under a fixed timezone.
 *
 * Purpose: run in a child process whose `TZ` is set before startup, so the
 * timezone-sensitive driver behaviour is measured exactly as a production
 * server would experience it (RPT-004, D-021).
 * Called by: tests/integration/date-parsers.test.ts.
 * Reads: nothing — it creates and reads its own throwaway PGlite database.
 * Rules: RPT-004, MON-002.
 *
 * The script prints one JSON line tagged with `PROBE_RESULT:` so the parent
 * test can read the result without depending on the driver's own logging.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { types as neonPgTypes } from '@neondatabase/serverless';
import { neonDateTypes } from '../../../src/db/date-parsers';
import { openDatabase, resolveDatabaseTarget } from '../../../scripts/target';

interface ProbeResult {
  timezone: string | undefined;
  /** The value the configured script path reads back. */
  scriptPathDate: unknown;
  scriptPathDateType: string;
  scriptPathMoney: unknown;
  /** The day Neon's built-in parser produces for the same raw value. */
  neonDefaultUtcDay: string;
  /** The day the configured Neon override produces. */
  neonOverrideDate: unknown;
  /** The day PGlite's built-in parser produces. */
  pgliteDefaultUtcDay: string;
}

const STORED_DATE = '2023-05-09';

async function main(): Promise<void> {
  const workspace = mkdtempSync(join(tmpdir(), 'your-hr-date-probe-'));

  try {
    // 1. The configured script path (`db:migrate` / `db:seed` / `db:verify`).
    process.env.PGLITE_PATH = join(workspace, 'configured');
    const target = await openDatabase(resolveDatabaseTarget());
    await target.query('create table probe (d date not null, n numeric(12,2) not null)');
    await target.query('insert into probe (d, n) values ($1, $2)', [STORED_DATE, '12345.67']);
    const rows = await target.query<{ d: unknown; n: unknown }>('select d, n from probe');
    await target.close();

    // 2. A plain PGlite instance, to show what the driver does without the
    //    configured parsers.
    const plain = await PGlite.create();
    const plainRows = await plain.query<{ d: Date }>('select $1::date as d', [STORED_DATE]);
    await plain.close();

    const neonDefault = neonPgTypes.getTypeParser(1082, 'text')(STORED_DATE) as Date;

    const result: ProbeResult = {
      timezone: process.env.TZ,
      scriptPathDate: rows.rows[0]?.d,
      scriptPathDateType: typeof rows.rows[0]?.d,
      scriptPathMoney: rows.rows[0]?.n,
      neonDefaultUtcDay: neonDefault.toISOString().slice(0, 10),
      neonOverrideDate: neonDateTypes.getTypeParser(1082, 'text')(STORED_DATE),
      pgliteDefaultUtcDay: (plainRows.rows[0]?.d as Date).toISOString().slice(0, 10),
    };

    console.log(`PROBE_RESULT:${JSON.stringify(result)}`);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
