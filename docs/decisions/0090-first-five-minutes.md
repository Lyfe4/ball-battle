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
2. **D2: the bot shows first in round 1**, by the choice of seed, never a rule. Reveal's toss is a
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

Measured with `node scripts/first-series-measure.ts 3000` (ruleset 23, 30 balls): 3,000 whole
series per row, real fights, Best of 3 · Reveal against Easy on a stepped seed. "▲ picker" takes
the highest ▲ against what it faces when there is one (the shown ball, answering; the bot's balls
left, showing first), else any; "random" picks at random. Lineups are three random balls, or Pick
for me's.

| Player   | Lineup      | Series won (±2σ) | Round 1 won |
| -------- | ----------- | ---------------- | ----------- |
| ▲ picker | random      | 52.9% ± 1.8%     | 54.8%       |
| ▲ picker | Pick for me | 52.9% ± 1.8%     | 57.5%       |
| random   | random      | 49.2% ± 1.8%     | 48.3%       |
| random   | Pick for me | 50.6% ± 1.8%     | 51.1%       |

The bot showed first in every series (100%). Winnable, not guaranteed, and far under the 85%
ceiling; if anything it is close to a coin flip, because a random 3 from 30 often holds no ▲ against
the shown ball, and Easy's random answer in round 2 can't be read.

**A considered variant, not built:** also step past seeds whose first shown ball has no ▲ answer in
the player's lineup (still a seed choice, bounded; `--answerable`). It lifts round 1 to 64.4% (Pick
for me 65.2%) and the series to 56.0% (56.4%) for a ▲ picker, and leaves a random picker at
51-52%. It rewards reading the marks, the lesson the first pick teaches, without scripting a
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
