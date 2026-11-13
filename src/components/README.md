# `src/components` — UI Components

## Owns
Reusable product presentation and interaction components.

## Layers
- `ui/`: shadcn-generated primitives; avoid casual customization/forks.
- product components: `MoneyDisplay`, employee identity, salary history, filter bars, states.

## Rules
- Reuse before create.
- No database access.
- No business mutation rules hidden in UI.
- Centralized money/date/status formatting.
- Props describe product concepts, not database row shapes.
- Accessibility and responsive behavior are part of the component contract.

## Comments
Document non-obvious component relationships, controlled/uncontrolled state decisions, accessibility reasoning, and which page/test owns behavior. Do not narrate JSX.

## Tests
Test behaviors: accessible names/roles, keyboard interaction, validation display, pending state, error recovery, and currency/date output. Avoid broad snapshots.
