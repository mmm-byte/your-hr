# Your HR — Reviewer Demo Script

## Goal
Tell one coherent story in a short video instead of touring every component.

## Story
"ACME's HR Manager is moving from multinational compensation spreadsheets to one auditable salary-management workspace."

## Walkthrough
1. Open production URL. Briefly state the product boundary: Core HR + Compensation for a 10,000-person
   synthetic workforce. Point out the assessment notice — no login, synthetic data — so the absence of
   authentication is stated rather than implied.
2. Overview: show workforce/country context and one compensation insight. Explicitly mention
   currency-aware reporting — the totals are grouped by currency, never one blended number.
3. Employees: search/filter to a specific country/department, demonstrating server-backed directory
   behavior. Change the reporting date and note that filters live in the URL.
4. Employee profile: show employment context, current salary, history, and supporting HR context.
   Point out that absence and performance are labelled *seed summaries*, not invented event history.
5. Salary revision: make a valid change, explain effective date + reason, submit, and show new history
   state with the reason and timestamp visible.
6. Demonstrate one guarded edge: invalid input or stale/conflicting revision produces a controlled
   response. A terminated employee's profile shows no revision action at all.
7. Analytics: answer one concrete question such as median compensation by a valid grouping/currency policy.
8. Data Quality: show how spreadsheet-like inconsistencies would be surfaced operationally.
9. Repository: briefly show tests, requirements/domain docs, environment decision, AI usage record, and
   a meaningful commit progression.
10. Close with deliberate exclusions and one or two realistic next steps.

## Timing
| Section | Target |
|---|---|
| 1 — Opening + boundary | 30 s |
| 2 — Overview | 60 s |
| 3 — Directory | 75 s |
| 4 — Profile | 60 s |
| 5 — Revision | 90 s |
| 6 — Guarded edge | 45 s |
| 7 — Analytics | 60 s |
| 8 — Data quality | 30 s |
| 9 — Repository | 45 s |
| 10 — Close | 30 s |
| **Total** | **~9 min** |

If time is short, cut the repository walkthrough to one screen and skip the data-quality detail —
never cut the guarded edge (step 6), because it is the proof that the mutation path is safe.

## Do not
- Spend the video installing dependencies.
- Tour every UI element.
- Claim synthetic localized salaries are real market benchmarks.
- Claim production security/compliance certification.
- Hide known limitations.

## Pre-record checklist
- Production deployment opens in fresh/incognito browser.
- Database is reachable and seeded.
- Demo employee IDs/data are stable.
- Mutating demo will not leave confusing duplicate future revisions; reset or choose a deterministic demo record.
- Browser zoom and window size make text readable.
- Repository link and production URL in README are correct.
- CI is green and screenshots are current.
