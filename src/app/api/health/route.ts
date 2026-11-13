import { NextResponse } from 'next/server';
import { getDatabase } from '@/db/client';
import { createCorrelationId } from '@/lib/correlation-id';
import { sql } from 'drizzle-orm';

/**
 * Health endpoint (API-CONTRACT.md → HTTP route handlers reserved for clear
 * use cases).
 *
 * Purpose: report whether the application and its database are ready, without
 * revealing anything about the infrastructure.
 *
 * The response contains **no** hostname, database version, credential, or
 * stack trace (SECURITY.md). The only diagnostic handle is a correlation ID.
 *
 * Route handlers are dynamic by default when they read the environment or the
 * database — the check must reflect the current state, not a build-time
 * snapshot.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();

  try {
    await getDatabase().execute(sql`select 1`);
    return NextResponse.json(
      {
        status: 'ok',
        database: 'reachable',
        durationMs: Date.now() - startedAt,
      },
      { status: 200 },
    );
  } catch {
    // The cause stays server-side. The user gets a safe status and a
    // correlation ID they can quote (AUD-004).
    const correlationId = createCorrelationId();

    return NextResponse.json(
      {
        status: 'degraded',
        database: 'unreachable',
        correlationId,
      },
      { status: 503 },
    );
  }
}
