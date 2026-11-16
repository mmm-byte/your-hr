/**
 * Covers:
 * - API-CONTRACT.md health route returns safe readiness information
 * - SECURITY.md infrastructure failures do not expose raw errors
 *
 * Does not cover:
 * - A real database connection (tests/integration/*)
 * - Deployment reachability (tests/e2e/*)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute, getDatabase, createCorrelationId } = vi.hoisted(() => ({
  execute: vi.fn(),
  getDatabase: vi.fn(),
  createCorrelationId: vi.fn(),
}));

vi.mock('@/db/client', () => ({ getDatabase }));
vi.mock('@/lib/correlation-id', () => ({ createCorrelationId }));

import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getDatabase.mockReturnValue({ execute });
  });

  it('reports a reachable database without exposing infrastructure details', async () => {
    execute.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      database: 'reachable',
      durationMs: expect.any(Number),
    });
  });

  it('returns a safe degraded response and correlation ID when the database fails', async () => {
    execute.mockRejectedValue(new Error('relation "employees" does not exist at database.internal'));
    createCorrelationId.mockReturnValue('correlation-123');

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'degraded',
      database: 'unreachable',
      correlationId: 'correlation-123',
    });
  });
});
