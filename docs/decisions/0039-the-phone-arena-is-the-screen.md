# 0039: The phone arena is the screen

- Status: Accepted
- Date: 2026-11-07
- Amends: ADR 0025 (§4 the track under the arena while a round plays), ADR 0033 (§2 where Leave
  series sits), ADR 0035 (Consequences: the bar did change the arena's size), ADR 0038 (§1 the
  auto margins apply to the panel beside a match only)

## Context

On an iPhone (390 × 844, Safari, upright) the court in a Best of 3 round had shrunk to about 70% of
the screen width, with wide gaps either side. The court is the game's focal point, so it should be
as large as the screen allows in every mode and state, and mid-fight the court, both health bars
and the speed control should fit on one screen without scrolling.

### What sized it

- `layout.css`: the stage is exactly `100dvh` tall and never scrolls. The arena container is
  `width: 100%; aspect-ratio: 1; flex: 0 1 auto`, so it gives up height to the panel under it,
  which never shrinks. `fitCanvasToContainer` then draws the court at `min(width, height)`,
  centred: hence the gaps. Court edge = min(width − 32, visible height − 44 − panel).
- Because the stage never scrolls, Safari never hides its toolbars, so `dvh` stays at the small
  visible height: about 664 px on a 390 × 844 iPhone.

### Which states

| State (phone, upright)                                                                 | Under the court                                                               | Court at 390 × 664 |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------ |
| Free play, fighting                                                                    | Change balls, health, speed: ~155 px                                          | 358 (full)         |
| Free play, result                                                                      | plus Replay, New match, the story: ~263 px                                    | ~357               |
| **Best of 3, a round being fought** (any format, level or round; the ready moment too) | the bar 48, the full track 162, health 35, speed 48, Leave series 44: ~385 px | **239**            |
| Best of 3, legend opened mid-fight                                                     | all of the above plus the legend                                              | **0**              |
| Best of 3, between rounds and the result                                               | the arena makes way (ADR 0025)                                                | not shown          |

### Since when

- The shrink rule: 98bb0af (2026-11-01).
- The track under the arena while a round plays: 7563567 (ADR 0025).
- The speed row: 35986dd. Leave series on its own row: e5fd700 (ADR 0033).
- The series bar: 8953169 (ADR 0035, 2026-11-07). ADR 0035 noted the extra row but said "the
  arena's size is unchanged", which held at the test sizes but not in Safari.

Each step took height; the bar tipped it below full width on a real iPhone. The touch tests ran
at 375 × 812, where there was still room (812 − 429 > 343), so none could catch it.

## Decision

Phone upright only (`not all and (min-aspect-ratio: 5/4)`): the layout beside the arena and the
desktop are unchanged.

1. **The score line.** While a round is fought the series bar reads `Round 2 · You 1–0 Bot ▾`,
   with the settings gear and the `?` (ADR 0040), in place of "Best of 3 · Reveal · Hard". It is a
   disclosure for the full track: closed by default; once opened it stays open for the rest of
   that round and closes when the next round starts. The legend explains ▾. Between rounds and at
   the result the bar and the track are as before. One component: `series-bar.ts` owns both forms.
2. **One foot row.** Speed and Leave series share a row under the health bars (`.hud-foot`):
   speed at the start, Leave series, a quiet text link, at the far end. Beside the arena each keeps
   its own row (`display: contents`).
3. **Opening something scrolls; it never squeezes the court.** While a round is fought, an open
   legend or track lets the stage grow (`height: auto; min-height: 100dvh`, by `:has()`), so the
   court stays full width and the opened part is reached by scrolling. The shrink rule stays only
   as the fallback for screens too short for even the closed panel (an iPhone SE with Safari's
   toolbars, about 548 px).
4. **A finished Free play match hides speed**: it does nothing then. Replay shows it again.
5. **Safe areas.** The stage's padding is the larger of the gutter and each safe-area inset
   (`viewport-fit=cover` was asked for, but nothing used the insets).

The panel under the court in a round is now about 170 px, so the court is full width down to
about 572 px of visible height: 390 × 664 and 375 × 635 (Safari on the two phone sizes) both fit.

A little scrolling stays, by design: between rounds with "How it was won" opened under the pick
rows, at the result with the story opened, and mid-fight only when the player opens the legend,
the track or settings.

### Setup screens start at the top on a desktop

ADR 0038 centred the panel beside the arena with auto margins, so a tall panel grows downward.
The same rule also caught the setup screens (`data-setup`: Free play setup, the manual, the Best
of 3 rules, lineup and round 1), so on a desktop a short one floated in the middle and its header
sat anywhere from 162 to 423 px down. Setup screens now drop the margins: every setup header
starts at the sheet's top padding (48, 54 and 64 px at 1280 × 800, 1440 × 900 and 1920 × 1080).
The series panel beside a match keeps them.

## Tests

- **`src/flows/phone-arena-flow.ts`**, run at 375 × 812 (`browsers-touch`), 390 × 844 (new
  `browsers-iphone`) and 390 × 664 (new `browsers-safari`, Safari's visible area on that phone).
  It plays a Showdown on Hard (round 1's ready moment and fight, round 2's) and Free play (ready,
  fight, result). In every state the court is within 2 px of the stage's width less its gutters;
  mid-fight the court, both health bars and speed are inside the screen with no scroll; with the
  legend or the track open the court keeps its width. Shown failing before the change: 239 of
  358 px at 390 × 664, and 0 and 14 px with the legend open at 375 × 812 and 390 × 844.
- **The consistency flow** records every setup screen's header top and fails if any differ, at
  375, 1280 and 1920 wide (shown failing in all three engines before the fix).

## Consequences

- Positive: the court is the screen in every state that shows it, and opening anything mid-fight
  can't squeeze it.
- Positive: the setup screens' headers sit in one place on a desktop.
- Negative: mid-fight on a phone the full track is a tap away rather than always shown.
- Negative: two more browser projects (three engines each) in CI.

Screenshots: `docs/images/phone-arena/` (`before/`, `after/`) at 390 × 664, 375 × 812 and
1920 × 1080; `docs/images/setup-top/` (`before/`, `after/`) at 1280 × 800, 1440 × 900 and
1920 × 1080.
