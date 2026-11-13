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
