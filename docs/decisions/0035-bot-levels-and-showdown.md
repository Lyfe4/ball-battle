# 0035: Bot levels, Showdown, and pick screens that never give the bot's move away

- Status: Accepted
- Date: 2026-11-07
- Replaces: Loser picks next (ADR 0019 §3, the bot's `pickNext`)
- Amends: ADR 0017 §4 (the bot), ADR 0021 §3 and §5 (the bot's answer, the round-2 rows), ADR 0022
  §5 (the opponent names a level), ADR 0025 §4 (pick rows), ADR 0030 §4 (touch)

## Context

Playing against the bot showed four problems:

- **The bot was a rule, not an opponent.** It always answered with its best counter by the counter
  map, so once a player learned the map its moves were fully predictable.
- **The pick screens gave its move away.** Reveal's "show first" rows drew the bot's predicted
  answer to each of the player's balls ("→ Speedster"), so the player read the bot's choice instead
  of making their own.
- **Loser picks next had one real choice per series.** A three-ball lineup leaves the loser of
  round 1 one choice between two balls.
- **Symbols weren't explained on every screen or device.** The series panel had no `?`, and a
  touch screen had no tooltip at all (ADR 0030 made touch add nothing).

## Decision

### 1. Bot levels: Easy, Normal, Hard

A bot is now a weighting of its balls for each kind of choice. `choose(view)` is a seeded draw from
`weights(view)` (`src/sim/bot.ts`):

- **`BotView`** holds only what the bot may know: the format, the series seed, the round, its role
  (`show`, `answer` or `open`), both sides' balls left, the score and, only when answering, the
  ball shown. An opponent's pick it hasn't been shown is not in the view, so no bot can read it,
  even by mistake. A test opens a Showdown with each of the player's three openers and checks the
  bot's opener is the same; it fails when the view leaks the player's pick.
- **Easy:** any ball at random, for every choice.
- **Normal** (the default): its counter-map best 60% of the time (`NORMAL_COUNTER_SHARE`),
  otherwise anything. Answering, that is its best counter to the shown ball. Opening a Showdown, it
  is the balls that fare best against the opponent's whole lineup. It shows first at random.
- **Hard:** it plays the whole series, not the round (`src/sim/bot-model.ts`). It values positions
  by the counter map's odds (64 / 50 / 36%), with both sides playing their best after.
  - Answering: the ball that leaves it the best series chance, round 3 included.
  - Showing first: any ball whose worst answer leaves it within 3 points of its best, at random.
  - Opening a Showdown: the exact mixed equilibrium of the 3 × 3 game (`maximinMix`), so no opener
    of the player's can exploit it.

  Answering is not mixed. The player has already committed, so there is nothing to exploit, and
  the best reply is simply the best.

Every level picks its lineup the same way, uniformly at random from the series seed. So a seed
gives the same bot lineup at any level, and Blind, where the bot makes no choices, plays the same
at every level. The level control is hidden for Blind.

Determinism: the model uses `+ − * /` and comparisons only (the sim's ESLint rules apply), and ties
are broken by order. A server makes the same choices. The measurement scripts read `weights`
directly, so what they measure is what plays.

**The first bot stays** (`random`, not offered) with its own streams. A link from before levels has
no `bot=`, and still replays exactly after "Play with today's rules".

### 2. The level in setups and links

- `opponent.bot` names the level (`easy`, `normal`, `hard`, or `random`).
- A decided link writes `bot=` unless it is the first bot. Absent means `random`.
- An unknown level is kept, so `verifySeries` refuses the link and it opens the lineup step, rather
  than replaying another bot's series.
- The level isn't in the address bar while a series is built or played; it isn't needed until the
  series is decided.
- The player's choice is remembered in `localStorage` (`ballbattle.botLevel`, wrapped in try/catch
  like the speed). It falls back to Normal.

### 3. Showdown replaces Loser picks next

- **Rules** (`showdownTurnsOf`):
  - Both sides pick three balls blind, and both lineups are revealed.
  - Round 1: both pick at the same time. The picks are recorded A then B, but B's never reads A's.
  - Round 2: the winner of round 1 shows first and the loser answers, seeing the shown ball.
  - Round 3: the balls left.
  - A drawn round is replayed with the same pair. Every series records exactly four picks.
- **The name.** "Showdown" over "Winner leads": both lineups face off in the open and round 1 is a
  shoot-out, and the card's line explains the rest ("Open together. Winners show, losers answer.").
- **Old `fmt=loser` links** can't replay: the format is gone from the sim, following ADR 0022 (no
  old rules kept in the bundle).
  - A whole series in that format shows the older-link notice first, as any old replay link does
    (`SeriesLink.retiredFrom`).
  - "Play with today's rules" then opens the lineup step, prefilled with the player's lineup and
    Showdown.
  - A setup-step link with `fmt=loser` opens with Showdown chosen.

### 4. Pick screens show odds, never the bot's move

- **Each row is one of the player's balls**, then every ball the bot still has, in the same columns
  on every row, each with the player's ▲ / = / ▼ against it, like a type chart. When answering, the
  ball being answered is ringed.
- **Nothing on screen or in the live region says what the bot will do.** `botAnswers` and the rows'
  "→ X or Y" are gone, and so is "the bot answers with its best counter". A test walks every
  format, level and seed and fails if a screen names a choice the bot hasn't made.
- **A one-line key under the rows:** "▲ favoured · = even · ▼ unfavoured". The marks can be read
  without any gesture, on any device.

### 5. Symbols explained everywhere (amends ADR 0030 §4)

- **The series panel has a quiet bar:** "Best of 3 · Showdown · Hard" and the legend's `?`, in
  every phase. A browser test checks the `?` is on screen whenever a symbol is.
- **Touch.**
  - A tap on a symbol that isn't part of a control (the track's rings, the key) shows its tooltip.
  - Inside a control (a pick row, a grid tile), a tap still presses the control. Press and hold
    (450 ms) shows the tooltip and swallows the click that ends the hold. The key under the rows
    means the hold is an extra, never the only way.
  - Movement over 10 px (a scroll) or `pointercancel` cancels the hold.
  - The tooltip closes on the next touch, on scroll or after 3 s.
  - The browser's long-press callout and text selection are off on controls that show symbols.

Screenshots in `docs/images/bot-levels/`:

- `phone-rules.png`: the rules step with the level choice;
- `phone-showdown-opener.png` and `desktop-showdown-opener.png`: Showdown's round 1, with the key;
- `phone-show-first.png`: round 2 after winning round 1, with the series bar and its `?`.

## Measured

`docs/series-measurements.md`: exact series chances over 20,105 evenly spaced lineup pairs from 17
balls, against the bots' real weights, with measured odds (200 seeds per ordered pair). Also 1,000
whole series per row, played with the game's simulation, as a check.

| Format   | Bot    | Best play | Worst play | Random play | Gap      | Round-1 winner takes the series |
| -------- | ------ | --------- | ---------- | ----------- | -------- | ------------------------------- |
| Reveal   | Easy   | 54.7%     | 45.4%      | 50.0%       | 9.3 pts  | 74.9%                           |
| Reveal   | Normal | 54.4%     | 43.7%      | 48.7%       | 10.7 pts | 74.8%                           |
| Reveal   | Hard   | 51.9%     | 42.0%      | 46.7%       | 9.9 pts  | 74.8%                           |
| Showdown | Easy   | 52.5%     | 47.6%      | 50.0%       | 4.9 pts  | 72.3%                           |
| Showdown | Normal | 53.9%     | 45.1%      | 49.5%       | 8.8 pts  | 73.1%                           |
| Showdown | Hard   | 51.6%     | 44.9%      | 48.6%       | 6.6 pts  | 72.1%                           |

- **The levels move the series chance by about 3 to 5 points.** Every round is a soft counter, so
  even a perfect read buys little. For a player choosing at random, Easy is an even fight (50%) and
  Hard a clear underdog (46.7% in Reveal). With the counter map's own odds, Hard at best play is
  exactly even (50.0%), the fair value of the game. So Hard is tough but not hopeless, and Easy is
  beatable rather than clearly so.
  - An Easy bot that drew its lineup after the player's, leaning toward balls the player counters,
    added only about 2.5 points, so it was not built.
  - Wider levels would need steeper counters, which ADR 0028's bands rule out.
- **Choices matter at every level.** Good play beats bad play by 5 to 11 points, and choices move
  the odds by 3 or more points in 82 to 98% of lineup pairs.
- **Reveal has more skill than Showdown at every level:** a gap of 10.7 vs 8.8 points at Normal, and
  9.9 vs 6.6 at Hard.
  - Showdown's round 1 is a simultaneous guess. Against Hard's equilibrium mix, no opener is better
    than another.
  - Showdown's comeback rule (the winner shows first) means round 1 decides the series slightly
    less often: 72-73%, against 75% in Reveal, which is what independent rounds give.
- **Fairness:** Showdown's rules are the same for both sides; Reveal's toss is fair (ADR 0029).

**Recommendation: keep Reveal as the main mode.** It has more skill against every level and the same
fairness. Showdown is the better story for player against player (no coin, a dramatic opener) and
stays as the second format. The decision is open until both have been played.

## Consequences

- Positive: the bot can be learned without being predicted. A Hard bot gives nothing away, and the
  pick screens give the player the odds to make their own read.
- Positive: every choice is still seeded, recorded in the link and checked by `verifySeries`, so a
  server reaches the same series.
- Positive: the marks can be read on any device without a gesture.
- Negative: links to Loser picks series no longer replay; they open Showdown's lineup after the
  notice. Every link from ruleset 5 shows the notice, as after any rules change (ADR 0022).
- Negative: the series panel has one more row (the bar) under the arena on a phone. The arena's size
  is unchanged.
- Open: whether Showdown or Reveal becomes the PvP default, once both have been played.
