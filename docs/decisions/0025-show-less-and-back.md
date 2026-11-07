# 0025: Show less, one set of Back rules, and Best of 3 as visuals

- Status: Accepted
- Date: 2026-11-05
- Amends: ADR 0020 (§3 history, §4 info card, §5 screens), ADR 0017 (scoreboard UI)
- Amended by: ADR 0027 (no dead ends: the series screen model and its test), ADR 0038 (the
  legend has its own Close), ADR 0039 (§4: while a round is fought on a phone the track waits under the score line)

## Context

Playing on a phone after ADR 0020 showed four problems.

- **Too many words by default.** The quick setup put the full description, Beats and Loses to
  between the verdict and the grid. Most screens opened with a sentence or two.
- **Back didn't do what players expected.** On the matchup chart, Back returned to the Balls tab.
  After Change balls, Back went through copies of the setup and old matches. In a Reveal series,
  Back from round 1 reopened the round-1 answer, with the same seed and bot lineup, so a player
  could watch round 1, leave and answer it again.
- **The round screens had to be read.** Reveal round 2 was one long sentence, and its pick buttons
  had one unlabelled mark per bot ball (`· ·`).
- **Results were sentences** ("Round 1: your Brawler beat the bot's Quake"), next to the arena's
  finished round and the HUD saying the same.

Presentation only: `src/sim` is unchanged, as are URLs and `RULESET_VERSION`.

## Decision

### 1. Show less by default (a standing rule, CLAUDE.md)

Each screen shows what its one job needs. Details appear when the player asks: a tap, a
`<details>` expander, a link. What is shown is short. Visuals and symbols beat sentences where
they are clear. A symbol is either obvious or explained once in the symbol legend, the `?` in the
header of any screen that shows symbols. Every symbol has words in its accessible name.

- **One mark table** (`src/ui/balls/marks.ts`): ▲ favoured, ▼ unfavoured, = even. Dense grids (the
  ball grid, the matchup chart) leave even blank so the counters stand out, and the legend says so.
- **Quick setup:** each slot carries its mark against the other. The reason is one tap away (the
  verdict is the expander's summary). Each slot's ⓘ opens the ball's manual entry. The grid's
  legend is the other slot's drawing. The info card is gone; the manual holds the detail.
- **Lineup:** no hint and no info card. Reveal's tray has no numbers, because no order is set there.
- **Rules, home, manual:** one short line or none. A test keeps format lines to 7 words.
- **HUD:** health as bars, with the numbers for screen readers only. The seed is in the link, not
  on screen. At the end the rows show the outcome (the winner's row says Wins, the loser's fades).

### 2. One set of Back rules (`src/app/history-rules.ts`)

Every move between screens goes through `navigation.go`, which applies one pure rule:

1. **Back undoes exactly one screen move.** A move that stays on the same screen key replaces the
   entry: a tab, a pick, a format, the tray, one ball's manual entry to another's, a series round
   to the next.
2. **Going to the screen you just came from is a Back**, not a second copy: Change balls from a
   match, New series to the lineup. Each pushed entry stores the key of the screen before it in
   `history.state`, and the target URL is rewritten as asked once the browser has gone back.
3. **A series is one entry.** The round-1 answer, every round and the result share a key, so
   Back from any of them lands on the lineup and the answer can't be reopened.

The in-app ‹ is still the browser's Back, falling back to the screen's parent when the visitor
arrived from a link. The rules are tested as a table, and as whole flows through the real route
parser over a fake history.

Alternative considered for the manual: push one entry per ball opened (a browser-like trail).
Rejected: that trail is what made Back feel like it never left the manual.

### 3. A series left with Back is held, and can be resumed

A Back swipe is easy to trigger by accident on a phone. Back (or Leave series) no longer drops an
undecided series. The controller holds it, and the rules and lineup screens show **Resume series**
with the score. Resume (or Forward) carries on where the series was.

- Every choice already made stays in the session. The answer step's entry is gone (rule 3) and
  the revealed bot lineup is cleared when the lineup opens, so resuming can't re-answer a round.
- If the arena showed something else meanwhile, the current round restarts from its own seed, so
  it plays out exactly as it would have. Only the series' own match is recorded, never a quick
  match played meanwhile.
- Starting a new series replaces the held one. Leaving before answering round 1 and revealing
  again draws a new bot lineup. That is a new series, with nothing learned about the old one's
  fights.
- A reload still drops the series (ADR 0020 §3): the bot's lineup is never in the URL until the
  series is decided.

This is covered by a flow test through the real page in Chromium, Firefox and WebKit
(`src/flows/*.browser.test.ts`, with its own DOM tsconfig). It was shown failing both with the hold
disabled and with the answer entry pushed instead of replaced.

### 4. Best of 3 as visuals

What the screens may show is a pure model (`src/ui/series/series-view.ts`). It returns only what
the player may know, and tests check that a blind series never shows the bot's next ball.

- **Series track:** the score over one column per round, the player's ball over the bot's. The
  winner is ringed and the loser dimmed, a ball not known yet is `?`, and in Reveal the bot's
  unplayed balls wait together under the next round. ↻ marks a replay and ⚡ sudden death.
- **Your pick:** appears only when the player has a choice, as one row per option: the ball, then
  what it would face, each with a mark. In Reveal round 2 that is the bot's possible answers, by
  its public rule (best counter by the counter map). A test checks the bot's real answer is
  always among them.
- **Nothing to decide:** the next pairing large, and one Play round button.
- **The end:** "You win" or "Bot wins", the score, every round, Rematch, New series and Copy link.
- **Between rounds and at the end** the arena, health and speed make way on a phone (dimmed beside
  it on a wide screen), and focus moves to the next action. The sentences remain in a live region
  for screen readers.
- **Fix:** Reveal's round 3 said "against a hidden ball", but the bot's last ball is known there.
  It is now named, with a test.

### What came from the references

- **Clash Royale's result:** a score you can count at a glance, and one obvious next button.
- **Marvel Snap's lanes:** columns side by side, each lit for its winner. That is the track.
- **Super Auto Pets' round result:** the outcome in one word first, and lineups facing each other.
- **Hearthstone's turn prompt:** a "your pick" banner only when the player can act, with the
  choices highlighted.

## Consequences

- Positive: each screen's job is visible at a glance on a phone. Back behaves the same
  everywhere and is tested. An accidental Back costs nothing.
- Positive: the first flow test through the real page runs in all three engines, so the Back and
  resume wiring is covered as well as the pure rules.
- Negative: a held series lives in memory only, so a reload loses it as before.
- Negative: the info card's quick read of a ball's counters is now one more tap (ⓘ) away.
