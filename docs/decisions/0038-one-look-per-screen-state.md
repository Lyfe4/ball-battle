# 0038: One look per screen state

- Status: Accepted
- Date: 2026-11-07
- Amends: ADR 0025 (§ the legend opens in place: it now also has its own Close), ADR 0035 (the
  series bar now also sits over round 1's pick), ADR 0037 (§4 where the ready card sits, and
  Escape no longer starts the match)
- Amended by: ADR 0039 (§1: setup screens start at the top), ADR 0040 (the legend’s tips row moves to settings), ADR 0044 (the legend has
  the info panel's look; the flow also compares rendered looks)

## Context

Playtesting Best of 3 on a desktop (Chrome, 1920 wide) found three problems, and the brief asked
for every screen state to look and behave the same in every mode, format, bot level, result and
screen size:

- **The legend couldn't be closed.** After a round, with "How it was won" open, pressing `?`
  opened the legend and the `?` went off the top of the screen until the next round.
- **"How it was won" and the pick rows seemed to have two designs.** One read "Chrono dealt 85 /
  Hits 85" and "0:23 Titan's hits −20" with a "Your pick: answer" banner; the other led with
  "Round 1: … knocked out … at 0:12" and a "How it was won" toggle.
- **The ready card moved.** On a phone it hung below the court; beside the arena it sat at the
  top, middle or bottom of the court, depending on where the balls started.

What we found:

- **The legend.** In the layout with the panel beside the arena (`min-aspect-ratio: 5/4`), the
  stage is one screen tall and centres the panel with `align-items: center`. A panel taller than
  the screen overflowed both ways, and its top, with the `?`, landed above the page, where no
  scroll reaches. At 1920 × 1080 the panel only just fits; Chrome's own toolbar leaves the page
  about 950 px of height, enough to tip it over. At 1280 × 800 it happens every time.
- **Two designs.** There is one "How it was won" (`match-story.ts`) and one set of pick rows
  (`pick-rows.ts`, `pick-banner.ts`). Nothing branches on format, bot level, winner, a resumed
  series or round number. The other version is the build from before ADR 0037: its Context quotes
  those exact strings. A tab opened before that deploy keeps running the old build until it is
  reloaded.
- **Real divergences found by the audit:**
  - Round 1's pick had the `?` in a "Round 1" header, while later picks had it in a quiet bar.
  - The words for a pick were worked out twice.
  - After a drawn play, the story told the previous round (or nothing in round 1), not the draw
    just watched.
  - "Ball vs ball" was drawn two ways: small with names on the ready card, large without names
    between rounds.
  - With the legend open on a ready moment, Escape both closed the legend and started the fight.

Presentation only: `src/sim`, the ruleset, URLs and the story's rule are unchanged.

## Decision

### 1. The legend is always closable

- **The panel beside the arena centres with auto margins** (`layout.css`), not `align-items`.
  Auto margins centre while there is room and fall to zero when there isn't, so a tall panel grows
  downward and the page scrolls to it. This holds while a round plays, between rounds, at the
  result, and on a phone turned sideways.
- **The legend has its own Close** at its end ("Close the legend" to a screen reader). It closes
  the legend and returns focus to the `?`, even when the `?` has scrolled away. The `?` and Escape
  still close it. It stays inline (ADR 0025), so the symbols it explains stay in view.

### 2. One component per shared part

- **The series bar** (`series/series-bar.ts`: "Best of 3 · Reveal · Hard" and the `?`) sits over
  every pick, round 1's included. Round 1 keeps its heading and Back (the lineup can still change
  there), but the `?` is now in the same place on every pick screen.
- **One pairing** (`balls/pairing.ts`): each ball's drawing (48 px) over its name, with "vs"
  between. The ready card and the next round between rounds both use it; a ball not shown yet is
  "?" with "Not shown yet". Free play's slots are pickers, so they keep their own design.
- **One sentence for a pick** (`pickLine` in `series-text.ts`), for round 1 and later rounds.
- **The story tells the last match played** (`lastPlayOf` in `series/series-view.ts`), a drawn
  play included: "Round 2: Time up: a draw". The rule for its headline and moments is unchanged.

### 3. The ready card sits centred on the court

On a phone and a desktop, in every round and mode, the card is centred on the court (`placeFor`
and its bands are gone). On a phone it covers the middle of a 343 px court at tick 0, which the
brief accepted: Fight! is always in the same place.

### 4. Escape only closes things

Escape no longer starts a fight. ADR 0037 made it start the match so the moment was "never a trap",
but the card isn't modal (Tab moves on), so it never was one. Fight! (a click, a tap, Enter or
Space) is the one way to start. Escape closes the legend, as everywhere.

### 5. Tests that catch these coming back

- **`src/flows/consistency-flow.ts`**, run by three files:
  - `consistency.wide.browser.test.ts` at 1280 × 800;
  - `consistency.full.browser.test.ts` at 1920 × 1080, in a new project, `browsers-full`;
  - `consistency.touch.browser.test.ts` at 375 × 812 with touch.

  Each sets up a Reveal series against the Hard bot and plays it to its result, then Free play
  and the manual, with real clicks. On every screen with a legend (the setup screens, round 1's
  pick, after each round and at the result with "How it was won" open):
  - the open legend keeps the `?` on the page;
  - the `?`, Close and Escape each close it.

  Every ready card's centre is within 2 px of the court's centre, and Escape leaves the card
  waiting. Every story is closed by default, its summary is the result (with "Round N:" in a
  series) and "How it was won", and opened it shows one bar per ball and its moments. Shown
  failing before the fix:
  - the wide run with the `?` above the page after round 1;
  - the phone run with the card off centre;
  - Escape starting the fight when its old listener is put back.

- **`src/ui/one-of-each.test.ts`** fails if "How it was won", a pick row, the pick banner, the
  series bar, the pairing or the ready card is written by any module but its own.
- **`lastPlayOf`** after a draw, after sudden death and after a win; **`pickLine`** for each kind
  of pick.

## Consequences

- Positive: a screen state looks and behaves the same in every mode, format, bot level, result and
  size, and a second version of a shared part fails a test.
- Positive: the legend can always be closed, and Fight! is always in the same place.
- Negative: on a phone the ready card covers the middle of the court, and so the starting balls
  when they start there.
- Negative: the ready card is taller, since each ball's name now sits under its drawing.
- Left for later: the beside layout's `(min-aspect-ratio: 5/4)` rules sit outside the one desktop
  query ([#16](https://github.com/Lyfe4/ball-battle/issues/16)); a tab left open across a deploy
  runs the old build with no notice ([#17](https://github.com/Lyfe4/ball-battle/issues/17)).

Screenshots in `docs/images/consistency/`, `before/` and `after/`, at phone (375 × 812) and
desktop (1920 × 1080) width, and the legend at 1280 × 800 (`laptop-`): round 1's pick, each ready
card, each round with the legend and the story open, the result, and Free play's card and result.
