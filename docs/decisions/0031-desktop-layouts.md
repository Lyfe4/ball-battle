# 0031: Desktop layouts: re-arranged for the space, not the phone column centred

- Status: Accepted
- Date: 2026-11-06
- Amends: ADR 0020 (§1 desktop adapts, §2 the paused match beside setup screens)

## Context

Every screen was designed at 375 px first (ADR 0020), and a wide screen "adapted" by putting the
phone column beside the arena (`min-aspect-ratio: 5/4`). On a desktop monitor that gave:

- **Setup screens** (Free play, the Best of 3 rules, lineup and Reveal's round 1): a dimmed arena,
  usually empty or showing an unrelated paused match, took two thirds of the screen, and the
  screen's real job sat in a 24rem strip.
- **The manual and the older-link notice**: a 40rem column with empty space either side. An entry
  didn't fit 800 px, and it scrolled inside the panel (`.hud`, `overflow-y: auto`), where Chrome's
  overlay scrollbar on Windows 11 sat on top of the stat numbers. At 1280 × 800 the panel held
  1133 px of content in a 784 px box.
- **Screens with a fight** (home, a match, a round, between rounds, the result): already led by the
  arena, which is right for watching, with a narrow side panel.

Presentation only: `src/sim`, URLs, Back and `RULESET_VERSION` are unchanged.

## Decision

### 1. Phone first, then a deliberate layout for large screens (a standing rule, CLAUDE.md)

Adapting means re-arranging to use the space: columns side by side, a list beside its detail.
It never means centring the phone layout in a wide page.

### 2. One desktop query, added on top

`@media (min-width: 64rem) and (min-aspect-ratio: 5/4)`: at least 1024 px wide and landscape. It
is repeated verbatim in each component's stylesheet, next to that component's phone rules. Anything
narrower keeps exactly the rules it had, including a phone turned sideways (667-932 px), which
still uses the 5/4 side layout. Gating on width rather than shape is what keeps phones unchanged.

New roles in `tokens.css`: `--sheet-width` (64rem, the widest a setup or reading screen grows),
`--sheet-narrow` (36rem, a notice), `--panel-width-wide` (26rem, the panel beside the arena),
`--space-sheet` (the space above and below a sheet), `--space-columns`, `--font-size-hero` and
`--font-size-lead`.

### 3. Two kinds of screen on a desktop

**Nothing is fighting: no arena, a centred sheet, the page scrolls.** This covers Free play, the
three Best of 3 setup steps, the manual and the older link (every `.stage[data-setup]` screen).
The panel is no longer a scroll box, so no scrollbar can sit over content. This replaces ADR 0020
§2's dimmed paused match beside setup screens. It cost two thirds of the screen to show something
that wasn't part of the screen's job.

**Something is fighting or has just fought: the arena beside a panel**, as before. Home, a match
and a round playing are unchanged in structure. Home's panel widens to `--panel-width-wide` and its
title grows. Between rounds and the result keep the dimmed round (ADR 0030), and the panel widens
so the track and pick rows aren't cramped. The arena is limited by the screen's height, so a very
wide monitor doesn't stretch it. The panel stays centred beside it, as during a round, so it
doesn't jump when a round ends.

### 4. Per screen

| Screen                     | Desktop layout                                                                    |
| -------------------------- | --------------------------------------------------------------------------------- |
| Free play                  | The picker: slots, why and Start on the left; legend and grid 7 across            |
| Best of 3 lineup           | The same picker: Resume, tray and Reveal / Start left; grid right                 |
| Best of 3 rules            | The three formats side by side; Choose lineup under them on the right             |
| Reveal round 1             | Toss and track on the left, the pick banner and rows on the right                 |
| Manual: balls              | The grid 7 across in a 40rem sheet; the tabs no wider than they need              |
| Manual: an entry           | Three columns: profile (stats, Even with, Try it, neighbours), Strong vs, Weak vs |
| Manual: matchup chart      | Cells sized to the screen's height (up to 40 px); the reason beside, sticky       |
| Older link                 | A card at a readable width                                                        |
| Home                       | Arena and a wider panel; a larger title                                           |
| Match, a round             | Unchanged                                                                         |
| Between rounds, the result | Dimmed round and a wider panel                                                    |

- **Placing the columns.** Most screens are placed with explicit grid lines on their existing flat
  children, so the DOM (and the phone) is untouched. The pickers' rows are explicit so the grid's
  height goes to the last row instead of spreading the left column apart.
- **The manual entry** groups its parts (profile, Strong vs, Weak vs, Even with) in wrappers with
  the same gap. The entry places them with a subgrid, so the neighbour steps, which belong to the
  entry and not the detail, sit under the profile.
- **The Brawler has no Strong vs**, so on a desktop that column is left out and Weak vs moves up
  beside the profile. A column of "None in particular." under no heading said nothing.
- **Every entry fits 1280 × 800.** The longest today is the Magnet's five Strong vs.

### Options considered

- **Keep the dimmed arena beside setup screens** (ADR 0020 §2). Rejected: it was empty or unrelated
  most of the time.
- **The manual as master-detail** (a roster rail beside the entry). Rejected: a rail and three
  columns is cramped at 1280 px, and it would change the manual's Back model. The neighbour steps
  and opponent links already browse.
- **An entry in two columns** (Strong vs and Weak vs stacked). Rejected: up to nine rows, so it
  scrolls at 800 px.
- **Raising max-widths everywhere.** Rejected: that stretches lines and buttons without laying
  anything out.
- **Keeping the aspect-ratio breakpoint alone.** Rejected: it would re-arrange phones held
  sideways.

## Verification

- **Phones are unchanged, measured.** A script recorded every visible element's box, font size,
  overflow and position on every screen at 375 × 812, 390 × 844 and 812 × 375. It covered home,
  Free play, the manual (index, four entries, chart), the rules, the lineup (with a gap), a seeded
  Reveal series from round 1 through every round to the result, and an older link. The boxes
  before and after match on all 51 screens (the new wrappers aside, which take the place of what
  they wrap).
- **Desktop.** Every screen was checked at 1280 × 800, 1440 × 900 and 1920 × 1080: no content
  overflows a scroll box of its own, and nothing scrolls sideways.
- **Regression test.** `desktop-layout.wide.browser.test.ts` runs in Chromium, Firefox and WebKit
  at 1280 × 800. It checks that no setup or reading screen has an inner scroll box, that every
  ball's entry fits without scrolling, and that both pickers set the grid beside the picks. It
  failed on the old CSS in all three engines.

Before and after at 1920 × 1080 (downscaled), in `docs/decisions/0031/`:

| Screen          | Before                              | After                              |
| --------------- | ----------------------------------- | ---------------------------------- |
| Home            | ![](0031/home-before.jpg)           | ![](0031/home-after.jpg)           |
| Free play       | ![](0031/free-play-before.jpg)      | ![](0031/free-play-after.jpg)      |
| Manual: balls   | ![](0031/manual-index-before.jpg)   | ![](0031/manual-index-after.jpg)   |
| Manual: entry   | ![](0031/manual-entry-before.jpg)   | ![](0031/manual-entry-after.jpg)   |
| Matchup chart   | ![](0031/matchup-chart-before.jpg)  | ![](0031/matchup-chart-after.jpg)  |
| Best of 3 rules | ![](0031/rules-before.jpg)          | ![](0031/rules-after.jpg)          |
| Lineup          | ![](0031/lineup-before.jpg)         | ![](0031/lineup-after.jpg)         |
| Reveal round 1  | ![](0031/reveal-round-1-before.jpg) | ![](0031/reveal-round-1-after.jpg) |
| Between rounds  | ![](0031/between-rounds-before.jpg) | ![](0031/between-rounds-after.jpg) |
| Result          | ![](0031/result-before.jpg)         | ![](0031/result-after.jpg)         |
| Older link      | ![](0031/older-link-before.jpg)     | ![](0031/older-link-after.jpg)     |
| Match           | unchanged: ![](0031/match.jpg)      |                                    |

## Consequences

- **Positive:** each desktop screen does its job across the width, and a manual entry reads at a
  glance. No scrollbar can cover content on a setup or reading screen.
- **Positive:** the phone is provably untouched, and a test holds the desktop layout in three
  engines.
- **Negative:** on a desktop the keyboard order follows the DOM, which is the phone's order. In
  Free play and the lineup, Tab reaches the grid before Start. In an entry, it reaches Strong vs
  and Weak vs before Even with and Try it. Both orders still make sense (pick, then start; the
  counters, then the rest), and changing the DOM would change the phone.
- **Negative:** the query is repeated in each stylesheet. Vite's CSS pipeline here doesn't
  support `@custom-media`, and a comment in `layout.css` names it.
- **Negative:** a phone held sideways keeps the old side layout, including its inner scroll box.
  That is deliberate for this pass, which leaves phones alone.
