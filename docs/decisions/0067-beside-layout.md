# 0067: The beside layout: any landscape screen, named and checked

- Status: Accepted
- Date: 2026-11-18
- Amends: ADR 0031 (the desktop query is the one desktop query; the beside query is named too)

## Context

ADR 0031 put every desktop rule in one query, `(min-width: 64rem) and (min-aspect-ratio: 5/4)`.
Five stylesheets also have rules under `(min-aspect-ratio: 5/4)` alone, older than ADR 0031: the
stage as a row with the court beside the panel, the health bars stacked, the setup and round-over
screens, home, the manual and the older-link notice (issue #16). They apply to any landscape
screen, so also to a phone turned sideways (812 x 375), which no browser test checked. The issue
asked whether to fold them into the desktop query.

## Decision

Not folded. Folding them makes a landscape phone fall back to the phone column, and at 375 px of
height the column has no room for the court: on home it is squeezed to nothing, and mid-fight the
court, the health bars and the speed control can't all be on screen. The beside layout is the right
one for any landscape screen, so it is a deliberate third layout:

- **Phone** (no query; `not all and (min-aspect-ratio: 5/4)` for a rule that is for phones only):
  the column, the court as wide as the page.
- **Beside** `(min-aspect-ratio: 5/4)`: any landscape screen, a phone turned sideways included. The
  court at the screen's full height, the panel beside it.
- **Desktop** `(min-width: 64rem) and (min-aspect-ratio: 5/4)`: refines beside on large screens
  (the sheet for setup screens, wider columns), per ADR 0031.

Each is written verbatim; `layout-queries.test.ts` fails on any other layout query. The
`browsers-landscape` project (812 x 375, touch) checks home and a Free play fight: the court whole
on screen at full height, the panel to its right, health bars and speed on screen, no sideways
scroll. It fails with the beside rules folded into the desktop query.

## Consequences

- Positive: a phone turned sideways is a layout we mean and test, not an accident.
- Positive: no visual change at any size: the rules stay as they are.
- Negative: one more browser project (one flow, three engines) in CI's "rest" part.
