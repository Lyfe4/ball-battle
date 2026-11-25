# Polish: one frame, nothing jumps, never in pieces (proposal)

- Status: proposal only (2026-11-25). No app code, branch or PR. Becomes ADR 0087 if approved.
- Runs alongside the social UX proposal (`proposals-social-ux/PROPOSAL.md` (kept locally), recommendations
  accepted). Its plan has no "Batches 1-4" written down anywhere in the repo or the proposal (it is
  PRs 1-11), so Part G groups those 11 PRs into batches together with this audit's PRs.
- Amends (if approved): ADR 0081 (where the rail and bar show; the avatar's place beside and on a
  desktop; requirement 2, ball names; requirement 5, the Friends order), ADR 0040 (the gear's place
  in the header), ADR 0031 (column widths, the notice card), ADR 0054 (skeletons for lists), ADR
  0067 (the panel beside a fight keeps its top).
- Everything in this folder is throwaway and untracked:

| Path                                                                                           | What                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `measure/` (kept locally)                                                                      | the Playwright scripts that took every number here (`frame.ts`, `jumps.ts`, `scrollbar.ts`, `load.ts`, `first.ts`, `screencast.ts`, `series.ts`, `states.ts`, `signed.ts`, `names.ts`, `accounts.ts`, `sheet.py` (kept locally)) |
| `data/` (kept locally)                                                                         | raw JSON per run; `frame-staging-*.md` (inventory tables), `jumps-staging-chromium.md` (what moves per walk)                                                                                                                     |
| `measurements-cls.md` (kept locally)                                                           | CLS, all shifts, landmark moves and reads for 127 loads (before)                                                                                                                                                                 |
| `shots/frame-staging/<engine>/` (kept locally)                                                 | every screen at every size, staging, 3 engines (238 shots)                                                                                                                                                                       |
| `shots/signed/` (kept locally), `shots/series/` (kept locally), `shots/states/` (kept locally) | signed-in screens (local), the series screens, failure states                                                                                                                                                                    |
| `shots/film/` (kept locally)                                                                   | raw filmstrips (100 ms) and Chromium screencasts (every painted frame)                                                                                                                                                           |
| `filmstrips/` (kept locally)                                                                   | contact sheets of the important loads                                                                                                                                                                                            |
| `mock/` (kept locally), `mockups/` (kept locally)                                              | the mockup page (`pnpm dev`, then `/proposals-polish/mock/mock.html?s=friends                                                                                                                                                    | balls | chart | profile | setup | switch[&state=loading]`) and its 20 screenshots |
| `research.md` (kept locally), `research-shots/` (kept locally)                                 | Part E, with sources                                                                                                                                                                                                             |

Where: guests and timings on **staging** (`main--battle-ball.netlify.app`); signed-in screens on
the **local stack** (`pnpm build:online`, `netlify dev --offline` on :8888, codes from Mailpit), as
the social audit did. Chromium all seven sizes; Firefox 1280, 1440, 1920 and 812 × 375; WebKit with
touch at 375, 390, 812 × 375 and 667 × 320. No switch, production, Netlify env or Supabase dashboard
was touched; staging got only guest page loads and one bogus challenge token read.

---

## The top problems (ranked by how often a player meets them)

1. **On a PC every screen has its own header position.** At 1920 × 1080 the gear sits at **nine
   different x positions** across the 17 non-fight screens (1188 to 1834), the title at eight, and
   the header's top at 64, 75, 198 or 238 px. Going Balls → Matchup chart moves the title 192 px
   left and the gear 192 px right; Friends → Profile moves the title 163 px down. On a phone the
   frame is nearly steady already (the gear moves 52 px only where a `?` is beside it).
2. **The rail comes and goes on a PC.** It shows on the four tab screens only, so a ball's page,
   Profile, sign-in and every setup re-centre the page around a different column.
3. **Friends loads in three pieces and then reorders**, signed in: the link card shows, vanishes
   (blank body, 300-800 ms locally on Slow 4G, longer on a cold function), then the lists arrive
   with the link card moved to the end (`filmstrips/friends-warm-signed-in-390-slow4g.png` (kept locally)).
4. **A first visit shifts hard**: CLS **0.50** on Balls and **0.36** on Friends at 390 × 664,
   **0.25** on Play at 1920 (good is ≤ 0.1). Causes: an empty HUD box from `index.html` that the
   first screen moves, the canvas's default 300 × 150 size, and the font swapping in ~400 ms after
   first paint (no preload).
5. **Profile is a card floating mid-screen on a desktop**, and in **Firefox (the owner's browser)
   it sits 224 px left of centre** with its Privacy · Terms links still centred under nothing.
6. **The Matchup chart is the only tab screen taller than the window at 1920**, so with classic
   scrollbars (Windows) it adds a 15 px scrollbar and shifts the whole column 7 px.
7. **The panel beside a fight re-centres each phase**: at 1920 its gear moves from y 326 (playing)
   to 281 (between rounds) to 208 (the result).
8. **Actions drawn as pink links** in 18 places, four ball names a size smaller than the rest, the
   Balls / Matchup chart tab switch drawn in the "chosen option" look, three different failure
   looks, and 16 different animation durations with no tokens.
9. **Every cold open of Friends, Profile or sign-in reads `/me` twice** (the avatar and the screen
   each ask): a wasted function call against the 125k-a-month budget (ADR 0084).

---

## Part A: one frame, nothing jumps

### What is there today (inventory)

Full tables per engine and size: `data/frame-staging-chromium.md` (kept locally) (and `-firefox`, `-webkit`
JSON). The header at 1920 × 1080 (Chromium, staging guest; x,y of the top-left corner):

| Screen                                                   | Rail   | Title                           | Back    | Gear     | ?    | Column x / width |
| -------------------------------------------------------- | ------ | ------------------------------- | ------- | -------- | ---- | ---------------- |
| Play                                                     | yes    | 1278,198 (75.6 px "BallBattle") | –       | 1834,215 | –    | panel 1278 / 600 |
| Balls                                                    | yes    | 728,75                          | –       | 1272,64  | 1324 | 728 / 640        |
| Matchup chart                                            | yes    | 536,75                          | –       | 1464,64  | 1516 | 536 / 1024       |
| A ball's page                                            | **no** | 500,75                          | 448,64  | 1376,64  | 1428 | 448 / 1024       |
| Friends                                                  | yes    | 760,75                          | –       | 1292,64  | –    | 760 / 576        |
| Ranks                                                    | yes    | 760,75                          | –       | 1292,64  | –    | 760 / 576        |
| Profile                                                  | **no** | 740,**238**                     | 688,238 | 1188,227 | –    | card 672 / 576   |
| Sign in                                                  | **no** | 724,75                          | 672,64  | 1204,64  | –    | 672 / 576        |
| Free play                                                | no     | 500,75                          | 448,64  | 1376,64  | 1428 | 448 / 1024       |
| vs Bot (rules)                                           | no     | 596,75                          | 544,64  | 1332,64  | –    | 544 / 832        |
| Your lineup                                              | no     | 500,75                          | 448,64  | 1428,64  | –    | 448 / 1024       |
| vs Friend setup, older link, challenge gone, series gone | no     | 740,**238**                     | 688,227 | 1188,227 | –    | card 672 / 576   |
| Privacy, Terms                                           | no     | 768,64 (36 px)                  | –       | –        | –    | 528 / 864        |

What a walk moves (`data/jumps-staging-chromium.md` (kept locally)), 1920 × 1080:

| Walk                  | Rail         | Title Δx,Δy   | Gear Δx,Δy  |
| --------------------- | ------------ | ------------- | ----------- |
| Play → Balls          | yes → yes    | −550, −123    | −562, −151  |
| Balls → Matchup chart | yes → yes    | −192, 0       | **+192**, 0 |
| Balls → Friends       | yes → yes    | +32, 0        | +20, 0      |
| Balls → a ball        | yes → **no** | −228, 0       | +104, 0     |
| Friends → Profile     | yes → **no** | −20, **+163** | −104, +163  |
| Friends → Sign in     | yes → no     | −36, 0        | −88, 0      |
| Play → vs Bot         | yes → no     | −682, −123    | −502, −151  |
| vs Bot → lineup       | no → no      | −96, 0        | +96, 0      |

At 390 × 664 the same walks move only the gear (52 px, when a `?` is on one side) and the Play
title (7 px). At 812 × 375 Free play and the lineup use the full width while every other screen
uses a 640 px column, so Back jumps 70 px; Balls → chart moves the title 32 px.

Firefox agrees with Chromium to the pixel except **Profile, whose card sits 224 px left** at 1280,
1440 and 1920 (`shots/frame-staging/firefox/d1920-profile.png` (kept locally)). The card is centred with
`justify-self` on a child of a block box, which Chromium honours and Firefox doesn't (inferred
from the rule and the result; not bisected):

```css
/* src/ui/notice.css, desktop */
.notice {
  justify-self: center;
  width: 100%;
  max-width: var(--sheet-narrow);
```

Sign-in already escapes the card (`.stage[data-screen='signin'] .notice { margin-top: 0; … }`);
Profile, which ADR 0081 says "takes the signed-in half of the account screen", never got the same
rule, so it floats 14 dvh down in a card while sign-in starts at the top.

The gear moves on a phone because the header appends the gear before the `?`:

```ts
// src/ui/screen-header.ts
header.append(back, heading);
if (options.settings !== false) header.append(createSettingsToggle());
if (options.legend === true) {
  const legend = createSymbolLegend();
  header.append(legend.toggle, legend.panel);
}
```

Scrollbars: headless Chromium hides them, so I re-ran with them on (`scrollbar.ts`): the chart
(1170 px tall at 1280 × 800) adds a 15 px scrollbar and its column moves 7 px; Friends signed in
is **807 px tall at 1280 × 800**, so a 7 px overflow switches a scrollbar on and off as rows come
and go. Firefox headless draws overlay scrollbars whatever the prefs, so the owner's Firefox case
is inferred from Chromium's (Firefox on Windows draws a classic 17 px bar when "always show
scrollbars" is on).

Cards and spacing in the inventory: tab cards use `--radius-large` (20 px) and 12 px padding;
notices use `--radius` (14 px) and 12/16 px; the stats boxes are sunken cards in a card; Friends'
"Waiting for you" is ringed by an inset shadow. The title is 22 px everywhere but Play (36 px on a
phone, 56 px at 1280, 75.6 px at 1920) and the legal pages (36 px, a different header altogether).

### The frame (proposed)

One page frame for every screen where nothing fights:

```
 rail (beside, desktop)  │  frame (max 90rem, centred in what the rail leaves)
                         │  ┌───────────────────────────────────────────────┐
                         │  │ [lead 44] Title …                  [?] [gear] │  ← header row, 44 px, at --frame-top
                         │  ├───────────────────────────────────────────────┤
                         │  │ content: 1 column (phone), 2 (beside), the    │
                         │  │ screen's own columns (desktop), from the       │
                         │  │ frame's left edge                              │
```

- **Tokens** (`tokens.css`): `--frame-gutter` 16 px (phone, beside) / 32 px (desktop);
  `--frame-top` `max(16px, safe-area-top)` / 32 px; `--frame-max` 90rem; `--head-height` 44 px
  (the tap target); `--col-aside` 26rem; `--rail-room` 0 / the rail's width, set by the query.
- **Header row** (one component, today's `createScreenHeader` grown up): a **lead slot** always
  44 px wide (the avatar on a tab screen, Back elsewhere), the title (22 px, one line, ellipsis),
  then the tools: `?` where the screen has symbols, then **the gear, always last**, so it never
  moves. The title's left edge is therefore the same on every screen at a size.
- **The avatar sits in the lead slot on every size** (today: in the header on a phone, atop the rail
  beside and on a desktop). The rail's top gets the game's mark instead (a ball and the word on a
  desktop), as Spotify, Discord and Duolingo put their logo there. Without this, a tab screen's
  title starts 52 px left of a sub-screen's on a PC. Builds without accounts keep the slot empty
  (44 px), so their titles sit where everyone else's do.
- **Screen kinds and the shell** (`tabOf` becomes `shellOf(screen)`, tested as a table):

| Kind   | Screens                                                                                                                  | Phone upright                  | Beside and desktop                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ---------------------------------- |
| tab    | Play, Balls (and its chart), Friends, Ranks                                                                              | bar                            | rail, its tab lit                  |
| browse | a ball's page, Profile, Sent / Blocked lists (social PR 5)                                                               | **bar** (the opener's tab lit) | **rail**                           |
| task   | setups (vs Bot, vs Friend, Free play), sign-in, the challenge card, lobby, notices (older link, gone), privacy and terms | no bar                         | **rail**                           |
| fight  | a lineup pick, coin toss, match, series rounds, between rounds and the end, live rooms, a start's lineup                 | no bar                         | no rail (ADR 0039, 0067 unchanged) |

So on a PC the rail leaves only when the arena takes over, a deliberate change of mode (as every
game hides its menu for a battle); on a phone the bar steps aside for a task that needs the
room or the keyboard. Back works as today (ADR 0025, 0081): a browse or task screen keeps its
Back.

_Why keep the rail on PC sub-screens._ Apple's HIG: keep the tab bar visible on sub-screens,
"If you hide the tab bar, people can forget which area of the app they're in"; its design Q&A
answers "Nope" to hiding it on sub-pages. Spotify's web player kept its 280 px sidebar when an
artist page opened (screenshot), GitHub keeps its header on every page; the exceptions are
immersive views (YouTube's watch page, a Duolingo lesson, every game's battle), which is our
"fight" row. Clash Royale, Marvel Snap and Pokémon TCG Pocket keep their bar under detail
pop-ups and hide it for battles (game rows partly unverified, see `research.md` (kept locally)). Against: the
rail costs 176 px of a 1280 px screen on a setup; at 1280 the setup's two columns still get
1040 px, more than ADR 0031's 64rem.

- **Columns by kind of content**, from the frame's left edge (never a phone column centred,
  ADR 0031):

| Name    | Phone    | Beside          | Desktop                                                               | Screens                                 |
| ------- | -------- | --------------- | --------------------------------------------------------------------- | --------------------------------------- |
| list    | 1 column | 2 columns       | main `1fr` + aside `--col-aside`; people tile in `minmax(20rem, 1fr)` | Friends, Profile, Ranks                 |
| grid    | 4 tiles  | auto-fill       | auto-fill `minmax(6rem, 1fr)` across the frame                        | Balls (and the chart in the same width) |
| wide    | 1 column | 2 columns       | the screen's own columns (ADR 0031's table)                           | a ball's page, setups, Free play        |
| reading | 1 column | 1 column, 40rem | prose 40rem + an aside (what it unlocks, links)                       | sign-in, notices, privacy and terms     |

A wide screen uses its width with columns, and only a reading line is capped (~840 px is
GitHub's README; 40rem here). The legal pages move into the frame (header row, Back) instead
of their own 36 px header.

- **Play** keeps its court and panel, under the same header row: on a phone as today; on a
  desktop the header row (avatar, BallBattle, gear) runs across the frame's top and the court and
  panel sit under it, panel top to court top (the 75 px hero title goes; the court is the hero).
  Cost: the court at 1280 × 800 is 592 px instead of 644 (a 22rem panel gets it back to 656).
  Beside, the court keeps full height (ADR 0067), so Play's header stays atop its panel there; its
  gear still sits at the frame's right edge.
- **The panel beside a fight keeps its top** (aligned to the court's top) instead of centring, so
  playing → between rounds → the result never moves its gear (today 326 → 281 → 208 px at 1920).
- **Scrollbars**: `scrollbar-gutter: stable` on the root, in `(min-aspect-ratio: 5/4) and
(pointer: fine)`. Overlay scrollbars (phones, macOS default) reserve nothing; classic ones
  never shift the page when a screen grows. Baseline since December 2024 (MDN, `research.md` (kept locally)).
- **One card style** (`--radius-large`, `--space-gap` padding, a 1.05 rem heading), no card in a
  card (sunken boxes inside a card only for an input or a code), and "Waiting for you"'s ring is
  the one emphasis a card may wear.

The mockup's anchors, measured the same way as today's (`mock/shoot.ts` (kept locally)): lead, title and gear at
the **same pixel on all six screens** at each size: 390 × 664 lead 16,16, title 72, gear 330;
812 × 375 lead 92,16, title 148, gear 737; 1920 × 1080 lead 321,32, title 377, gear 1717.

### The test that holds it

`src/flows/frame-anchors-flow.ts`, run by a `frame-anchors.*.browser.test.ts` in every browser
project (wide, full, touch, iphone, safari, landscape, landscape-small): it opens every non-fight
screen in turn (the tab screens, a ball, the chart, Profile, sign-in, each setup, Free play, the
older-link notice, privacy) and reads the header's boxes. It fails when, at the same size:

- the lead slot's, the title's or the gear's box differs between any two screens by more than
  0.5 px, or the header's top differs;
- the content's left edge is not the title row's left edge (the lead slot's);
- the rail (or bar) shows where `shellOf` says it doesn't, or the reverse;
- the page's width changes between two screens (a scrollbar appearing).

It fails today in the `full` and `wide` projects on every count, and in `touch` on the gear
(52 px). A `look-checks.ts` rule also fails on a `.screen-header` that appends the gear before a
`?`.

---

## Part B: loading, never in pieces

### Measured (before)

All 127 loads: `measurements-cls.md` (kept locally). Filmstrips: `filmstrips/` (kept locally). CLS is Chromium's
PerformanceObserver; "all shifts" adds the ones within 500 ms of a tap (CLS ignores them, a player
doesn't); Firefox and WebKit have no layout-shift entries, so their rows count landmark moves
(a script records every heading and card's box each frame).

| Load                  | Where                          | CLS           | What a player sees                                                                                                                                                                |
| --------------------- | ------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Balls, first visit    | staging, 390 × 664, Slow 4G    | **0.499**     | 1.26 s blank, then the grid in the fallback font, then the font swaps at 1.63 s and every name re-flows (`filmstrips/balls-first-visit-390-slow4g-screencast.png` (kept locally)) |
| Friends, first visit  | staging, 390                   | **0.364**     | same, plus the cards' heights change on the swap                                                                                                                                  |
| Play, first visit     | staging, 1920                  | **0.253**     | the court jumps 68 px left and the canvas grows from 300 × 150                                                                                                                    |
| Friends, first visit  | staging, 1920                  | 0.090         | the HUD box from `index.html` moves 470 px when the screen mounts                                                                                                                 |
| Ranks, reload         | local, 390                     | 0.352         | (local `netlify dev` sends no cache headers, so the font reloads each time: the first-visit case again)                                                                           |
| Friends, warm (tab)   | local, 390, signed in, Slow 4G | 0 (CLS)       | link card (80 ms) → **blank** body (~380 ms) → all lists, link card now last                                                                                                      |
| Friends, cold         | local, 390, signed in          | 0.186         | `/me` twice, then `/friends`; same three pieces                                                                                                                                   |
| Profile, cold         | local, 390, signed in          | 0.186         | skeleton card, then the profile card (no shift in the card; the shift is the boot box)                                                                                            |
| Play → Balls, warm    | local, 1920                    | 0 (0.174 all) | the whole frame moves (Part A)                                                                                                                                                    |
| Balls → chart, warm   | local, 1920                    | 0 (0.050 all) | the column widens, title and tools move                                                                                                                                           |
| Every guest tab, warm | staging, 390                   | 0             | fine: nothing waits on the server                                                                                                                                                 |

Fonts: one variable woff2 from `@fontsource-variable/bricolage-grotesque`, `font-display: swap`,
discovered only once the CSS is parsed: it lands at 1.61 s on Slow 4G against a first paint at
1.26 s. Playwright's own screenshots wait for fonts, which is why the 100 ms filmstrips looked
clean; the screencast ones (every painted frame) show the swap.

Reads each screen waits on (local, signed in; `api` column of the data): every page reads `/me`,
`/me/poke` and `/me/inbox` on start; Play adds `/me/match`; Friends adds `/friends` _after_ `/me`;
**Friends, Profile and sign-in read `/me` twice on a cold load** (the avatar's `createAvatars` and
the screen's own `whoAmI`, at the same millisecond). Warm moves read `/me` once more and then
`/friends` (Friends), or nothing (Balls, Ranks).

Why Friends comes in pieces, from the code:

```ts
// src/screens/friends-tab.ts
// The link card at once: it never waits on the server.
body.replaceChildren(link);
const who = await whoAmI(host.storage, host.cookies(), () => api<PlayerResponse>('GET', 'me'));
if (who.kind === 'account') {
  body.replaceChildren(friends.element);   // the link card goes: the body is empty
  await friends.open();                    // ... until /friends answers; then the link card is placed last
```

Failure and slow states (`filmstrips/states-p390.png` (kept locally)): offline, Friends says "We couldn't reach
the server to see who you are" (the rule is "You're offline" when the device is offline); a 500 on
`/friends` is a line and a pink "Try again ›" link above the link card, which moved; a 500 on `/me`
is a card with a Try again _button_; Profile offline is a third look. A 4 s `/friends` shows the
link card alone with nothing saying more is coming.

### Rules (proposed; for CLAUDE.md under UI)

1. **Static first.** Everything that needs no data renders in the first frame, in its final place
   (the header, the link card, Add's field, Ranks' cards, a setup).
2. **Sized skeletons.** A section that waits shows the one skeleton look (`skeleton.ts`) the size
   of what comes: row skeletons, as many as known (the inbox already says how many friends and
   requests), a code block the code's width; never a bare spinner, never an empty body.
3. **No reorder after a read.** Sections have one order per state that never depends on what a
   read returns. ADR 0081's "with no friends, the link card comes first" goes: the Friends section
   always sits in its place, and with no friends it is an empty state whose action is "Play anyone
   with a link" (the link card stays where it always is). A row added later (a new request) slides
   in at its place; nothing above it moves except by that row's height, animated.
4. **One calm reveal.** Data replaces its skeleton with one fade (`--motion-base`), per section,
   never a pop; under 150 ms from the screen showing, no skeleton at all (NN/g: nothing under 1 s;
   we use 150 ms so a fast read never flashes one).
5. **What was read this visit shows at once on return** and refreshes in place: the Friends lists,
   Profile's `/me`, Ranks. In memory only (a module map cleared on reload, sign-out and Forget me):
   nothing new on the device, so `privacy.html` doesn't change. Keeping it on the device across
   visits would be a privacy change (names of friends at rest) and is **not** proposed.
6. **One read per answer.** A screen never asks for what the page already asked: the shell's `/me`
   is one in-flight promise shared by the avatar and the screen; Friends draws its rows from the
   inbox answer the page already read (`friends` with status, `invites`, `turns`, the request
   count) and asks `/friends` only for what the inbox lacks (the code, request names, sent,
   blocked). **No new function call anywhere**; this removes one per cold open of Friends, Profile
   or sign-in.
7. **Failure is a designed state**: one failure card (title, the game's words from
   `online-failure-text.ts`, a Try again _button_) in the failed section's place; offline says
   "You're offline"; the rest of the screen stays.
8. **The first paint is the real frame**: the font is preloaded (`<link rel="preload" as="font"
crossorigin>`, one file), the stage stays hidden until the router has laid out its first screen
   (one frame, not a loading page), and the canvas has its CSS size before its first draw.

### Every screen and its fix

| Screen                            | Today                                                                   | Fix                                                                                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any first visit                   | CLS 0.09-0.50: boot box, canvas, font swap                              | rule 8 (preload, hidden until laid out, canvas sized)                                                                                                             |
| Play                              | court and canvas jump on load; `/me/match` decides "Back to your match" | rule 8; the box and Play render at once (they do); "Back to your match" takes Play's place with no height change                                                  |
| Balls, chart, a ball              | no data; first visit swaps the font                                     | rule 8 only                                                                                                                                                       |
| Friends (account)                 | three pieces, link card moves                                           | rules 1-6: header, Add field, link card static; rows from the inbox at once; skeleton rows for requests and the code; `/friends` fills in place; cached on return |
| Friends (guest, accounts off)     | fine (no read for a guest without a hint)                               | rule 8                                                                                                                                                            |
| Ranks                             | static; fine                                                            | rule 8                                                                                                                                                            |
| Profile                           | skeleton card, then a floating card                                     | rules 5, 6 (the shell's `/me`, often already answered); renders in the frame at once when `/me` is known                                                          |
| Sign-in                           | skeleton then card (`/auth/options`, 300 ms)                            | the email step needs no data: render it at once; Google's button fills its reserved slot                                                                          |
| Setups, Free play, lineup (bot)   | no reads                                                                | rule 8                                                                                                                                                            |
| vs Friend send, lobby             | busy button then lobby (ADR 0054)                                       | unchanged; the lobby's card reserves its link row                                                                                                                 |
| Challenge card (link opened cold) | card skeleton (ADR 0054)                                                | unchanged, sized to the card it becomes                                                                                                                           |
| Online series (cold)              | series skeleton (ADR 0054)                                              | unchanged                                                                                                                                                         |
| Start lineup (cold)               | – (not measured: needs a live start)                                    | the lineup's skeleton (tray and grid), as the series'                                                                                                             |
| Failures (all online screens)     | three looks, offline mis-worded                                         | rule 7                                                                                                                                                            |

---

## Part C: motion and feel

### Today

From the stylesheets (`grep transition|animation`): 16 different durations (80, 120, 150, 160,
180, 250, 260, 300, 320, 360, 400, 450, 480, 560, 600, 650, 900 ms), six easings, every one a
literal. Screens change instantly (sections toggle `hidden`); tab switches are instant; the What to
play sheet, the floating card and the update notice appear without motion; the settings menu fades
in over 120 ms; the leave confirm over 160 ms; the dim beside the result over 400 ms. Focus moves
to the new screen's heading (correct, ADR 0025). The only "flash" is the Friends body emptying.
The arena's own moments (Winner sticker 480/650 ms springs, the 3-2-1, the coin toss) are energy
by design (ADR 0032) and stay.

### Proposed tokens (`tokens.css`)

| Token                | Value                        | Source                                                                          |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| `--motion-quick`     | 120 ms                       | M3 short3/4 band (150-200 ms) shortened for desktop (M2: 150-200 ms on desktop) |
| `--motion-base`      | 200 ms                       | M3 short4                                                                       |
| `--motion-slow`      | 320 ms                       | M3 medium2 (300 ms)                                                             |
| `--ease-out` (enter) | `cubic-bezier(0.2, 0, 0, 1)` | M3 standard                                                                     |
| `--ease-in` (leave)  | `cubic-bezier(0.3, 0, 1, 1)` | M3 standard accelerate                                                          |

Where each is used:

| Moment                                     | Motion                                                                                              | Reduced motion    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------- |
| Tab change                                 | none, or a 120 ms cross-fade of the content only (the rail and header never animate)                | none              |
| Screen opened from a tab (browse) and Back | 200 ms: content fades in and rises 8 px; Back: 120 ms fade                                          | fade only, 120 ms |
| Into a task or a fight                     | none (the arena's own intro, ADR 0007, does the work)                                               | none              |
| Sheet (What to play, the friend sheet)     | enter 200 ms rise from the bottom (phone) / fade and scale 0.98 → 1 (beside, desktop); leave 120 ms | fade 120 ms       |
| Banner (social PR 8)                       | enter 200 ms slide; fold into the badge 320 ms; the badge pulses once                               | fade              |
| List row in / out                          | height and opacity 200 ms; rows below move by `transform`                                           | instant           |
| Skeleton → content                         | 200 ms cross-fade per section                                                                       | instant           |
| Settings menu, ? legend                    | 120 ms (as today)                                                                                   | none              |

Platform screens stay calm (ADR 0032): no bounce, no overshoot outside the arena; nothing moves
sideways (tabs aren't swipeable here, and Material's "fade through" exists to avoid implying they
are). Implementation: CSS on the swapped section, and `document.startViewTransition` where the
browser has it (Chrome 111, Safari 18, Firefox 144; ~93 % of users, `research.md` (kept locally)) for the browse
move, with the rail and header given `view-transition-name`s so they stay put. A test reads every
stylesheet and fails on a duration or easing literal outside `tokens.css` and the arena's files
(`arena-tips.css`, `ready-card.css`, `winner-sticker.css`, `coin-toss.css`, `pick-clock.css`),
in the style of `press.test.ts`.

---

## Part D: visual consistency

### Ball names (ADR 0081 requirement 2)

`names.ts` measured every name in the real font. A tile's room at 375 px is 76 px (80 at 390):

| Name size                              | Necromancer | Boomerang          | Others |
| -------------------------------------- | ----------- | ------------------ | ------ |
| 14 px / 600 (today's normal)           | 93 px: over | 79 px: over at 375 | fit    |
| 12 px / 600, −0.03 em (today's "long") | 76          | 64                 | fit    |

Today the four names over nine letters take the small size (`data-long`), so Speedster, Berserker,
Necromancer and Boomerang read smaller than their neighbours. **Proposed: one size for every name**,
12 px (`--font-size-tiny`) at weight 700, −0.02 em, and the tile's side padding 2 → 0 px (room 80 px
at 375): Necromancer is 77 px, every name fits on one line at 320 px and up, and the `data-long`
rule goes. Mockup: `mockups/F3-balls-p390.png` (kept locally). The test becomes: every tile's name has the same
computed `font-size` and `scrollWidth ≤ clientWidth`, at 320, 375 and 390. (Alternative: 14 px
with a soft hyphen in "Necro-mancer" and a two-line name slot; more height, one odd break.) The
same rule for the lineup tray's names and the pick rows.

### Controls by kind

| Kind                                    | Component                       | Look                                                |
| --------------------------------------- | ------------------------------- | --------------------------------------------------- |
| Primary action (one per screen or card) | `hud-button hud-button-primary` | yellow, slab                                        |
| Other action                            | `hud-button`                    | raised, slab                                        |
| Row action (in a sheet or card list)    | a sheet row (social PR 4)       | raised row, chevron only if it opens something      |
| Destructive                             | danger row / button             | red words on `--color-band-edged`, apart, confirmed |
| Navigation in text                      | `text-link` with its "›"        | pink, only for going somewhere                      |
| One-of-several choice                   | `segmented` / `.choice`         | the chosen look (ring and check sticker)            |
| Switching views of one screen           | **tabs** (new, `frame-switch`)  | one underline in the primary's yellow, no sticker   |
| On/off                                  | the settings switch             | as today                                            |

Places that break it (actions drawn as `text-link`, from `grep "element('button', 'text-link"`):
`home.ts:141` New series; `notice.ts:26` Copy; `notice.ts:188,197` notice "quiet" actions (Log out,
Delete account on Profile); `online/forget-me.ts:31` Forget me; `online/friends-more.ts:22` (Close,
Report, Block: social PR 5 deletes it); `online/friends-section.ts:73` Remove, More; `online/waiting-rows.ts:24`
Decline, No thanks, More; `ready-card.ts:49` "Don't show these again"; `series/leave-confirm.ts:26`
Leave series / Home (a real link in its Home form: keep); `settings-menu.ts:113` Show all tips
again; `settings-menu.ts:136` and `symbol-legend.ts:57` Close (social PR 3 makes them ×);
`skeleton.ts:46` Home (a link: keep); the Friends "Try again ›" on a list failure. `home.ts:90` (the
status strip) goes with social PR 7; `home.ts:102` (the Play box) is a button styled as a box: keep,
minus the chevron glyph the social audit found clipped.

Switch: the Balls / Matchup chart control is `createSegmented` (`manual.ts:53`), so it wears the
chosen-option ring and check sticker meant for picking a value; it becomes tabs
(`role="tablist"`, `aria-selected`), `mockups/F7-switch-p390.png` (kept locally). Profile: "Change username" is
the screen's yellow primary, which it isn't; it becomes a row, with Log out a row and Delete
account in the danger zone (`mockups/F5-profile-*` (kept locally)).

### Cards, headings, empty and coming-soon states

- One card style (Part A); headings: page title 1.375 rem, card title 1.05 rem, nothing between.
- **Profile's stats** show "—" three times under "Coming soon" for every player: drop the card
  until it has one real number (the server already records online wins, ADR 0081); Ranks keeps its
  coming-soon cards, which are the page's subject.
- Empty states: one look (a line and one action) for "no friends", "nothing waiting" (the section
  hides rather than says so), "no one blocked".
- Icons: our own shapes (`icons.ts`) everywhere; the Play box's robot emoji in the social mockup is
  a placeholder only.
- The rail: the current tab's yellow pill and surface background, as today; a browse screen keeps
  its opener's tab lit; the mark at its top (Part A).
- The avatar: one size (44 px) in the lead slot everywhere; the large disc (72 px) on Profile only.

---

## Part E: research (summary; sources and screenshots in `research.md` (kept locally))

- **Persistent navigation on sub-screens**: Apple's HIG keeps the tab bar on pushed screens and
  allows covering it only for a modal (verified, quoted). Spotify web (sidebar kept on an artist
  page, screenshot), GitHub (header on every page) keep their shell; YouTube's watch page drops its
  guide (immersive). Tab-bar games keep the bar under details and hide it for battles (partly
  unverified); hub games (Hearthstone, Brawl Stars) never had one (unverified).
- **Transitions**: Material uses a 300 ms "fade through" for tab switches (no sideways slide) and a
  "shared axis" slide for going deeper; desktop durations 150-200 ms; Fluent asks for "a quick fade"
  between top-level pages; Spotify and GitHub swap content with no transition (verified).
- **Loading**: NN/g: nothing under 1 s, a skeleton for a whole page at 2-10 s, a spinner for one
  module; avoid frame-only skeletons. YouTube shows a full skeleton (screenshot).
- **Width**: GitHub centres a 1280 px container with a 1012 px main column and an 838 px README;
  Spotify and YouTube let grids fill the width (verified by measurement).
- **Numbers**: M3 durations and easings, CLS ≤ 0.1 good, `font-display` and preload advice,
  `scrollbar-gutter` Baseline 2024, View Transitions in Chrome 111, Safari 18, Firefox 144.
- Not reached: Discord and Duolingo need sign-in; game help centres and wikis refused automated
  reads (game8 403); those rows are marked UNVERIFIED.

---

## Part F: mockups (real styles)

`pnpm dev`, then `/proposals-polish/mock/mock.html?s=…`; the game's `src/style.css`, its real tab
bar, ball grid, matchup chart, segmented control and settings gear; only the frame and rows are
mock CSS (`mock/mock.css` (kept locally), proposed tokens at its top). Screenshots in `mockups/` (kept locally):

| Shot                                                                                            | 390 × 664 | 812 × 375 | 1280 × 800 | 1920 × 1080 |
| ----------------------------------------------------------------------------------------------- | --------- | --------- | ---------- | ----------- |
| F1 Friends, loaded (the social design's rows in the frame; desktop: main + aside, people tiled) | ✓         | ✓         | ✓          | ✓           |
| F2 Friends, loading (static parts real; sized skeleton rows; nothing moves when they fill)      | ✓         | ✓         |            | ✓           |
| F3 Balls grid (one name size; the tab switch)                                                   | ✓         | ✓         |            | ✓           |
| F4 Matchup chart (same frame and width as the grid: nothing moves on the switch)                | ✓         | ✓         |            | ✓           |
| F5 Profile (browse: bar and rail stay; identity + account; no stats; danger zone)               | ✓         | ✓         |            | ✓           |
| F6 vs Bot setup (task: no bar on a phone, the rail beside and on a desktop)                     | ✓         | ✓         |            | ✓           |
| F7 the switch, today vs proposed                                                                | ✓         |           |            |             |

---

## Part G: one merged build plan

Four batches, one staging build each (merge a batch's PRs close together; docs-only and test-only
PRs skip Netlify builds, `netlify-ignore.sh`). Batch 1 is small enough for before 1 December.
"S n" is social PR n; "P n" is this audit's. Every PR: its tests, `pnpm test:browsers` in the
projects its screens touch, greps `*.online.test.ts` before renaming words, and shows the named
screenshots at **390 × 664, 812 × 375 and 1920 × 1080**.

### Batch 1: the rules and the first paint

| #   | PR                                                                                                                                                               | Tests                                                                                                                     | Shots                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | **Docs**: ADR 0086 (social) and ADR 0087 (this: frame, loading, motion, consistency), ADR amendments listed, the UI quality bar below in CLAUDE.md (S 1 + P)     | –                                                                                                                         | –                                                    |
| 2   | **Tokens**: frame and motion tokens in `tokens.css`; `scrollbar-gutter`; the motion-literal stylesheet test (allow-list today's literals, shrinking it PR by PR) | `motion-tokens.test.ts`, `layout-queries.test.ts`                                                                         | none (no visual change but the gutter)               |
| 3   | **First paint**: preload the font, stage hidden until the first layout, canvas sized before its first draw                                                       | new `first-paint.*.browser.test.ts`: a first visit's layout shifts sum ≤ 0.02 (Chromium projects) on Play, Balls, Friends | a first visit's screencast frame at 1.3 s on Slow 4G |
| 4   | **Focus for the keyboard only** (S 2)                                                                                                                            | as S 2                                                                                                                    | as S 2                                               |
| 5   | **One close per overlay** (S 3); the × last in each sheet's head                                                                                                 | as S 3                                                                                                                    | sheet, settings, legend                              |

### Batch 2: the frame

| #   | PR                                                                                                                                                                                                                                   | Tests                                                                                                    | Shots                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 6   | **The header row**: lead slot, title, `?`, gear last, on every non-fight screen; the avatar in the lead slot everywhere, the mark atop the rail (amends ADR 0040, 0081)                                                              | `frame-anchors.*.browser.test.ts` (header part), `tab-headers`, `settings-one-look`, `tab-avatar.*`      | Friends, Balls, a ball, Profile, a setup                         |
| 7   | **The shell rule** (`shellOf`: tab, browse, task, fight): rail on every non-fight screen beside and on a desktop; bar on tab and browse screens on a phone (amends ADR 0081)                                                         | `tabs.test.ts` table, `phone-arena-flow` (no bar in a fight), `tab-rail.landscape-small`, `no-dead-end`  | a ball and Profile with the rail; a setup on a phone with no bar |
| 8   | **Columns**: list, grid, wide, reading; Profile and the notices stop floating (fixes Firefox's off-centre card); legal pages in the frame; Balls and chart one width; the panel beside a fight keeps its top (amends ADR 0031, 0067) | `frame-anchors` (column, width), `desktop-layout.wide`, `beside-tops.landscape`, `series-result.wide`    | Friends, Balls, chart, Profile, a setup, between rounds          |
| 9   | **Play under the header row** (desktop); hero title goes                                                                                                                                                                             | `home-play.*`, `beside-walk`, requirement 4                                                              | Play                                                             |
| 10  | **Tabs and names**: the Balls / chart switch as tabs; every ball name one size (ADR 0081 req. 2 amended)                                                                                                                             | `ball-grid` names test at 320/375/390, `one-of-each`, `choice.test.ts` (tabs never wear the chosen look) | Balls, chart                                                     |
| 11  | **The sheet as a component** (S 4), entering and leaving on the motion tokens                                                                                                                                                        | as S 4                                                                                                   | What to play                                                     |

### Batch 3: loading and the Friends tab

| #   | PR                                                                                                                                                                                                                           | Tests                                                                                                                                                | Shots                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 12  | **One `/me`**: the shell's answer shared (one in-flight promise), Profile and Friends take it; the in-memory visit cache for Friends, Profile and Ranks; cleared on sign-out and Forget me                                   | `who-am-i.test.ts` (one call for two askers), `visit-cache.test.ts`, the online `friends` flow counts one `/me`                                      | –                            |
| 13  | **Friends in place** (rules 1-7): static first, rows from the inbox, sized skeletons, fixed order with the empty state (amends ADR 0081 req. 5), one reveal, one failure card                                                | `friends-section.browser.test.ts` (no landmark moves after first frame; order with and without friends; failure card), `inbox-watch.browser.test.ts` | F2 then F1, the failure card |
| 14  | **Friend rows and the friend sheet** (S 5), on P 13's sections                                                                                                                                                               | as S 5                                                                                                                                               | as S 5                       |
| 15  | **Take turns from the sheet** (S 6)                                                                                                                                                                                          | as S 6                                                                                                                                               | –                            |
| 16  | **Profile and the controls**: Profile's rows and danger zone, stats card dropped; the remaining `text-link` actions become buttons or rows; the failure card on Profile, sign-in and the challenge screens (offline says so) | `look-checks.ts` (no `text-link` without navigation), `profile.browser.test.ts`, `online-failures`                                                   | Profile, settings, a notice  |

### Batch 4: signals and motion

| #     | PR                                                                                                                                                                                                                                    | Tests                                                                                                                                             | Shots                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 17    | **Play loses the strip** (S 7)                                                                                                                                                                                                        | as S 7                                                                                                                                            | Play                   |
| 18    | **One incoming banner** (S 8) on the motion tokens                                                                                                                                                                                    | as S 8                                                                                                                                            | as S 8                 |
| 19    | **Screen motion**: browse forward and Back, tab cross-fade, skeleton reveal, list rows, all on tokens; View Transitions where present; reduced motion fades or nothing; the motion-literal allow-list empty outside the arena's files | `motion-tokens.test.ts` (allow-list empty), a `reduced-motion` browser test (no transform animations), `frame-anchors` still green mid-transition | a frame mid-transition |
| 20-22 | **S 9, S 10, S 11** (crossed challenge on the server, the friend lobby, by turns' Your games); unchanged by this audit except they use the frame and tokens                                                                           | as S 9-11                                                                                                                                         | as S 9-11              |

Social PRs that change because of this audit:

- **S 1** gains this ADR and the extra quality-bar lines.
- **S 3**: a sheet's × sits last in the sheet's own head (the same 44 px geometry as the page
  header); the page header keeps the gear last. Settings' and the legend's Close become the ×, as
  S 3 says.
- **S 4** (sheet): its enter/leave on `--motion-base` / `--motion-quick` and `--ease-out` /
  `--ease-in`, its head in the frame header's geometry (44 px, title, × last).
- **S 5** (rows and sheet): builds on P 13's fixed sections and skeleton rows; its rows are the
  `list` column's people tiles on a desktop; Report/Block danger look is Part D's destructive kind.
- **S 7**: "N online" goes in the Friends section's title, which P 13 already reserves (no reorder).
- **S 8** (banner): slides on the motion tokens; on a desktop it sits in the frame's bottom right,
  never over the rail.
- **S 11** ("Your games", "ended" rows): sections in P 13's fixed order, with skeletons sized from
  the inbox.

### The UI quality bar (additions to the social proposal's)

- **One frame**: every non-fight screen uses the page frame; Back or the avatar, the title, `?` and
  the gear sit where they sit on every other screen at that size (`frame-anchors`).
- **Nothing jumps**: no screen change or load moves the header or the content's left edge; no
  scrollbar shifts a page; a first visit's layout shifts stay ≤ 0.02 (Chromium).
- **Static content first**: what needs no data is in the first frame, in its final place.
- **Skeletons sized to content**, one look, only after 150 ms; never an empty body.
- **Sections never reorder after a read**; an empty state takes the section's place.
- **Motion tokens only** outside the arena; reduced motion fades or doesn't move.
- **One read per answer**: a screen reuses what the page already read; no new function call
  without a line in the PR saying why it fits ADR 0084's budget.

---

## Decisions for the owner

1. **The rail on PC and beside**: on every screen but a fight (recommended), or on tab and browse
   screens only (setups lose it, and their titles move 88 px at 1920).
2. **The phone's bar on browse screens** (a ball's page, Profile): keep it (recommended, Apple's
   rule) or tab screens only, as today.
3. **The avatar in the header's lead slot on PC too**, the rail topped by the game's mark
   (recommended), or keep it on the rail and accept a 52 px title shift between tab screens and
   sub-screens.
4. **The gear always last** (`?` before it): amends ADR 0040's "before any ?" (recommended).
5. **Frame width**: 90rem with each screen's own columns (recommended), or a narrower 72rem cap
   (less empty space to design for, but Play's court shrinks to 704 px at 1920).
6. **Ball names**: one 12 px size for all (recommended) or 14 px with Necromancer wrapping.
7. **Profile's stats card**: drop it until a real number exists (recommended) or keep "Coming soon"
   once as a line.
8. **Screen motion**: View Transitions where the browser has them, CSS otherwise (recommended), or
   CSS only.
9. **The font**: preload and keep `swap` (recommended), or `font-display: optional` (no swap ever,
   but a first visit on a slow phone may show the system font for the whole visit).
10. **Play on a desktop**: the header row across the top (recommended; the court is 592 px instead
    of 644 at 1280 × 800 unless the panel narrows to 22rem) or keep the panel's own hero title.
11. **The visit cache**: memory only (recommended, no privacy change), or on the device across
    visits (needs a `privacy.html` change: friends' names at rest).

## What I couldn't measure, and why

- **Signed-in screens on staging**: email codes for staging accounts can't be received here (as in
  the social audit); signed-in loads are local, where functions are warm and `netlify dev` sends no
  cache headers (so "cold" there is closer to a first visit). Staging's cold-function delays (the
  owner's "a few seconds") are not in my numbers; local Slow 4G shows the same three pieces, shorter.
- **WebKit signed in**: WebKit never sends a `Secure` cookie over `http://localhost`, so WebKit pages
  on the local stack were guests (no reads). WebKit guest frames on staging are measured.
- **Firefox and WebKit CLS**: neither engine reports layout-shift entries; their loads are covered
  by the landmark-move recorder instead (0-7 moves per load).
- **Firefox with classic scrollbars**: headless Firefox drew overlay scrollbars regardless of prefs;
  the scrollbar shift is measured in Chromium with its scrollbars shown.
- **The font swap in Firefox**: Playwright's screenshots wait for fonts and Firefox has no
  screencast in Playwright; the swap is filmed in Chromium only.
- **Start lineup, live rooms, lobby loads**: need a live start between two accounts; covered by ADR
  0054's skeletons, not re-measured.
- **Game UI details** (Hearthstone, Brawl Stars, Runeterra, Discord, Duolingo): from memory or search
  snippets, marked UNVERIFIED in `research.md` (kept locally).
- **Friends with no friends, warm**: a shell quoting slip ran only the cold load for the account with no friends (CLS 0.186, the same boot shift); the link-card-first reorder for that case is from the code (`friends-section.ts` places the link card first while there are no friends) and the signed-in screenshots (`shots/signed/*-c-friends.png` (kept locally)), not a filmstrip.
