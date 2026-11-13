# Your HR — User Experience & Journey Specification

**Purpose:** define exactly what the HR Manager sees, does, and feels at every step — so implementation
does not leave the journey to guesswork.
**Status:** accepted — binding for Phase 0 onward.
**Related:** [UI.md](UI.md) (visual system) · [FEATURES.md](FEATURES.md) (scope) · [DOMAIN-RULES.md](DOMAIN-RULES.md) (rules) · [DELIVERY-PLAN.md](DELIVERY-PLAN.md) (order)

This document covers the **whole journey**: arrival → orientation → search → inspection → decision →
mutation → confirmation → review. It specifies route behaviour, what is on screen, what the user can do,
what happens on failure, and what the user should feel at each step.

---

## 1. The access model (answering "do we have login?")

**No login screen. There is no authentication layer.** This is a deliberate, documented product boundary,
not an oversight.

| Question | Answer |
|---|---|
| Is there a login page? | **No.** No `/login`, no password field, no session cookie, no auth provider. |
| Where does the app live? | `https://<your-deployment>.vercel.app` — open it and you are in. |
| Who is using it? | The single assumed persona: the **HR Manager**. One person, one role, full access. |
| How are actions attributed? | Every mutation writes an audit event with a **fixed actor surrogate** (`actor_id = 'hr-manager'`, `actor_label = 'HR Manager'`). See D-011. |
| Is this production-safe for real salary data? | **No.** See [SECURITY.md](SECURITY.md) → "Explicit limitation". Real deployment requires SSO/RBAC, access reviews, audit retention, and privacy/legal review. |
| Why not add auth? | D-006 — an identity provider adds scope without strengthening the salary-management demonstration. The assessment explicitly permits the assumed-authenticated persona. |
| Must the limitation be visible in the product? | **Yes.** A persistent, non-blocking banner states that the environment is an assessment with synthetic data. See §4.1. |

**Consequence for engineers:** do **not** build an auth middleware, session store, or user table.
Do **not** display a fake "Sign in" button. Do **not** add a logout control. Build exactly one thing:
the banner in §4.1, which makes the assumption honest.

---

## 2. Route map (answering "what is the main page, what is next?")

| Route | Name | Purpose | Primary action |
|---|---|---|---|
| `/` | **Overview** | Orientation: workforce size, currency mix, data quality, recent changes | Click a card to drill down |
| `/employees` | **Employees** | Find any of 10,000 people | Open a profile |
| `/employees/[employeeId]` | **Employee profile** | One person's employment + compensation truth | Revise salary |
| `/employees/[employeeId]/compensation` | **Compensation detail** | Full salary history with effective dates, USD equivalent, change reasons | Revise salary |
| `/employees/[employeeId]/revise-salary` | **Salary revision** | Create a new effective-dated salary record | Submit revision |
| `/compensation` | **Compensation** | Current salary population, filterable, currency-grouped | Drill into a person |
| `/analytics` | **Analytics** | A few decision-useful answers about pay | Filter and compare |
| `/data-quality` | **Data Quality** | Operational work queue of anomalies | Fix/navigate to affected employee |
| `/api/health` | Health | Machine-readable readiness (route handler, not a page) | — |

### 2.1 Routing rules (binding)

| Rule | Behaviour |
|---|---|
| `/` is Overview | **Not** `/overview`. `/` is the canonical landing page. No redirect from `/` to `/overview` — there is no `/overview` route. |
| Unknown route | Next.js `not-found.tsx` at the app root: plain-language "Page not found", a link to Overview, and the navigation still present. No stack trace. |
| Unknown employee ID | `not-found.tsx` scoped to the employee route, explaining the employee was not found, with a search link back to `/employees`. **Never** a raw 500. |
| Deep link | Every route must work when opened directly in a new tab (no reliance on prior client state). Server Components + URL search params make this automatic — preserve it. |
| Filter state | All directory/compensation filters live in the **URL query string**, so filters survive refresh, are shareable, and browser back/forward works. |
| Reporting date | When a reporting date is in effect it also lives in the URL (`?asOf=YYYY-MM-DD`) so a shared link reproduces the same view. |
| Navigation persistence | Sidebar (desktop) / top drawer (mobile) is present on every page except the full-screen revision flow, which shows a clear "Back to employee" link. |
| Active state | The current section is marked with `aria-current="page"` **and** a visual indicator — not colour alone. |

---

## 3. The end-to-end journey (answering "what will the user experience?")

This is the spine of the product. Each step states **what the user does**, **what they see**, and
**what they should feel**.

### Step 1 — Arrive
**User:** opens the production URL from the README or the demo link.

**Sees:** a global shell — sidebar with 5 items (Overview, Employees, Compensation, Analytics, Data
Quality), an assessment banner, the app name, and an "HR Manager" identity chip in the top bar.

**Feels:** *"This is a real product, and it says what it is."* Not a marketing page. Density and
confidence, not decoration. No spinner wall — the skeleton matches the Overview layout.

**Fails safely:** if the database is unreachable, the page renders a controlled service-error state with
a correlation ID and a Retry button. It does **not** show a stack trace or a raw driver error.

### Step 2 — Orient (Overview)
**User:** reads `/` to understand the org at a glance.

**Sees, in order:**
1. **Page header** — "Your HR" with the reporting context stated in words: *"Workforce as of 12 Nov 2026"*.
2. **Metric cards** — Total workforce (5,722 active + on-leave), Active, On leave, Terminated, and the
   number of distinct currencies in use. Every card states its own scope; no bare number appears without
   its meaning. A card is a **link** to the filtered view that explains it.
3. **Compensation context** — totals/medians **grouped by currency**, never one blended number. Each
   currency block states its currency code and the employee count it covers. If a USD-equivalent view is
   shown, it is a separate, explicitly labelled toggle, never the default.
4. **Workforce distribution** — by country and by department, with counts.
5. **Data-quality attention count** — links to `/data-quality`.
6. **Recent salary changes** — the last N revisions made in the app, newest first, each showing employee,
   previous → new amount in the same currency, effective date, and the reason. This makes the audit trail
   visible to the persona who made the changes.

**Feels:** *"I can answer 'how big is this org and what does it pay?' in ten seconds."*

**Key point:** every metric on this page is a **link into the filtered list that proves it**. No vanity
numbers.

### Step 3 — Find someone (Employees directory)
**User:** clicks **Employees**, or jumps straight there and types.

**Sees:**
- A **FilterBar**: free-text search (ID / name / email), and dropdown filters for Country, Branch,
  Department, Job level, Status, Work mode. Filters are **dependent**: choosing a country narrows the
  branch options to that country's branches, and resets branch if it no longer applies.
- A **result summary**: "Showing 1–25 of 248 matching employees" (or "of 10,000" with no filter).
- A **DataTable** with columns in this priority order: Employee (name + ID), Status, Job title + level,
  Country / Branch, Current salary (with currency code), Work mode. Salary column always shows the
  currency. Columns are sortable by click with an accessible sort indicator (`aria-sort`).
- **Server-side pagination** at the bottom with page numbers and a page-size selector.

**Interaction rules that must hold:**
| Rule | Detail |
|---|---|
| Search triggers on submit or debounce (~300 ms) | Not on every keystroke hammering the server |
| Search is trimmed and case-insensitive | Leading/trailing whitespace never changes results |
| Search matches | Employee ID (exact or prefix), full name (contains), email (contains) |
| Special characters are safe | `%`, `_`, `'`, `\` are treated as literal text, never as SQL wildcards |
| Typing a search resets to page 1 | Otherwise the user lands on an empty page and thinks data is missing |
| Filters persist in the URL | Refresh, share, back/forward all work |
| An invalid filter value in the URL | Ignored safely with a sane default; never a crash |

**Empty states (must be visually and textually distinct):**
| Situation | What the user sees |
|---|---|
| No employees match | "No employees match these filters." + **Clear filters** button + which filters are active |
| Search returns nothing | "No employees match *'xyz'*." + Clear search + suggestion to try ID or email |
| Filter combination too narrow | Same as above, plus a hint of which filter is most restrictive |

**Feels:** *"Search is fast, filters are predictable, and I can tell the difference between 'no data' and
'no match'."*

### Step 4 — Understand one person (Employee profile)
**User:** clicks a row.

**Sees:**
1. **Identity header** — full name, employee ID, status badge, job title, department, level, country /
   branch, work mode, hire date, and termination date when present.
2. **Current compensation card** — base salary with currency, bonus %, effective date, and the reporting
   date used ("Current as of 12 Nov 2026"). If a future-effective revision exists, it is shown
   separately and labelled **"Scheduled — effective 1 Mar 2027"**. It is never counted as current.
   (SAL-008)
3. **Tabs / sections** — Overview · Compensation · Performance · Absence · Employment history.
4. **Absent context, not fake context** — the source data provides absence *totals* and a *latest* review
   only. The profile therefore shows:
   - "Absence — 14 days across 3 records (seed summary)"
   - "Latest performance review — 4/5 on 3 Mar 2026, goals met 83% (seed summary)"
   Each is explicitly labelled as a **seed summary**, never presented as dated event history. See D-018.
5. **Terminated employees** — still reachable and fully inspectable (EMP-009). Their salary card reads
   *"Final salary as of termination (31 Dec 2023)"*, and **no Revise button is shown** (D-014).

**Feels:** *"This is the truth about this person's pay, and I can see how it got here."*

### Step 5 — See the history (Compensation detail)
**User:** opens the Compensation tab, or `/employees/[id]/compensation`.

**Sees:** a **timeline** of salary records, newest first. Each entry shows effective date, base salary +
currency, bonus %, USD equivalent (clearly labelled as a synthetic reporting value, MON-005), the
localization/FX provenance note, and — for app-created rows — the **change reason** and who changed it
and when.

**Feels:** *"The history explains itself. I don't need to export a spreadsheet to understand it."*

### Step 6 — Change it (Salary revision)
**User:** clicks **Revise salary**.

**Lands on** `/employees/[employeeId]/revise-salary` — a dedicated page, not a cramped modal, so context
is preserved and the form is keyboard-accessible.

**Sees:**
| Region | Content |
|---|---|
| Context header | Employee name, ID, current status. Read-only. |
| Current salary (read-only) | Base salary, currency, bonus %, effective date |
| Proposed salary | Base salary input, **currency shown as fixed and explicit** (derived from the employee's modelled policy, displayed not editable), bonus % input, effective date input |
| Comparison | Live computed difference: absolute change **and** percentage change, in the same currency, with direction (increase/decrease) shown by arrow **and** text, not colour alone |
| Reason | Required free-text field explaining why |
| Warnings | Contextual: effective date before hire date, after termination, in the past (creates history that cannot be undone), duplicate date, employee not eligible |
| Submit | Clear action label: "Add salary revision" — **not** "Save" (it appends; "Save" implies overwrite) |

**Feels:** *"The form tells me what will happen before I commit."*

**Submit behaviour and every failure mode:**

| Outcome | What the user sees |
|---|---|
| **Validation error** (bad amount, missing reason, bad date) | Inline message next to the offending field, field focused, `aria-describedby` wired, form not submitted |
| **Business-rule rejection** (before hire, after termination) | Inline explanation of the rule and the permitted range; input retained |
| **Duplicate effective date** | Conflict message: "A salary revision already exists for that effective date." + links to the existing record. No duplicate written. (SAL-006) |
| **Stale edit** (someone else changed the employee meanwhile) | "This employee's compensation changed since you opened this form." + **Refresh and review** button that reloads current values. The user's input is preserved so they can re-apply it. **Never** a silent overwrite. (SAL-011) |
| **Double submit** | Button disabled with "Saving…" immediately on first click; second click is a no-op. |
| **Unexpected failure** | Plain-language message + correlation ID + Retry. No stack trace. (AUD-004) |
| **Success** | Confirmation panel with the new salary state, the history is re-read, and the audit event exists. The profile is shown in its updated form. |

### Step 7 — Confirm and communicate
**User:** lands back on the profile. The history now includes the new record. A toast confirms
"Salary revision added, effective <date>."

**Feels:** *"That worked, and I can prove it — there's a reason and a timestamp on it."*

### Step 8 — Answer org-level questions (Compensation + Analytics)
**User:** opens **Compensation** — a filterable table of *current* salaries with the same filter model as
the directory. Then opens **Analytics**.

**Sees:** a small number of decision-useful answers, not a BI builder:
- Headcount by country / department / status
- Median and average base salary by country / department / job level — **always within a single currency**
- Salary distribution by job level

Every chart has: a title, a text summary of the takeaway (readable without colour), and an accessible
data table alternative. Every currency-sensitive figure states its currency code.

**Feels:** *"I can answer 'what do we pay engineers in Germany?' without asking anyone."*

### Step 9 — Clean the data (Data Quality)
**User:** opens **Data Quality**.

**Sees:** an operational work queue — issue categories with counts (e.g. "Currency does not match country
policy: 3"), each expandable to affected employees, each a link to the profile. Issues are deterministic
rule findings, clearly labelled as *"needs review"*, **not** accusations of corrupt data.

**Feels:** *"The system tells me where my spreadsheets lied to me."*

---

## 4. Cross-cutting experience rules

### 4.1 The assessment banner
A persistent, non-blocking banner at the top of every page:
> **Assessment environment.** Synthetic workforce data. No authentication — the user is assumed to be
> an authorised HR Manager.

This is honesty, not decoration. It must not be dismissible in a way that hides it permanently, and it
must not obscure page content or push the nav off-screen.

### 4.2 States every data surface must define

| State | Requirement |
|---|---|
| Loading | A skeleton matching the **shape** of the content. Never a full-page spinner where a partial skeleton is possible. |
| Populated | The real content. |
| Empty (no data) | "There's no data yet" — distinct from "no match". |
| Empty (no filter match) | "No results for these filters" + clear-filters action + which filters are active. |
| Not found | Route-specific explanation + way back. Not a generic error. |
| Error | Plain language, correlation ID, Retry. No stack trace, no SQL, no driver message. (AUD-004) |
| Stale/conflict | Explicit "data changed, please review" + refresh action. Never silent. |
| Success | Toast **and** inline confirmation. Never toast-only for a mutation. |

### 4.3 Feedback timing
- Hover/tooltip: never the only way to get information.
- Toasts: auto-dismiss ~6 s for confirmations, but **never** auto-dismiss an error — errors persist until
  dismissed or the action is retried.
- Optimistic UI: **not** used for salary mutations. The user must see the server's authoritative result.
- Long operations (>300 ms perceived): show a pending state on the control that triggered it.

### 4.4 Keyboard and focus
| Context | Requirement |
|---|---|
| Skip link | "Skip to main content" is the first focusable element |
| Filter/search | Enter submits; Escape clears the search field and returns to the unfiltered list |
| Table rows | The employee name is a real link; rows are navigable by keyboard without a custom widget |
| Sort | Header buttons expose `aria-sort`; activated by Enter/Space |
| Dialogs | Focus moves in on open, is trapped while open, returns to the trigger on close |
| Form errors | The first invalid field receives focus; the error summary is linked from each field |
| Focus visibility | A visible focus ring on every interactive element — never `outline: none` without a replacement |
| Reduced motion | All non-essential motion respects `prefers-reduced-motion` |

### 4.5 Responsive behaviour
| Width | Behaviour |
|---|---|
| ≥ 1024 px | Persistent sidebar (expanded), full table |
| 768–1023 px | Collapsible sidebar (icons + labels on hover), table drops secondary columns |
| < 768 px | Top bar with a menu button opening a focus-trapped drawer; table becomes a **card list** showing identity → status → role → location → salary, with the rest under a "Details" disclosure |

Secondary data is never squeezed into unreadable columns — it moves into row details, per [UI.md](UI.md).

### 4.6 Voice and tone
- Plain, specific, calm. No exclamation marks. No emoji as interface icons.
- Say what happened and what to do next: *"A salary revision already exists for 1 March 2027."* not
  *"Conflict!"* or *"Invalid request."*
- Never blame the user: *"Enter a date on or after the hire date (12 Jun 2019)."* not *"Invalid date."*
- Always currency-explicit: *"€84,500"* and *"₹18,42,000"* — never a bare number.

### 4.7 Numbers and dates
| Concern | Rule |
|---|---|
| Money display | One central formatter. Symbol **and** ISO code shown where space allows. Never hand-concatenated. (MON-003) |
| Money precision | Base salary shows 2 decimals only when the value has them; large amounts may show thousands separators per locale |
| Bonus % | 1 decimal place, `%` suffix, always paired with its salary |
| USD equivalent | Always labelled *"USD equivalent (synthetic)"* — never "USD salary" (MON-005) |
| Dates | One formatter. **Date-only** semantics (no timezone drift): a salary effective 2026-03-01 must never render as 28 Feb because of timezone conversion |
| Reporting date | Stated in words on every page that shows money: *"as of 12 Nov 2026"* |
| Averages | Rounded to 2 decimals **for display only**; the database value is the source of truth |
| Percentages in analytics | Median/average counts: median shown without decimals when the sample is large; state the sample size |

---

## 5. Page-by-page checklist

A page is complete only when **every** line is satisfied.

### Overview `/`
- [ ] Reporting context stated in words
- [ ] Workforce counts split by status, each scoped and linked
- [ ] Compensation totals grouped by currency — never one blended number
- [ ] USD-equivalent view is opt-in and clearly labelled
- [ ] Country and department distribution with counts
- [ ] Data-quality attention count linking to `/data-quality`
- [ ] Recent salary changes with before → after, effective date, and reason
- [ ] Loading, populated, empty, and error states
- [ ] Every metric card is a link to its explanatory filtered view

### Employees `/employees`
- [ ] Search + 6 filters, with dependent Country → Branch
- [ ] Result count and range shown
- [ ] Columns in priority order; salary always with currency
- [ ] Server-side sort, filter, pagination
- [ ] URL-persisted state; back/forward works
- [ ] Search resets to page 1
- [ ] Three distinct empty states
- [ ] "Clear filters" action
- [ ] Table is keyboard navigable with `aria-sort`
- [ ] Narrow viewport → card list

### Employee profile `/employees/[employeeId]`
- [ ] Identity header with status, role, org, location, dates
- [ ] Current compensation with reporting date
- [ ] Future-effective revision shown separately and labelled "Scheduled" (SAL-008)
- [ ] Salary history with effective dates, reason, actor, timestamp
- [ ] Absence/performance shown as labelled seed summaries, never fabricated history
- [ ] Terminated employee: history visible, no Revise action (EMP-009, D-014)
- [ ] Not-found state for an unknown ID
- [ ] Revise salary entry point for eligible employees

### Salary revision `/employees/[employeeId]/revise-salary`
- [ ] Current salary shown read-only
- [ ] Currency fixed, explicit, and visibly derived from policy
- [ ] Live comparison: absolute + percentage, direction by icon **and** text
- [ ] Reason is required
- [ ] Effective date input with hire/termination boundaries enforced
- [ ] Inline field errors, associated and focus-managed
- [ ] Pending state on submit, double-submit blocked
- [ ] Conflict state with refresh-and-review, input preserved
- [ ] Success confirmation + updated history
- [ ] Clear "Back to employee" link
- [ ] Never exposes internal errors

### Compensation `/compensation`
- [ ] Current salaries only, filterable
- [ ] Aggregates grouped by currency
- [ ] No mixed-currency total anywhere
- [ ] Same empty/error states as the directory

### Analytics `/analytics`
- [ ] Headcount by country / department / status
- [ ] Median + average by valid grouping, within a single currency
- [ ] Distribution by job level
- [ ] Every chart has a text summary and a table alternative
- [ ] Sample sizes stated
- [ ] Empty result → empty state, never a fabricated zero

### Data Quality `/data-quality`
- [ ] Issue categories with counts
- [ ] Affected employees listed and linked
- [ ] Labelled as "needs review", not corruption
- [ ] Deterministic classification (same data → same result)

---

## 6. Things a user should never experience

| Never | Because |
|---|---|
| A raw stack trace, SQL error, or connection string | AUD-004, SECURITY.md |
| A single number mixing currencies | MON-004 |
| A salary labeled "USD" when it is a local-currency amount | MON-001, MON-005 |
| A future salary shown as current | SAL-008 |
| A previous salary overwritten without trace | SAL-005 |
| A silently discarded concurrent edit | SAL-011 |
| All 10,000 rows in the browser at once | ANA-007, UI.md |
| A table with no result and no explanation of why | UI.md |
| Status conveyed by colour alone | UI.md accessibility |
| A "Save" button that secretly appends | UI.md — the action is labelled "Add salary revision" |
| A logout button that implies a session that does not exist | D-006 |
| A claim that synthetic localized salaries are market benchmarks | D-004 |
| A claim of production security certification | SECURITY.md |

---

## 7. Definition of done for the user experience

A journey is complete only when all of the following are true:

1. All seven steps above work end-to-end, with **no dead ends and no unexplained blank screens**.
2. Every state in §4.2 exists on every data surface and is reachable in a test.
3. The whole journey is operable by keyboard alone.
4. The journey works at 375 px, 768 px, and 1440 px widths.
5. Every error path is exercised by a test and shows a safe, actionable message.
6. Every mutation leaves an audit event visible to the persona who made it.
7. The two E2E journeys in `docs/TESTING.md` pass against the real app.
</content>