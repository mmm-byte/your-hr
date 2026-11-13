# `src/app` — Routes and Application Surfaces

## Owns
- Next.js routes/layouts/pages
- server components
- route handlers only when HTTP is genuinely useful
- server actions or thin entry points into application operations
- route-specific loading/error/not-found UI

## Does not own
- database schema/connection
- reusable domain rules
- generic UI components
- duplicated validation/business logic

## Direction
Route/UI -> focused server query or application operation -> domain/database.

## Required documentation
Non-trivial route modules identify purpose, data source, applicable rules, and tests in a compact relationship header.

## Routes
- `/employees` — the directory. A server component that reads the search, filters, sort, page, and reporting date from the URL and renders one bounded page (D-029, QRY-001…007, ANA-007).
- `/employees/[employeeId]` — the profile. Identity, employment, compensation, salary history, and the supporting summaries (EMP-009, SAL-007, ELG-006).

Each route carries its own `loading.tsx`, `error.tsx`, and — for the profile — a scoped
`not-found.tsx`, so every data surface has all four states (UI.md → States required on data surfaces).

## Required tests
- route/query integration behavior
- loading/empty/error/not-found states where meaningful
- critical flows in E2E
- keyboard/responsive behavior for interactive screens

## Checklist
- [ ] server component by default
- [ ] no direct database import in client code
- [ ] validated search params/action input
- [ ] stable URL/filter behavior
- [ ] safe error handling
- [ ] no all-10k browser fetch
