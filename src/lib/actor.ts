/**
 * The acting principal (D-011, ACC-003).
 *
 * The MVP has no authentication layer, so there is no human to resolve. Every
 * audit event therefore attributes the action to one fixed, documented surrogate.
 *
 * Defined in exactly one place so a call site can never invent a different actor
 * string. When real authentication arrives, only the resolution of this value
 * changes — the audit schema and format stay the same.
 */

/** The stable surrogate recorded on every audit event. */
export const ACTOR_ID = 'hr-manager';

/** Human-readable label shown in the audit trail. */
export const ACTOR_LABEL = 'HR Manager';

export interface Actor {
  readonly id: string;
  readonly label: string;
}

export const ASSESSMENT_ACTOR: Actor = Object.freeze({
  id: ACTOR_ID,
  label: ACTOR_LABEL,
});
