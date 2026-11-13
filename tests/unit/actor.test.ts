/**
 * Covers:
 * - ACC-003 every mutation attributes to a stable actor surrogate
 * - ACC-001 the MVP has no authentication layer, so the actor is fixed
 *
 * Does not cover:
 * - The audit trail's persistence (Phase 4)
 */
import { describe, expect, it } from 'vitest';
import { ACTOR_ID, ACTOR_LABEL, ASSESSMENT_ACTOR } from '@/lib/actor';

describe('the acting principal', () => {
  it('attributes every mutation to one stable surrogate', () => {
    expect(ACTOR_ID).toBe('hr-manager');
  });

  it('carries a human-readable label for the audit trail', () => {
    expect(ACTOR_LABEL).toBe('HR Manager');
    expect(ASSESSMENT_ACTOR.label).toBe(ACTOR_LABEL);
  });

  it('exposes the same id through the frozen actor object', () => {
    expect(ASSESSMENT_ACTOR.id).toBe(ACTOR_ID);
  });

  it('is frozen so a call site cannot mutate the shared surrogate', () => {
    expect(Object.isFrozen(ASSESSMENT_ACTOR)).toBe(true);
  });
});
