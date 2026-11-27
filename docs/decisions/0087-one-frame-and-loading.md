# 0087: One frame, nothing jumps, never in pieces

- Status: Accepted (2026-11-25), approved by the owner with every recommendation (the eleven
  decisions below). Building in four batches with ADR 0086 (the plan below).
- Date: 2026-11-25
- Amends: ADR 0081 (the rail on every screen but a fight beside and on a desktop; the phone's bar
  on browse screens; the avatar in the header's lead slot on every size and the game's mark atop
  the rail; requirement 2, one ball-name size; requirement 5, the Friends order no longer depends on
  having friends; Profile's stats card dropped; Play under the header row on a desktop), ADR 0040
  (the gear is always last in the header, after any `?`), ADR 0031 (the frame's width and each
  screen's own columns; notices stop floating), ADR 0054 (sized skeletons for lists, one reveal, one
  failure card), ADR 0067 (the panel beside a fight keeps its top)
- Builds on: ADR 0020 (every screen a URL), ADR 0025 (Back), ADR 0032 (Sticker Pop), ADR 0039 (the
  phone arena is the screen), ADR 0084 (the function-call budget)
- With: ADR 0086 (social UX), whose build plan this record shares
- Proposal: `docs/polish-proposal.md` (the audit's numbers, rules and plan; its scripts, raw data,
  filmstrips and mockups are kept locally)

## Context

A measured audit of every non-fight screen at seven sizes in three engines (staging for guests, the
local stack signed in; the proposal, Parts A to D) found the app steady on a phone and restless on a
PC, and loading in pieces:

1. **Every screen has its own header position on a PC.** At 1920 × 1080 the gear sits at nine x
   positions across 17 screens and the header's top at four heights; Balls → Matchup chart moves the
   title 192 px left and the gear 192 px right. On a phone only the gear moves (52 px, where a `?`
   sits after it).
2. **The rail comes and goes**: it shows on the four tab screens only, so a ball's page, Profile,
   sign-in and every setup re-centre the page.
3. **Friends loads in three pieces and reorders**: the link card, a blank body, then the lists with
   the link card moved to the end.
4. **A first visit shifts hard**: CLS 0.50 on Balls and 0.36 on Friends at 390 × 664, 0.25 on Play
   at 1920 (good is ≤ 0.1). Causes: an empty HUD box from `index.html` that the first screen moves,
   the canvas's default 300 × 150 size, and the font swapping in about 400 ms after first paint (no
   preload; on Slow 4G it lands at 1.61 s against a first paint at 1.26 s).
5. **Profile floats mid-screen on a desktop**, and in Firefox 224 px left of centre (`justify-self`
   on a child of a block box).
6. The Matchup chart is the one tab screen taller than 1920 × 1080, so classic scrollbars shift its
   column 7 px; Friends signed in toggles a scrollbar at 1280 × 800 as rows come and go.
7. The panel beside a fight re-centres each phase (its gear at y 326, 281, 208 at 1920).
8. Actions drawn as pink links in 18 places, four ball names a size smaller, the Balls / chart
   switch in the "chosen option" look, three failure looks, and 16 animation durations and six
   easings, all literals.
9. Every cold open of Friends, Profile or sign-in reads `/me` twice (the avatar and the screen).

## Decision

### One frame

Every screen where nothing fights uses one page frame: a header row at `--frame-top`, then the
content from the frame's left edge, the frame at most `--frame-max` (90rem) wide and centred in
what the rail leaves.

- **Tokens** (`tokens.css`): `--frame-gutter` 16 px (phone, beside) / 32 px (desktop); `--frame-top`
  `max(16px, safe-area-top)` / 32 px; `--frame-max` 90rem; `--head-height` 44 px; `--col-aside`
  26rem; `--rail-room` 0 / the rail's width.
- **The header row** (today's `createScreenHeader` grown up): a lead slot always 44 px wide (the
  avatar on a tab screen, Back elsewhere; empty in a build without accounts), the title (22 px, one
  line, ellipsis), then the tools: `?` where the screen has symbols, then **the gear, always last**,
  so it never moves. The game's mark (a ball and the word on a desktop) tops the rail.
- **The shell by kind** (`tabOf` becomes `shellOf(screen)`, tested as a table):

| Kind   | Screens                                                                         | Phone upright              | Beside and desktop       |
| ------ | ------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| tab    | Play, Balls (and its chart), Friends, Ranks                                     | bar                        | rail, its tab lit        |
| browse | a ball's page, Profile, Sent / Blocked lists                                    | bar (the opener's tab lit) | rail                     |
| task   | setups, sign-in, the challenge card, lobby, notices, privacy and terms          | no bar                     | rail                     |
| fight  | a lineup, coin toss, match, series rounds and end, live rooms, a start's lineup | no bar                     | no rail (ADR 0039, 0067) |

On a PC the rail leaves only when the arena takes over, a deliberate change of mode; on a phone
the bar steps aside for a task that needs the room or the keyboard. Back works as today.

- **Columns by kind of content**, from the frame's left edge (never a phone column centred, ADR
  0031): **list** (Friends, Profile, Ranks: main `1fr` + aside `--col-aside` on a desktop), **grid**
  (Balls and the chart, one width), **wide** (a ball's page, setups, Free play: the screen's own
  columns) and **reading** (sign-in, notices, privacy and terms: prose 40rem + an aside). The legal
  pages move into the frame.
- **Play** sits under the same header row: on a desktop the header (avatar, BallBattle, gear) runs
  across the frame's top and the court and panel sit under it; the 75 px hero title goes.
- **The panel beside a fight keeps its top**, aligned to the court's, through every phase.
- **Scrollbars**: `scrollbar-gutter: stable` on the root in `(min-aspect-ratio: 5/4) and (pointer:
fine)`: classic scrollbars never shift a page, overlay ones reserve nothing.
- `src/flows/frame-anchors-flow.ts`, run in every browser project, fails when the lead slot, title
  or gear differs between two screens at one size by more than 0.5 px, the content's left edge is
  not the lead slot's, the rail or bar shows where `shellOf` says it doesn't, or the page width
  changes between screens.

### Loading: never in pieces

1. **Static first**: what needs no data renders in the first frame, in its final place.
2. **Sized skeletons** (`skeleton.ts`, one look), as many rows as known (the inbox already says how
   many); never a bare spinner, never an empty body.
3. **No reorder after a read**: sections have one order per state; an empty state takes a section's
   place (the Friends section always sits where it sits; ADR 0081's "with no friends, the link card
   comes first" goes).
4. **One calm reveal**: a section's data replaces its skeleton with one fade (`--motion-base`); under
   150 ms from the screen showing, no skeleton at all.
5. **What was read this visit shows at once on return** (Friends, Profile's `/me`, Ranks) and
   refreshes in place: a module map in memory, cleared on reload, sign-out and Forget me. Nothing new
   is stored on the device, so `privacy.html` doesn't change.
6. **One read per answer**: the shell's `/me` is one in-flight promise shared by the avatar and the
   screen; Friends draws its rows from the inbox and asks `/friends` only for what the inbox lacks.
   No new function call anywhere; one fewer per cold open of Friends, Profile or sign-in.
7. **Failure is a designed state**: one failure card (title, the game's words from
   `online-failure-text.ts`, a Try again button) in the failed section's place; offline says "You're
   offline"; the rest of the screen stays.
8. **The first paint is the real frame**: the one font file is preloaded (`<link rel="preload"
as="font" crossorigin>`, `font-display: swap` kept), the stage stays hidden until the router has
   laid out its first screen (one frame, with a safety timeout so a script error never leaves a
   blank page), nothing from `index.html` moves when the first screen mounts, and the canvas has its
   CSS size before its first draw. A first visit's layout shifts stay ≤ 0.02 in Chromium.

### Motion

Tokens in `tokens.css`: `--motion-quick` 120 ms, `--motion-base` 200 ms, `--motion-slow` 320 ms,
`--ease-out` `cubic-bezier(0.2, 0, 0, 1)` (enter, M3 standard), `--ease-in`
`cubic-bezier(0.3, 0, 1, 1)` (leave, M3 standard accelerate). Platform screens stay calm (ADR 0032):
no bounce or overshoot outside the arena, nothing slides sideways. A browse move fades in and rises
8 px over `--motion-base` (Back: a `--motion-quick` fade); a tab change is instant or a quick
cross-fade of the content only (the rail and header never animate); a sheet rises (phone) or fades
and scales from 0.98 (beside, desktop); a skeleton's reveal is one fade; into a task or a fight
there is none (the arena's intro does the work, ADR 0007). Reduced motion fades or doesn't move.
`document.startViewTransition` where the browser has it, CSS otherwise. `motion-tokens.test.ts`
fails on a duration or easing literal outside `tokens.css` and the arena's own files, its allow-list
of today's literals shrinking pull request by pull request until it is empty.

### Consistency

- **One ball-name size**: 12 px (`--font-size-tiny`), weight 700, −0.02 em, the tile's side padding
  0; every name fits one line at 320 px and up, and `data-long` goes (amends ADR 0081 requirement 2).
- **Controls by kind**: one primary per screen or card; a text link (with its "›") only navigates;
  a row action is a sheet row; destructive actions in the danger look, apart and confirmed; the
  Balls / chart switch becomes tabs (`role="tablist"`, one underline), never the chosen look.
- **One card style** (`--radius-large`, `--space-gap` padding, a 1.05 rem heading), no card in a
  card; headings at two sizes (page 1.375 rem, card 1.05 rem).
- **Profile's stats card goes** until it has one real number; Ranks keeps its coming-soon cards.
- One avatar size (44 px) in the lead slot; the large disc on Profile only.

## The owner's decisions (2026-11-25), all as recommended

1. **The rail** on every screen but a fight, beside and on a desktop.
2. **The phone's bar** on tab and browse screens (a ball's page, Profile).
3. **The avatar** in the header's lead slot on every size; the game's mark atop the rail.
4. **The gear always last** (`?` before it), amending ADR 0040's "before any `?`".
5. **The frame** at most 90rem, with each screen's own columns.
6. **Ball names**: one 12 px size for all.
7. **Profile's stats card**: dropped until a real number exists.
8. **Screen motion**: View Transitions where present, CSS otherwise.
9. **The font**: preloaded, `font-display: swap` kept.
10. **Play on a desktop**: under the header row; the hero title goes.
11. **The visit cache**: in memory only (no privacy change).

## The build plan (merged with ADR 0086)

Four batches, one staging build each. "P n" is this record's pull request n, "S n" ADR 0086's.

| #   | Batch 1: the rules and first paint                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Docs: ADR 0086 and this record, the amendments, the UI quality bar in CLAUDE.md                                      |
| 2   | Tokens: the frame and motion tokens, `scrollbar-gutter`, `motion-tokens.test.ts` with today's literals allowed (P 2) |
| 3   | First paint: the font preloaded, the stage hidden until laid out, the canvas sized before its first draw (P 3)       |
| 4   | Focus for the keyboard only (S 2)                                                                                    |
| 5   | One close per overlay, the × last in each overlay's head (S 3)                                                       |

| #   | Batch 2: the frame                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------- |
| 6   | The header row: lead slot, title, `?`, gear last; the avatar in the lead slot everywhere, the mark atop the rail                 |
| 7   | The shell rule (`shellOf`): the rail on every non-fight screen beside and on a desktop; the bar on tab and browse screens        |
| 8   | Columns (list, grid, wide, reading); Profile and notices stop floating; legal pages in the frame; the beside panel keeps its top |
| 9   | Play under the header row on a desktop; the hero title goes                                                                      |
| 10  | The Balls / chart switch as tabs; one ball-name size                                                                             |
| 11  | The sheet as a component (S 4), on the motion tokens                                                                             |

| #   | Batch 3: loading and the Friends tab                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------- |
| 12  | One `/me` (one in-flight promise); the in-memory visit cache                                                                     |
| 13  | Friends in place (rules 1 to 7): static first, rows from the inbox, sized skeletons, a fixed order, one reveal, one failure card |
| 14  | Friend rows and the friend sheet (S 5)                                                                                           |
| 15  | Take turns from the sheet (S 6)                                                                                                  |
| 16  | Profile's rows and danger zone, its stats card dropped; the remaining text-link actions become buttons or rows; the failure card |

| #     | Batch 4: signals and motion                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------- |
| 17    | Play loses the strip (S 7)                                                                              |
| 18    | One incoming banner (S 8), on the motion tokens                                                         |
| 19    | Screen motion on tokens, View Transitions where present; the motion allow-list empty outside the arena  |
| 20-22 | The crossed challenge and words (S 9), the friend lobby (S 10), by turns' Your games and endings (S 11) |

## Consequences

- At one size, every non-fight screen's lead slot, title and gear sit on the same pixels, and the
  rail stays on a PC until a fight; `frame-anchors` holds it in every browser project.
- A first visit paints its real frame once, in the real font where the network allows; nothing
  from `index.html` moves. The stage hides for at most one frame (or the safety timeout).
- Motion has five tokens and a test; the allow-list of literals is the to-do list.
- One function call fewer per cold open of Friends, Profile or sign-in (ADR 0084), and nothing new
  is stored on the device.
- The rail costs 176 px on a setup at 1280; the setup's two columns still get 1040 px, more than
  ADR 0031's 64rem.

## Addendum (2026-11-25): the first paint, as built (Batch 1, PR 3)

- **The font**: the Latin subset only (`scripts/font-preload.ts` finds its hashed name in the
  bundle and writes `<link rel="preload" as="font" type="font/woff2" crossorigin>` into
  `index.html`; the build fails if there isn't exactly one). Latin Extended and Vietnamese load
  only for a character in their range, as before.
- **The stage** is `data-booting` in `index.html` and drawn **transparent** (`opacity: 0`), not
  hidden: a screen focuses its first control as it opens (Play on arrival), and a hidden element
  can't take focus. It shows (`src/app/first-paint.ts`) in the animation frame after the router
  has laid out the first screen and the font is ready, waiting at most `FONT_WAIT_MS` (1 s) for the
  font. The canvas is sized from its container's layout when the arena is made and again just
  before the stage shows (`fitCanvasToContainer`'s `fit`), so it is never drawn at 300 × 150.
- **The safety** is the stylesheet's own: `--boot-safety` (3 s) shows the stage and a centred line
  ("BallBattle is still starting. If nothing shows, reload ›") if the script never shows it. 3 s,
  not 1.5: the stylesheet's clock starts at about 0.6 s on Slow 4G and the stage shows at about
  1.3 s, so 1.5 s would flash the line on any slower link. The HUD box stays in `index.html`
  (screens find their parts there); while it is transparent nobody sees it move.
- **Measured** (local `pnpm preview`, Chromium, first visits): CLS 0.50 → 0 on Balls at 390 × 664,
  0.25 → 0 on Play and Friends at 1920 × 1080, 0.06 → 0 at 812 × 375; 0 on all nine loads,
  unthrottled and Slow 4G. On Slow 4G the first contentful paint moves from 1.10 s (the fallback
  font over a boot box first painted at 0.56 s, the font swapping at 1.47 s) to 1.32 s (the whole
  screen once, in its font): the preloaded font now shares the link with the script.
- **Tests**: `first-paint.{safari,full,landscape}.browser.test.ts` (`first-paint-flow.ts`): the
  stage shows once and the reload line is gone; the font was ready when it showed; the canvas's
  box and backing store match its container's layout; no landmark moves in the 30 frames after;
  in Chromium the layout shift after the stage shows is ≤ 0.02 (measured 0 in 10 local runs of
  every screen and size). Shifts are counted from the stage showing because the dev server injects
  the stylesheet by script (production's is in the head, so nothing paints before).

## Addendum (2026-11-26): the frame, loading and Friends, as built (Batches 2 and 3)

Built overnight as #192-#203 (Batch 1's last PR, then plan PRs 6-16). What the record above left
open, and what changed in the building:

- **The header row** (`screen-header.ts`): the lead slot is a `.screen-lead` box always one tap
  target wide (Back, the avatar placed there by the shell on a tab screen, or nothing); the title
  is one line with an ellipsis; then `?`, then the gear. Play's row is the same row at every size
  ("BallBattle" at the title's size): one frame means one title size. The series bar's tools also
  put the gear after the `?`.
- **The rail's mark** is the favicon's Brawler (`/favicon.svg`) with the word on a desktop,
  `aria-hidden` (the page's title names the game), level with the header row (`--frame-top`).
  One avatar button now, in the lead slot.
- **The shell** (`shellOf` in `tabs.ts`, `body[data-shell]`): a ball's page lights Balls even from
  a link; Profile and tasks keep the last tab shown lit. The `online` screen key is always a fight,
  so a "series gone" notice there has no rail on a PC (left as is).
- **The frame** (`src/ui/frame.css`) applies beside and on a desktop to every screen where nothing
  fights; on a phone the stage's padding already is the frame. Columns, from the frame's left edge:
  list `--col-list` 36rem (Friends, Ranks), reading `--col-reading` 40rem (sign-in, Profile,
  notices), wide `--col-wide` 64rem (a ball, the setups), grid across the frame (Balls; the chart in
  the same frame). The list's main + aside layout waits for a later pass. Notices lost their
  floating card on a desktop.
- **The legal pages** run no script, so they have no rail or gear; their frame keeps the rail's
  room so the title lands on the game's pixels, and the other page's link sits where the gear is.
- **The panel keeps its top** beside and on a desktop in every phase. On a desktop the ability
  caption now floats under the panel (no room above a top-aligned panel).
- **Play on a desktop**: the header row is placed across the frame's top; the court takes the
  height under it and the panel 22-38rem of the width (1280 × 800: court 661 px; 1920 × 1080: 956).
- **Measured anchors** (Chromium): 390 × 664 lead 16,16 / title 72 / gear 330; 812 × 375 lead
  92,16 / title 148 / gear 737; 1920 × 1080 lead 321,32 / title 377 / gear 1717, on every screen
  including Play and the legal pages. `frame-anchors` passed 21 of 21 (seven projects, three
  engines) before the batch merged.
- **Tabs** (`view-tabs.ts`) keep focus when switching views; one name size is 12 px / 700 /
  −0.02em in the grid, the lineup's tray and the pick rows.
- **The sheet** (`sheet.ts`) animates by CSS alone (`@starting-style`, `allow-discrete`), so
  `close()` stays synchronous; a browser without them shows and closes at once. Its confirm step
  puts focus on Cancel. The danger look is `.danger-button` / `.danger-row` (red words on
  `--color-band-edged`) in `sheet.css`.
- **One `/me`** (`who-source.ts`) and **the visit cache** (`visit-cache.ts`, a module in memory
  with a generation, so an answer asked before a sign-in is never kept after it). Log out and
  Forget me reload the page; a sign-in clears it.
- **Friends**: one order (the link card always last); a device that remembers an account draws the
  account layout at once; the inbox's friends are the rows before `/friends` answers; skeleton
  rows (three by default) only after 150 ms; one failure card. Waiting for you's buttons sit under
  the name. Sent and Blocked stay listed under the code card; each row opens its own small sheet.
- **Controls**: `text-links.test.ts` names every `text-link` button with where it goes; one
  exception (the ready card's "Don't show these again", on the court) waits for the card's redraw.
- **Motion**: `--motion-press` (80 ms) for a button's press; `layout.css`, `button.css`,
  `manual.css` and `quick-setup.css` left the literal allow-list.
- **Batch 4** (the strip, the banner, screen motion, the server's crossed challenge, the lobby,
  Your games) is not started: the owner reviews its server and migration work first.

## Addendum (2026-11-26): a lineup keeps the rail on a PC

The owner's change after the staging walk (its fix list, item 2: setup → lineup moved the header
from 321,32 to 441,64 at 1920 × 1080 and the rail left, between two screens of one task).

- **A lineup is a task, not a fight**: a bot series' lineup (`series-lineup`) and a start's lineup
  (`start`) move from `fight` to `task` in `shellOf`. Beside and on a desktop the rail stays and the
  lineup sits in the frame (`frame.css`), its header row on the frame's pixels, laid out as Free
  play's picker (the tray on the left, the grid across the rest). The rail leaves only once the arena
  takes over: the coin toss, the match, rounds, between rounds, the end, live rooms.
- **On a phone nothing changes**: a task has no bar (ADR 0039), so a lineup has none, as before.
- The table above now reads:

| Kind   | Screens                                                                                       | Phone upright              | Beside and desktop       |
| ------ | --------------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| tab    | Play, Balls (and its chart), Friends, Ranks                                                   | bar                        | rail, its tab lit        |
| browse | a ball's page, Profile, Sent / Blocked lists                                                  | bar (the opener's tab lit) | rail                     |
| task   | setups, a lineup (a series' or a start's), sign-in, the challenge card, lobby, notices, legal | no bar                     | rail                     |
| fight  | coin toss, match, series rounds and end, live rooms                                           | no bar                     | no rail (ADR 0039, 0067) |

- **Tests**: `tabs.test.ts` (the table); `frame-anchors` compares the lineup with every other frame
  screen at every size (setup → lineup keeps the header); `tab-rail.landscape-small` keeps the rail by
  the lineup and finds none from the coin toss; `phone-arena` checks a phone's lineup has no bar.
- Invites still never show over a lineup: `invitesMayShow` reads the screen, not its shell.

## Addendum (2026-11-26): the asides, as built

The staging walk's fix list (item 4): lists and reading screens were one column on a desktop. On a
desktop only (beside, the frame is too narrow for two), `frame.css`:

- **Friends** (list, main `1fr` + aside `--col-aside`): the people in the main column (Waiting for
  you, then the friends, tiled two across where the room allows); the ways to find more people in
  the aside (the friend code card with Add, Sent and Blocked, then the link card). A guest's Friends
  keeps the split: the card in the friends' place (Sign in to keep friends, or the failure card)
  in the main column, the link card where an account's sits. `friends-section.ts` wraps the two
  (`.friends-main`, `.friends-aside`, one column on a phone in today's order).
- **Ranks** (list): the boards in the main column; the intro and Play a friend now in the aside.
- **Profile** (reading, 40rem + aside): who you are and the account's rows in the reading line; the
  danger zone in the aside, apart from them. Its rows (Change username, Log out) are now full-width
  sheet rows with their padding on every size (they were inline buttons with none).
- **Sign-in and the notices** have no aside: everything on them is the task, and sign-in's words
  are what its button agrees to, so they stay in one reading line.
- Motion: the waiting ball's loop moved onto `--motion-swing` / `--ease-swing`; `notice.css` left
  the literal allow-list.

## Addendum (2026-11-26): a notice on a fight's screen is a task

The staging walk's fix list (item 10): the `online` screen key was always a fight, so a notice
there ("Nothing here" for a series that is gone, a failure with Try again, offline) had no rail on a
PC. `shellOf(screen, tabs, notice)` makes a fight's screen a task while it shows a notice in its
fight's place (`noticeShown()` from the online series' screen, read on every layout): the arena never
took over. Loading stays a fight (its skeleton is the fight's, so nothing comes and goes when the
series arrives); a notice that turns into the series (Try again) is the change of mode into the
fight. `tabs.test.ts` and `tab-bar.browser.test.ts`.

## Addendum (2026-11-26): one button and row system

After the owner's staging check (labels touching their edges, an avatar on the first button,
Copy stretched ~300 px, a danger group barely apart). In `tokens.css` and one place, `button.css`:
a button is `--button-height` (48 px) with `--button-pad` (16 px) either side of its label; a
compact one (`.hud-button-compact`, 40 px, its unseen reach still `--tap-target`) sizes to its
label beside what it acts on; a screen's or sheet's main action is full width
(`.hud-button-main`); stacked actions are `--stack-gap` apart (`.action-stack`), with a quiet line
under one where it needs it (`.action-hint`); a row (`.sheet-row`) is full width, label left, as
tall as a button, with "›" only when it opens something (`data-opens`); the danger group
(`.sheet-danger`) is those rows in red, `--space-group` apart under a divider across the column.
`.sheet-content` lays its parts out one gap apart (it had no layout, so they touched).

The friend sheet: the name as its title, then a head block (the disc, @username and status on one
line), the main actions, Remove friend as a row, the danger group; "Take turns" is "Play by turns"
with "No need to be online together · up to 24 h a move" under it (`TURN_HOURS`, now in
`src/api/series.ts`, shared with the server). The request, sent and blocked sheets take the same
order. Profile: the username as its title, an identity block (72 px disc, @username, what opponents
see), the account's rows, the danger group; Privacy · Terms at the column's left edge.

`controls-look` (five browser projects signed in with friends, two as a guest) fails when a
button or row is under one tap target, its label within 12 px of its side, or two controls (or a
control and a person's disc) closer than the stack gap; on the code before this it found 35 such
breaks (the disc on the first button, 8 px gaps, "Hear it" 6 px from its edge).

## Addendum (2026-11-26, later): the online screens on the button and row system

The owner's staging check after the system above: on the friend lobby "Cancel challenge" had its
words touching its edges and "Also send a link" was pink words, an action drawn as a link.
`controls-look` had never seen an online screen, so neither failed.

- **`controls-look` walks every online state** (`src/flows/online-looks-support.ts`, the API
  answered by the test, the page's own screens reached by their URLs): a friend's link opened, the
  friend lobby (folded, its link open, said no thanks), the link lobby, a link stopped, taken and
  accepted, a server failure and offline, the lineups picked together, a live fight and its Leave
  asked, and the end with a rematch offered, asked of you, asked by you and declined. It also fails
  on an action drawn as a link: a text-link `<button>` that doesn't only go somewhere
  (`text-links-support.ts`, shared with `text-links.test.ts`), or a `<summary>` that folds buttons
  and isn't drawn as a button or a row; a `<details>` that tells more stays information on a tap.
  On the code before this it found 12 breaks at 390 × 664 (Cancel challenge and Not now 0 px from
  their edges, Also send a link as a link, Leave match as a link, Stay and Leave 8 px apart,
  Rematch and Home or No thanks 8 px apart). Not walked: a live pick (the server's clock and
  seeds are more than a fixture is worth; the pick rows are the bot series' own).
- **The fixes**: the quiet action (`.notice-quiet`: Cancel challenge, Not now) is a plain button
  of the system with its padding; "Also send a link" is a row (`.sheet-row`) with a ▾ that turns
  over while open, and what it folds (the link and Copy or Share) sits a stack gap apart in a body
  of its own; a live match's "Leave match" is a compact button (by turns its "Home" stays a link,
  it only goes home); its confirm's Leave is in the danger look and Stay and Leave sit a stack gap
  apart; `.hud-actions` (Rematch, Home, No thanks; Free play's and the bot series' too) are a
  stack gap apart.
- **Also fixed** (the walk's screenshots): a notice's buttons sit side by side only while their
  words fit one line, else each takes the whole width ("Challenge someone else" and "Choose your
  lineup" wrapped inside their buttons); "You accepted this challenge" was cut by the title's
  ellipsis at 390 px and is "Challenge accepted".

## Addendum (2026-11-26, latest): account and settings together, top right

The owner's staging check: a player couldn't tell the yellow disc before the title was her account,
and looked for it with settings. Amends decision 3 above (the avatar in the lead slot).

- **The avatar sits top right on every tab screen**, just before the tools: the avatar, then `?`
  where the screen has one, then the gear, always last (`shell.ts` places it before the row's `?`
  or gear). The lead slot keeps its place, so the title's left edge doesn't move between screens
  (`frame-anchors` unchanged).
- **Beside and on a desktop** (where the rail shows) the avatar is a pill: its disc, then the
  username ("calvino"). On a phone held upright, the disc alone. A guest or an unknown player shows
  the plain person icon alone everywhere (no name to show). The accessible name is unchanged:
  "Profile, <username>", or "Profile".
- **The lead slot of a tab screen**: on a phone held upright (no rail) it shows the game's mark,
  the ball atop the rail elsewhere; beside and on a desktop it stays empty, one tap target wide, the
  rail's mark saying BallBattle. A screen opened from a tab keeps Back there (the mark hides).
- **Play's title** is "Play" where the rail shows, like the other tabs; "BallBattle" on a phone held
  upright (one heading, the other words hidden, `railTitle`).
- **Tests**: `tab-headers.safari` (mark, title, avatar, `?`, gear on each tab at 390 × 664; Back and
  no avatar on a ball's page); `tab-avatar.{safari,wide,landscape-small}` (the avatar in the row
  just before its tools; one mark, the rail's or the row's); `frame-anchors` in every project.
- Mockups (the real screens with this header injected, Play, Balls, Friends and Profile at
  390 × 664 and 1920 × 1080) were shown to the owner before the build.

## Addendum (2026-11-27): the tab's icon leads beside and on a desktop

From the owner's look at the screenshots of the addendum above, at 1920 × 1080:

- **The lead slot is never an empty gap.** Beside and on a desktop an empty slot left the title
  about 56 px right of the content under it, reading as a missing image. A tab screen's lead slot
  there holds that tab's own icon, the rail's (`shapeIcon`, in the accent), decorative and
  `aria-hidden`; on a phone held upright the mark stays. A screen opened from a tab keeps Back (the
  icon hides with the mark). `frame-anchors` is unchanged: the slot keeps its width.
- **One name.** The screenshots showed "calvino calvino" on Balls and Friends: the throwaway
  mockup tool added its own name beside the real one; the page itself shows it once. The avatar
  tests now sign in (`tab-avatar.{safari,wide,full,landscape,landscape-small}`) and fail on a
  name shown twice in the row (or at all on a phone), and check the lead slot's icon is the rail's.
- **A person's row drops its "›" when it shows a button** (Challenge, Accept and Decline): the
  mark sat before the button, as if the button opened something. The whole row still opens the
  sheet.
- **A long title takes two lines** (amends "the title is one line"): at 375 px a name in a title
  ("Waiting for Robin_the_greatest") lost its end to the ellipsis. The title wraps to a second line
  and only a third is cut (`-webkit-line-clamp: 2`); one line keeps the row's height exactly, so
  `frame-anchors` (now checking at most two lines, and one line at the row's height) and every
  screen's first line stay put. `screen-title.safari` checks a long one shows whole.
- **Leave series' question takes the foot's whole width on a phone** (it sat half-width beside
  speed): the foot wraps while it is open (`panel-parts` checks the width at three sizes).
- **"Jo said no" is told once per page session**, a reload included: the endings told are kept as
  series ids in `sessionStorage` (`told-endings.ts`, the most recent 20), nothing personal.

## Addendum (2026-11-27): never waiting without feedback

The owner's rule after the staging walk of the one vs Friend path (ADR 0089 addendum of the same
day): no tap and no screen ever leaves a player waiting without feedback. As built:

- **Taps**: a tap that waits on the server is busy on its own button (`busyOnClick`), never a
  frozen page; "Who do you want to play?"'s one button is (it closed the sheet first, then sent,
  with a second of nothing). A button with nothing to do yet (the sheet's, nothing picked) is never
  a request, so it never looks busy.
- **Waits on another player** show the waiting indicator: the waiting screen's ball (a link) or
  the friend's pulsing disc, the lineups' "Waiting for Sam's lineup" card, and the pick card's
  three soft dots, now on every wait on the other (their pick, their arrival, a rematch you asked,
  their lineup after a rematch), not only their pick (`PickClock.waiting`).
- **Skeletons keep their place from the first frame**, unseen until 150 ms (`unseenAtFirst`,
  `[data-unseen] { visibility: hidden }`); they were `hidden` (no space) until then, so a slow read
  showed them by pushing the page down. Friends' "Waiting for you" is drawn before `/friends`
  answers, as many request-sized places as the inbox counts. All matches shows its loading row
  only while a page is read (it sat at the list's end as the scroll mark, a skeleton with no read).

### The audit: the slowed-API walk

`slow-walk-flow.ts` walks every screen a signed-in player reaches (FRAME_SCREENS: Play, Balls, the
chart, a ball, Friends, Ranks, Profile, All matches, the vs Bot setup and lineup, Free play, an
older link) cold and warm, and every online state (`ONLINE_STATES`: a friend's card, the waiting
screen for a friend and for a link and their endings, a link taken, accepted, failed and offline,
the lineups together, a live fight and Leave, the end and each rematch moment), every API call
slowed to 1.5 s. It fails when a screen's content area is empty 300 ms in, when the layout shifts
more than 0.02 after first paint where nothing fights, when a skeleton is still up with no read
under way, or when a wait on the other player has no indicator; failing (every call a 500), when
Friends, Profile or All matches, cold, show no Try again. Phone (390 x 664) and desktop (1920 x
1080), each engine; layout shifts are Chromium's only (no other engine reports them). A fight's own
motion (the arena, its tip following a ball, the round turning into the result) is the arena's
(ADR 0007, 0039) and isn't counted.

| Screen (first frame, API slowed)                                         | Before                                                                                                                                                                        | After                                                                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Play, Balls, the chart, a ball, Ranks, the setups, the lineup, Free play | Their static content (no read)                                                                                                                                                | Unchanged                                                                                          |
| Friends, cold                                                            | Friends from the inbox; requests nothing until `/friends` (1.5 s), then "Waiting for you" pushed the code card down; skeletons appeared at 150 ms and pushed too: shift 0.153 | Requests' places from the inbox's count, every skeleton's space kept from the first frame: shift 0 |
| Friends, warm                                                            | What this visit read, refreshed in place                                                                                                                                      | Unchanged                                                                                          |
| Profile, cold                                                            | Who you are; the record's skeleton appeared at 150 ms and pushed the account rows and Privacy · Terms: shift 0.155                                                            | Space kept from the first frame: shift 0                                                           |
| All matches                                                              | The record's rows; a skeleton row parked at the list's end with no read under way                                                                                             | The end is an empty mark; the loading row only while a page is read                                |
| A friend's card, a link opened cold                                      | The card's skeleton (ADR 0054)                                                                                                                                                | Unchanged                                                                                          |
| The waiting screen                                                       | Shown complete on arrival (the card read before moving)                                                                                                                       | Unchanged; one layout for a friend or a link (ADR 0089 addendum)                                   |
| The lineups together, a live fight, the end                              | Their own skeleton, then the fight                                                                                                                                            | Unchanged; every wait on the other player shows its dots                                           |
| Failing, cold: Friends, Profile, All matches                             | The failure card with Try again                                                                                                                                               | Unchanged (now tested)                                                                             |

Not walked: sign-in signed out (its own flows cover it), a by-turns series (its screen is the bot
series' own), Safari's engine (WebKit runs the walk too; its layout shifts aren't reported).
