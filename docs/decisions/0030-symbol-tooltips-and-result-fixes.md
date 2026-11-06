# 0030: Symbol tooltips, a Rematch that works, and numbered lineup slots

- Status: Accepted
- Date: 2026-11-06
- Amends: ADR 0025 (§1 symbols, §4 the end of a series), ADR 0027 (§5 the lineup)

## Context

Four things from playing:

- After a Reveal series, Rematch did nothing on a desktop screen, and the old match's health bars
  and the speed toggle appeared under the result.
- Empty lineup slots said "Empty" with a small grey number in the corner, so the order a pick goes
  in was easy to miss.
- On a desktop, the only way to learn what a ▲, ▼ or ⚡ means was to open the legend.
- The result screen on a desktop looked cluttered.

## Decision

### 1. Rematch: the scoreboard redraws when the series changes

**Cause.** The scoreboard is updated from the arena's frames (`drawn`). The arena stops drawing
once a finished match is still. A Reveal rematch opens on a pick (the bot shows first, or the player
does), so it puts no new match on the arena, and nothing redrew the scoreboard. The address had
already changed to `step=play` and `showControls` had already shown the HUD again, so the old
result stayed with the health bars and speed under it. Blind and Loser picks rematches put round 1
on the arena, which redraws, so they worked. On a phone the layout change resized the arena, and
the resize redrew it by luck.

| Before the fix | Blind | Reveal | Loser picks |
| -------------- | ----- | ------ | ----------- |
| Link, 375 px   | works | works  | works       |
| Link, 1280 px  | works | stuck  | works       |
| Live, 375 px   | works | works  | works       |
| Live, 1280 px  | works | stuck  | works       |

**Fix.** `SeriesHost.redraw()` (the arena's own `redraw`) runs after every change the controller
makes: start (a rematch included), a pick, the next round, resume. A flow test through the real page
plays a Reveal link to its result at 1280 × 800 and clicks with real pointer events. It checks
Copy link (the decided link with every pick), Rematch (round 1 at once, 0–0, the toss) and New
series (the lineup, with the lineup and format kept). It failed with the redraw removed. The whole
table above was checked after the fix as well.

### 2. The result screen

Health, speed and the HUD's result row belong to a fight. At the result they say nothing the track
and the headline don't, and the speed only matters once a round plays. ADR 0025 already hides them
between rounds and at the end (`data-round-over`); they only showed because of the bug above. The
flow test now checks they are hidden at the result. The dimmed last frame beside the result on a
wide screen stays: it shows how the deciding round ended.

### 3. Lineup slots say which they are

An empty slot reads **Slot 2 · Empty** wherever the tray sets the order (Blind, Loser picks), so a
gap left by taking a ball out reads as the place the next pick goes. A filled slot's number is a
badge in the accent colour, matching the tile's "Slot 2 ✕". Reveal's tray sets no order (ADR 0025),
so it keeps "Empty" and no numbers.

### 4. Symbol tooltips (mouse and keyboard only)

- **One source of words.** `src/ui/symbols.ts` holds every symbol and its meaning. The legend
  renders from it, and so does the tooltip, so the two can't disagree.
- **One component.** `installSymbolTooltips` (`src/ui/symbol-tooltip.ts`) puts a single small
  tooltip on the page and finds symbols by event delegation on `data-symbol`. A screen only names
  its symbols with `markSymbol`.
  - Named today: the ▲ ▼ = marks (grid tiles, Free play slots and its legend line, pick rows, the
    matchup chart), the won and lost rings and `?` on the series track, ↻ and ⚡.
- **When it shows.** On mouse hover (`pointerType === 'mouse'`), and when keyboard focus
  (`:focus-visible`) lands on a control that shows symbols. In that case it lists each one's meaning
  once, so a pick row with ▲ and = says both.
- **When it hides.** Escape, scrolling, the pointer leaving, or focus moving away.
- **Touch adds nothing.** A tap is a press, a tap's focus isn't `:focus-visible`, and the legend
  stays the way to look a symbol up there.
- The tooltip is `aria-hidden`, because every symbol already has its words in its control's
  accessible name.
- **Not covered:** the arena's rule cue and status rings. They are drawn on the canvas for a
  moment, on balls that move, so there is nothing steady to hover. The legend explains the cue.

## Consequences

- Positive: Rematch works in every format at every width, and a series screen can't depend on the
  arena happening to redraw.
- Positive: a desktop player learns a symbol by pointing at it, and the words match the legend.
- Negative: every new symbol must be named with `markSymbol` to get a tooltip. The legend still
  covers any that are missed.
