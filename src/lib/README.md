# `src/lib` — Small Shared Utilities

## Purpose
Only stable, cross-cutting helpers with clear ownership.

## Allowed examples
- currency/date formatting
- safe error/correlation utility
- small pure helpers used in multiple features

## Forbidden
- dumping-ground business logic
- ambiguous `helpers.ts`
- database access mixed with browser utilities
- speculative generic frameworks

Before adding a utility, search for an existing one and confirm at least two genuine consumers or one clearly stable cross-cutting concern.
