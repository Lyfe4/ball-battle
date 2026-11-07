# 0020: Screens: a home, a ball manual, setup screens and routes

- Status: Accepted
- Date: 2026-11-05
- Amends: ADR 0011 (picker), ADR 0017 (series UI), ADR 0019 (draft-format UI)
- Amended by: ADR 0025 (Back rules, the info card removed, Best of 3 as visuals), ADR 0027 (Best
  of 3 leads home, Free play, Strong vs / Weak vs, lineup gaps), ADR 0031 (desktop layouts; no
  paused match beside setup screens on a desktop), ADR 0042 (§3: a series and round 1's pick
  survive a reload)

## Context

By ADR 0019 the game had quick matches, Best of 3 with three draft formats, 11 balls and a counter
map, but no front door. Visitors landed mid-fight with six controls and no first action. Players
couldn't learn what balls do or how they counter each other, though that is the game's strategy.
On phones the picker clipped every description mid-sentence. Best of 3 put the mode buttons, the
rules, three lineup rows with arrows, Choose balls, Clear and Reveal on one screen, and squeezed
the arena to a 105-210 px box above them.

## Decision

### 1. Phone first, one job per screen

Every screen is designed at 375 x 812 first, with one clear job and as few controls as possible.
Desktop adapts from it (CLAUDE.md). A wide screen gets the same panel beside the arena.

### 2. The arena shows only when something is fighting

The arena is on screen for the home demo, a quick match and a series round. Setup screens take
the whole phone screen: choosing balls, the series rules, the lineup and the order. A wide screen
keeps the paused match beside them, dimmed (`.stage[data-setup]`). The manual is for reading and
has no arena at any width. Nothing plays behind a setup screen. Before this, an unrelated quick
match played on behind the lineup builder, with its live HUD.

### 3. Every screen is a URL, and Back works

| Screen            | URL                                                  |
| ----------------- | ---------------------------------------------------- |
| Home              | bare URL                                             |
| Quick-match setup | `?view=pick&a=&b=`                                   |
| Quick match       | `?a=&b=&seed=` (unchanged)                           |
| Best of 3 setup   | `?mode=bo3[&fmt=]` (rules), `&step=lineup` / `order` |
| Best of 3 round   | `&step=play`, then the full link once decided (0017) |
| Ball manual       | `?view=manual`, `&ball=id`, `&tab=chart`             |

- **Routing.** `parseRoute` (`src/app/route.ts`) reads any URL into one of these screens. It is
  tested against every link shape the game has written: shared match and series links still open
  in the fight, and only a URL with nothing for another screen opens home.
- **History.** Moving to another screen pushes a history entry (`src/navigation.ts`). Changes
  within a screen replace it: a new seed, a format, a pick.
- **In-app Back.** Each entry carries its depth. An in-app Back button goes back when the page
  pushed the screen. Otherwise it goes to the screen's parent, replacing the entry. The parent is
  usually home; for later series steps it is the previous step.
- **No Netlify rewrite.** Query parameters rather than paths mean the deploy needs no rewrite
  rule.
- **Steps that don't survive a reload.** The bot's lineup is still never in the URL before a
  series is decided. So `step=order` and `step=play` fall back to the lineup after a reload, or
  when Forward re-enters a series the player left.

### 4. One ball grid and one ball detail, read from the data

- **Shared tile.** The quick-match setup, the lineup and the manual use one tile
  (`src/ui/balls/ball-grid.ts`): the real drawing at 56 px and the name, no description. The
  whole roster fits a phone screen without clipping.
- **Info card.** It holds the full one-line description and the ball's counters by name.
- **Matchup helpers.** `src/ui/balls/matchups.ts` and `verdict.ts` read the definitions and the
  counter map. Tests check that they cover every ball, read each pair the same from both sides,
  and give every pair a reason, so the text can't drift.
- **Wording.** The UI says "favoured", never a win rate, because rates move with tuning.
- **Marks.** ▲ / ▼ always come with a word in the accessible name, never colour alone.

### 5. The screens

- **Home.** The arena runs a demo match captioned with the counter it shows and why. Demos are
  favoured pairs only, a random one first and then the next after each result.
  - Under it: the name, one line on what the game is, a large Play, Best of 3 and Ball manual.
  - Play opens the quick-match setup with the demo's pair, the favoured ball the player's, and
    Start focused.
  - With reduced motion the demo holds a still frame after its intro until Watch the demo.
- **Quick-match setup.** It holds:
  - the two slots;
  - the verdict for the pair, as a live region;
  - the info card and the grid, marked ▲ / ▼ against the other slot;
  - Start.

  A tap fills the active slot, and filling A moves on to B.

- **Best of 3.** Each setup step is its own screen.
  - Rules: three cards with a line each.
  - Lineup: a three-slot tray on the shared grid. Tap a ball to fill the next slot and a slot to
    empty it, so there are no arrows, dialog or Clear.
  - Order (Reveal only): ▲ / ▼ against each bot ball.
  - Rounds: the arena keeps the full width, with the scoreboard below it, and loser picks show
    ▲ / ▼ against the bot's next ball.
  - The bottom sheet over the arena in the plan was not needed: with the arena full width, the
    panel under it has room for the between-rounds content.
- **Ball manual.** The roster, and an entry per ball:
  - the drawing, its line and stat bars against the roster;
  - Beats / Loses to with the reason for each, and Even with;
  - each opponent linking to its own entry, the neighbours named at the foot;
  - Try it, which sets up a quick match against a ball it beats.

  The **matchup chart** tab shows the whole map like a type chart. Rows are balls and columns
  opponents, even pairs are blank, the row and column highlight, and the reason shows below.
  Cells take roving focus. A node-and-edge counter diagram was rejected: 25 favoured edges among
  11 balls is too tangled to read, and it grows with every ball.

### 6. Restyle-ready structure

- **Tokens.** Tokens come in two layers (`src/styles/tokens.css`): a raw palette, then roles
  such as `--color-surface` and `--color-favoured`. Components use roles only.
- **Stylesheets.** Each component's stylesheet sits next to it, and `src/style.css` lists them
  with `@import` in cascade order.
- **Style guide.** `styleguide.html?only=ui` shows the shared parts, and `?only=phone-arena`
  shows the designs at phone size and density.
- **Fonts and the CSP.** A web font would need `font-src 'self'` in both `netlify.toml` and
  `scripts/security-headers.ts`. That is left to the restyle.

### 7. Frost at phone size

At phone size Frost's faceted hexagon lost its facets and read as a solid gem. Its small design
is now a snowflake: six spokes with branches. The full-size crystal is unchanged.

## Consequences

- Positive: a first-time visitor sees the game's idea (a counter, and why) before touching
  anything, and is two taps from a fight they chose. Best of 3 is playable on a phone.
- Positive: the manual and the picker can't go stale. They read the same data the balance checks
  hold the game to.
- Negative: Frost now has two looks. Icons under the small-design radius (the setup slots, the
  bot's row, the chart) show the snowflake, and large tiles show the crystal.
- Negative: there is still no DOM test environment. The screens were checked by driving headless
  Chrome over the DevTools protocol at 375 x 812 (2x, touch) and 1280 x 800, with scripted taps,
  keys and history, and keyboard-only passes. The pure parts (routes, demo pairs, matchups,
  verdicts) have unit tests.
- Text change in the sim's data: seven counter-map reasons ended in "(ADR 0016)". They are player
  text now, so the reference moved to the data files' header comments, and a test keeps decision
  and file references out of reasons. No behaviour changed.
- Open: whether Reveal's order step should give the player information to act on (a sequential
  reveal); see ADR 0019's addendum.

## Addendum: after review (2026-11-05)

- **Frost is one snowflake at every size.** The full-size design is now the same flake as the small
  one, finer (the game's mark weight, two pairs of branches per spoke), so Frost no longer has two
  looks. `styleguide.html?only=frost` shows it at every size.
- **Speed is a trait, not a bar.** Base speeds run from 720 to 800, so a Speed bar looked the same
  for every ball. The manual shows a "Fastest ball" / "Slowest ball" chip for the roster's
  extremes (from the definitions), and keeps bars for Health and Contact hit.
- **The pickers' info card links to the manual entry** ("More about <ball>"), a real link opened
  in the app so Back returns to the picks or the lineup tray as they were.
- **A favicon** drawn from the Brawler's small design (SVG, with a 32 px PNG), checked by a test
  against the Brawler's colours.
