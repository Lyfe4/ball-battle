# 0040: Settings

- Status: Accepted
- Date: 2026-11-07
- Amends: ADR 0036 (§ tips can be turned off: now in settings, as two switches), ADR 0037 (§ the
  ready card's "Don't show these again" is the settings' cards switch), ADR 0038 (§1 the legend:
  its tips row is gone; the series bar holds the gear)
- Amended by: ADR 0044 (the panel keeps off the court, has a compact form, makes the match wait
  when it must cover it, returns focus on a tap outside, and shares the legend's look)

## Context

The tip switches ("Tips in the arena: Turn tips off · Show tips again") sat at the end of the
symbol legend, which is about symbols. The Fight! card's "Don't show these again" was a second,
separate setting (`ballbattle.readyCard`) that only "Show tips again" could undo, and nothing on
screen said so. The game needs one place for the few choices a player makes once.

## Decision

### One menu, one look

- **A gear** (`settings-menu.ts`): the same 44 px round button as the `?`, drawn as an SVG path
  (eight chunky teeth, a round hole), so it is the same on every device. Its accessible name is
  "Settings"; it is a disclosure (`aria-expanded`, `aria-controls`).
- **One panel on the page**, opened by whichever gear was pressed, so it looks the same
  everywhere. It floats (`position: fixed`), placed under its gear with its right edge on the
  gear's, or over the gear when there is no room below, and kept inside the visible screen
  (`visualViewport`, Safari's moving toolbar) clear of the gutters and the safe areas
  (`placeMenu`, `settings-place.ts`, pure and tested). It never takes part in the layout, so
  opening it moves nothing and can't squeeze the court (ADR 0039).
- **Always closable**: the gear toggles it; Close, Escape and a tap outside close it; focus
  returns to the gear (thick focus halo). It is moved into the page right after its gear, so Tab
  goes from the gear into it.
- **Sticker Pop, calm**: a raised surface with one slab, the display face for its title, the
  accent only on a switch that is on. A 120 ms fade and rise, none with reduced motion.

### Where the gear sits

At the top right of every screen, just before the `?` where there is one, so it is always found
in the same place:

- every screen header (`createScreenHeader`): Free play setup, the manual, the Best of 3 rules and
  lineup, an older link's screen;
- the series bar: round 1's pick (its header has none, so the screen has one gear), every later
  pick, between rounds, the result, and the score line while a round is fought;
- home: on the title's row;
- a Free play match: after Change balls.

### What it holds

Only choices that exist today, all saved per device:

- **Speed** (1× / 2×): the same remembered choice as the in-fight buttons, which stay as they are;
  changing either updates both.
- **Tips in the arena**: two switches, **Ability hints** (`ballbattle.tips`) and **What to watch
  cards** (`ballbattle.readyCard`, now stored as `on` or `off`). The Fight! card's "Don't show
  these again" turns the cards switch off, so it can be seen and turned back on here.
- **Show all tips again**: both switches on, every hint and card unseen.

A device that turned all tips off before the split (`ballbattle.tips` off, no card key) keeps its
cards off too.

Not added, for later if wanted: a bot level default (the setup already remembers it) and a reduced
motion override (the system setting is respected).

### Tests

- The consistency flow (375 × 812, 1280 × 800, 1920 × 1080) checks every stop: home, the setup
  screens, round 1, each round mid-fight, between rounds, the result, Free play's setup, fight and
  result, and the manual. Each has exactly one visible gear; its menu opens inside the screen; the
  gear, Close and Escape each close it with focus back on the gear. It also checks the open
  legend has no clipped or overlapping lines at each size.
- `settings.browser.test.ts`: both switches and the speed are saved and read back, the in-fight
  speed and the menu agree both ways, the Fight! card's button is the cards switch, and "Show all
  tips again" turns both on.
- `tips.test.ts`: the split, the reset and the migration. `settings-place.test.ts`: placement.
  `one-of-each.test.ts`: the menu and the gear are written only by `settings-menu.ts`.

## Consequences

- Positive: one place for the player's few choices, the same on every screen and device; the
  card's opt-out can be undone where it can be seen.
- Positive: the legend is only about symbols again.
- Negative: one more control at the top of every screen.
