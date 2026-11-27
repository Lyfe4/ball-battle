# 0090: The first five minutes

- Status: Accepted (2026-11-27), the owner's choice of D1-D6 as the FTUE proposal recommended (Track
  C2, 2026-11-26, kept locally); built in one stack, 2026-11-27
- Date: 2026-11-27
- Amends: ADR 0055 and 0081 (a first visit's Play tab has no box and no Free play), ADR 0081's
  Ranks tab (one card, not three)
- Builds on: ADR 0025 (show less), ADR 0027 (no dead ends), ADR 0036 (teach once, per device), ADR
  0042 (a series survives a reload), ADR 0073 addendum (the ready card's marks already speak from
  the player's side, so the proposal's PR 3 is done), ADR 0087 (one frame, nothing jumps)

## Context

A walk of staging as a brand-new guest (phone and PC) found that the game teaches well once a fight
runs (What to watch, the ability captions, "How it was won") and not at all before it. Play started
Best of 3 · Reveal against the Normal bot: five words never explained, 30 balls with no help, and
in round 1 a newcomer showed first about half the time, so the Normal bot (which answers with its
best counter 60% of the time) was handed the first fight. The phone walk lost 0-2. After the series
the Play tab offered everything at once; the Ranks tab was three "Coming soon" cards.

## Decision

1. **D1: the first series is against the Easy bot**: Best of 3 · Reveal, picks at random, no script.
   It is never saved as Play's: after it, the box says Best of 5 · Reveal · vs Normal bot (the
   addendum below).
2. **D2: the bot shows first in round 1**, by the choice of seed, never a rule (since the addendum of
   2026-11-28 the seed is chosen for the player's lineup, with more rules; this stepping is gone). Reveal's toss is a
   pure function of the series seed (`revealFirst`), so the lineup step steps from a fresh seed to
   the nearest one whose toss gives the bot (`botShowsFirstSeed`, `src/app/first-series-setup.ts`):
   bounded to 64 steps and deterministic, as browser tests pin `generateSeed` to one value. No sim
   change, no ruleset bump; `verifySeries` accepts any seed, so a reload and a link verify as before.
3. **D3: hide, don't lock.** A first visit's Play tab has no box, no "What to play" and no Free play:
   Play is the one action, its line "Your first series · vs Easy bot", the demo's line the pitch
   ("Pick 3 balls. Watch them fight. Outguess the bot."). Nothing locked is shown.
4. **D4: vs Friend arrives after the first series; a friend's link always works at once.** The link
   is never gated or detoured, and doesn't end the first series: it is still ahead at Play.
5. **D5: the Ranks tab is one card**, "Ranked is coming" / "Until then, play a friend.", with "Play
   a friend now".
6. **D6: a quiet "Skip: show me everything ›"** in Free play's place on a first visit, and **no
   existing player ever sees the guided state**.

### The state (`src/app/first-series.ts`)

- One key, `ballbattle.firstSeries`: `guided` (the first series is ahead), `graduated` (played here
  and over: the two new formats wear "New" until chosen, and each says how it goes once) or `done`
  (skipped, or a device that had played: everything, nothing marked new).
- **Decided once, on first use, and written.** With no key, the device is new unless it holds a key
  only real play writes: a format or an opponent chosen (`playFormat`, `playOpponent`), an ability
  hint or a What to watch card seen (`hintsSeen`, `readySeen`), a saved series (`series`), or ADR
  0036's old `versusSeen`. Never a key a first page load writes (sound, speed, the first paint, the
  slow-frames line, the tray) or a remembered setting alone. Once written, keys the first series
  itself writes can't end it early.
- **Storage that throws is `done`**: nobody is held in the guided state.
- **Over** when the first series ends, win or lose, or is left (Leave series). Back holds it as any
  series (ADR 0042): Resume takes Play's place and home stays guided until it ends.
- **"Show all tips again" starts it over**, so a shared device can give the next newcomer the guided
  series.

### What it teaches, once, where it first matters

- **The lineup**: "How a series goes" (Pick 3 balls. / Each round, one of yours fights one of the
  bot's. / Win 2 rounds.), and **Pick for me** in the level's place: Brawler, Archer and Venom, by id,
  any missing filled from the roster in its order (nothing depends on the roster's size or order).
- **Round 1's pick**: "Your first pick": what ▲ under the shown ball means, in the marks' own odds,
  and "Tap a mark to read why."
- **Round 2's pick**: one line, "The bot sees your ball before it answers."
- **The result**: "New: more ways to play" (a series is Best of 5 from now on; Showdown and Blind;
  the Normal and Hard bots; a friend, where the build has one), with no Copy link: there is nobody
  to send it to yet.
- **What to play** says the chosen format's rule in a sentence under its row (for everyone), and
  tags Showdown and Blind "New" after a first series, in place, until each is chosen.
- **The first Showdown** says how it goes over round 1's pick, **the first Blind** over its lineup.

All of it is one component (`steps-box.ts`, the notice's "How it goes" box), static text read in
place, and a device's choices, never a server's: no new function call, no migration.

## The guided series' win rate

_As first built; superseded by the addendum of 2026-11-28 (the seed chosen for the lineup)._

Measured with `node scripts/first-series-measure.ts 3000` (ruleset 24, 32 balls; ruleset 23 was
within a point): 3,000 whole series per row, real fights, Best of 3 · Reveal against Easy on a stepped seed. "▲ picker" takes
the highest ▲ against what it faces when there is one (the shown ball, answering; the bot's balls
left, showing first), else any; "random" picks at random. Lineups are three random balls, or Pick
for me's.

| Player   | Lineup      | Series won (±2σ) | Round 1 won |
| -------- | ----------- | ---------------- | ----------- |
| ▲ picker | random      | 53.0% ± 1.8%     | 56.0%       |
| ▲ picker | Pick for me | 54.0% ± 1.8%     | 56.3%       |
| random   | random      | 49.8% ± 1.8%     | 49.1%       |
| random   | Pick for me | 51.9% ± 1.8%     | 50.7%       |

The bot showed first in every series (100%). Winnable, not guaranteed, and far under the 85%
ceiling; if anything it is close to a coin flip, because a random 3 from 32 often holds no ▲ against
the shown ball, and Easy's random answer in round 2 can't be read.

**A considered variant, not built:** also step past seeds whose first shown ball has no ▲ answer in
the player's lineup (still a seed choice, bounded; `--answerable`). It lifts round 1 to 66.6% (Pick
for me 65.2%) and the series to 58.6% (56.9%) for a ▲ picker, and leaves a random picker at
52-53%. It rewards reading the marks, the lesson the first pick teaches, without scripting a
win; worth choosing if the first series should feel more winnable.

## Consequences

- Browser flows start as a device past its first series (`src/flows/browser-setup.ts`); a flow of
  the first visit starts as a brand-new device (`openAsNewDevice`, `first-visit-flow.ts`).
- A first visit's layout gave the phone court a fractional height, which showed that the canvas's
  first size (`clientHeight`, rounded) and the resize observer's (exact) differed by a pixel a frame
  after the first paint; the canvas now measures its container exactly (`src/render/canvas.ts`).
- A first-visit state on staging does not carry to production: they are different origins.

## Addendum (2026-11-27): Best of 5 is the default length

The owner's decision, part of this work: **a new series is Best of 5** everywhere (vs Bot, vs Friend
live and by turns, the Play box and What to play) unless the player chose otherwise. **The guided
first series stays Best of 3** (fewer picks, a shorter first series; the win rate above is for it),
and its "New: more ways to play" card says first: "From now on a series is Best of 5: first to 3
wins." This amends ADR 0048, where Best of 3 was the default.

- **Where it lives:** `NEW_SERIES_BEST_OF` (`src/app/series-length.ts`): Play's setup and a friend
  match's with nothing remembered (`FIRST_PLAY`, `FIRST_FRIEND`), and a remembered length that
  can't be read. The sim's `DEFAULT_BEST_OF` stays 3: it is what a series link or a saved series
  with no length means.
- **A remembered choice is never overwritten:** a device that chose Best of 3 (`seriesLength`,
  `friendBestOf`) keeps it. A device that never chose a length now plays Best of 5.
- **Links never change meaning:** a series link with no length is Best of 3, `mode=bo5` is Best
  of 5, an old `?mode=bo3` setup link opens Best of 3; old saved series restore as they were.
- **Tests:** the browser flows keep their explicit lengths; the online flows' phones remember Best
  of 3 against a friend (`src/flows/online-device-support.ts`), the length their live matches were
  written and timed for, and the default itself is checked by `modes.test.ts`,
  `series-length.test.ts` and the first-visit flow.

## Addendum (2026-11-28): tuned to teach, one coach, the unlock moment

The owner's verdict on the built first series: the guide works, but it looked like any other card,
sat away from what it explained, and the first series was a coin flip (53% for a player reading the
marks). Decided and built overnight (the owner's brief, unattended; each choice below is the
reasonable reading, open to change).

### The first series is tuned to teach (replaces D2's seed stepping)

**Say it plainly: the guided first series is tuned so a newcomer who reads the marks almost always
wins it.** Only that series (the guided Best of 3 · Reveal against Easy, on a device in the guided
state), never a later series, a link, a friend or online. It is still a choice of seed, never a sim
rule: the seed is chosen after the player's lineup is set (Pick for me included), so the bot's lineup,
the toss, every Easy choice and every fight follow from it, and `verifySeries` accepts it as any seed.
`firstSeriesSeed` (`src/app/first-series-seed.ts`) looks at seeds from a fresh one, at most 2,048,
for one that passes every rule:

- **A natural grid** (`isNaturalGrid`): two or three ▲ for the player (one ▲▲ at most), at most one
  ▼, no ▼▼, the rest even. Never a grid full of green.
- **Round 1**: the bot shows first, a ball the player has a ▲ answer to.
- **Round 2**: whatever the player shows, Easy's answer is never favoured against it.
- **Every favoured fight is won**: each fight where the player's ball is favoured (round 1's answers,
  round 2's ball against each answer, round 3's last two balls) is pre-played on the seed and must
  go the favoured ball's way. A pick that isn't favoured plays its fight as it falls: no even fight
  is ever chosen, so "▲ matters" stays true.
- **Preferred**: a seed where a player taking the highest ▲ is carried by favoured fights alone
  (round 1's answer, then round 2's or, if round 2 is lost, round 3's), else the best of the first
  six that pass by how often round 3 favours the player; past 2,048 seeds, the first with two ▲
  where the bot shows first.

The search plays up to a dozen fights per passing seed, about 40 ms (median, up to 200 ms) on a
desktop, so the page runs it between frames (`firstSeriesSeedSliced`, 12 ms slices) with Reveal
lineups busy (`busyOnClick`); a Back meanwhile starts nothing. Measured with `node
scripts/first-series-measure.ts 3000` (ruleset 24, 32 balls), 3,000 whole series per row:

| Player   | Lineup      | Series won (±2σ) | Round 1 won | 2+ ▲ in the grid | Natural grid |
| -------- | ----------- | ---------------- | ----------- | ---------------- | ------------ |
| ▲ picker | random      | 96.6% ± 0.7%     | 99.8%       | 100.0%           | 99.7%        |
| random   | random      | 70.1% ± 1.7%     | 68.7%       | 100.0%           | 99.7%        |
| ▲ picker | Pick for me | 92.4% ± 1.0%     | 100.0%      | 100.0%           | 100.0%       |
| random   | Pick for me | 72.4% ± 1.6%     | 69.3%       | 100.0%           | 100.0%       |

The bot showed first in every series. The targets (▲ picker 90% or more, random 70-80%, 2+ ▲
always) are met without the grid looking rigged; the 0.3% of grids that aren't "natural" are lineups
where no seed in 2,048 passed every rule, which fall back to two ▲ where the bot shows first.

### One coach (`coach.ts`, `coach.css`)

Every moment the game teaches before a fight has one look that reads as a guide, not content: the
first series' "How a series goes" (1 of 3), "Your first pick" (2 of 3) and "Round 2: you show
first" (3 of 3), and a format's first time ("How Showdown goes", "How Blind goes", no step marker).

- **Its look** is the arena tips' (ADR 0036): the tip's cream along the left edge, a faint cream
  outline and the tip's "i", so the game has one teaching colour; not the accent yellow, which is
  the main action's. A step marker ("2 of 3") where the guide has steps.
- **Placed against what it explains**, a notch pointing at it: over the pick rows (a phone, a
  desktop), beside them with the notch across (a phone turned sideways); over the lineup's slots on
  a desktop, under the main action pointing up at them on a phone turned sideways (its sticky
  button would otherwise cover the tray).
- **Enters once** on the motion tokens (up 6 px and in, `--motion-slow`, `--ease-out`); a fade with
  reduced motion. **Acted on, it settles**: the lineup's coach keeps its title line once the slots
  are full; the pick's goes with the pick.
- **Points at the answer** (1b): in the first series' round 1, the best answer's row (▲▲ before ▲,
  `bestAnswer`) and its mark wear a cream ring that breathes (`--motion-breathe`, `--ease-swing`);
  a still ring with reduced motion. The coach says so: "The lit row is your best answer."
- **Round 1 fits a phone** (1c): on a phone held upright, round 1's pick reads the score line with
  the track a tap away (as a phone turned sideways already did, ADR 0067), so the banner, the coach
  and every pick row show at 390 × 664 without a scroll (checked in the first-visit flow). The
  rows' heads show the bot's balls, so nothing is lost.
- **Tooltips never cover a coach**: a mark's tooltip goes to the other side when the coach is in
  the way (`placeTooltip`'s `avoid`).

### The unlock moment (`unlock-card.ts`)

At the first result, win or lose, "New: more ways to play" is a reward card directly under the
result sticker: a gold edge and wash, the title in gold and one small icon per new way (Best of 5,
Showdown, the bots, a friend). Folded it is one 48 px row, so Rematch, Change balls and Home stay on
a 390 × 664 screen (the flow checks it); a tap opens the lines, each beside its icon. It enters one
slow beat after the sticker lands. A compact strip that opens was chosen over showing it after the
result settles: it is seen at once, where the eye is, and never moves the buttons later.

### Also fixed from the owner's screenshots

- **What to play's "New" tag** sits on the button's top left edge, out of the text's flow, so every
  format button has one height at every size (Showdown's wrapped under its name).
- **The score grid's waiting balls** are one overlapping cluster on one line, 30 px high, however
  many (a Best of 5's five stacked in three rows).
- **Ranks is one card** at every size: "Ranked is coming / Trophies for online wins. Until then,
  play a friend." and Play a friend now under it; the intro that said it twice is gone, and the
  desktop's aside with it (amends D5).
- **A reload in the middle of the first series** comes back to the same series, its coach and its
  lit row, with the device in one state throughout (`first-series-reload.safari.browser.test.ts`).
  Log out and Forget me still clear every `ballbattle.*` key, so a shared device gets the guided
  first series again.

### Before accounts reach production (2026-11-28)

- **An account that has played online is past the first series on any device**: `/me` says
  `played` (a finished or forfeited online series, read in the same statement as the profile,
  `meOf`), and the page then skips the guided first series (`firstSeries.skip()`), home redrawing
  Play at once. A guest, or an account new to online play, keeps the guided series. Log out and
  Forget me still clear every `ballbattle.*` key, so a shared device gets it again.
- **No "By turns" or "Live" words where the build has no play by turns** (production today):
  Profile's stats and match rows say neither, as every match there is live.
