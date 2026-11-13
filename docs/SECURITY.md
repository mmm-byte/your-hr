# Your HR — Security & Privacy Notes

## Scope
This is a public-review assessment using synthetic data. Security design should demonstrate sane production habits without claiming production certification.

## Data classification
- Salary and HR records are treated as sensitive application data even though the seed is synthetic.
- Secrets/credentials are confidential and never client-visible.
- Public UI assets/documentation are non-sensitive.

## Controls
### Secrets
- Database URLs/tokens only in environment variables.
- `.env*` ignored; `.env.example` contains placeholders only.
- No secrets in browser bundles, screenshots, logs, docs, prompts, commits, or tests.

### Database
- Server-only access.
- Parameterized/ORM queries.
- Least-scope database credentials available through the chosen platform setup.
- Schema constraints reinforce durable invariants.
- Preview must not mutate production database state.

### Input/output
- Zod/server validation on untrusted input.
- Search/filter/sort values allow-listed where they influence query shape.
- User-facing errors never reveal SQL, stack traces, credentials, or raw internals.
- CSV exports neutralize spreadsheet formula-injection values.

### Web
- No secrets in `NEXT_PUBLIC_*`.
- Avoid rendering unsanitized HTML.
- Mutations use framework-supported server mechanisms and explicit validation.
- Destructive actions require clear intent/confirmation where added.

### Logging
Allowed: request/correlation IDs, operation name, safe identifiers, outcome/timing.
Avoid: database URL, full request payloads, raw salaries unless essential and justified, entire employee records.

## Threat scenarios to review
- Unauthorized discovery through predictable employee IDs. (MVP assumes authenticated HR persona; document this boundary.)
- Injection through search/filter/export fields.
- Stale concurrent salary update.
- Preview deployment using production DB.
- accidental secret commit.
- verbose error leaking internals.
- salary history tampering/destructive update.
- poisoned/malformed seed rows.

## Access model and its limits (ACC-001…ACC-004, D-006, D-011)
This assessment deliberately ships **no authentication layer**. The following are the explicit,
documented consequences — not oversights:

| Aspect | Reality | Consequence |
|---|---|---|
| Login page | None. `/login` does not exist. | Anyone with the URL has full access. |
| Session | None. No cookie, no token, no session store. | No request can be attributed to a human. |
| Authorization | None. Every visitor is the HR Manager. | There is no per-employee or per-field restriction. |
| Audit actor | A fixed surrogate `hr-manager` (D-011). | The audit trail shows *that* a change happened and *why*, not *who* a human was. |
| Employee ID predictability | IDs are sequential integers (1–10,000 in the seed). | Combined with no auth, any employee record is directly reachable. |

**This is acceptable for a public-review assessment on synthetic data, and it is not acceptable for real
salary data.** A real deployment MUST add, before any real data is loaded:

1. SSO or an identity provider, with server-side session validation.
2. Role-based authorization — at minimum a viewer/editor distinction, because salary revision is a write.
3. An audit actor resolved from the authenticated principal rather than a constant.
4. Rate limiting and transport security on the public endpoint.
5. A review of whether sequential employee IDs are acceptable, or whether they should be opaque.

The application states its own limitation to the user: a persistent notice on every page discloses that
the environment is an assessment with synthetic data and no authentication (ACC-002).

## Incident-like responses for assessment
- Secret exposed: rotate immediately; remove from current files and remediate history before sharing repository.
- Bad migration: stop release; restore/redeploy only through documented DB recovery path.
- Bad seed: do not patch rows manually in production; fix deterministic transform/seed and recreate only when safe.

## Explicit limitation
Real production HR software requires a full authentication/authorization model, access reviews, audit-retention policy, privacy/legal review, backup/recovery objectives, and organizational controls. Those are documented future requirements, not claimed as delivered by this assessment.
