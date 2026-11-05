# 0027: No dead ends, Free play, softer counter words, and minions between ticks

- Status: Accepted
- Date: 2026-11-06
- Amends: ADR 0020 (§5 home, manual wording, lineup), ADR 0025 (§4 Best of 3 screens), ADR 0026
  (rendering)

## Context

Playing batch 3 on a phone turned up a stuck series screen, a demo racing at 2x, a home screen
that led with the mode that isn't the game, counter words that promised results, an awkward way to
swap a lineup ball, and minions that stuttered. Presentation only: `src/sim` is unchanged, as are
URLs and `RULESET_VERSION`.

## Decision

### 1. No dead ends (a standing rule, CLAUDE.md)

**The bug.** Every shared Reveal link, and Loser-picks-next links where the player lost a round,
stuck after round 1: the track and "Leave series", nothing else. The pick due was the link's to
make, so the player wasn't asked for it; and Play round was hidden because a pick was due
(`pairingOf` returns nothing while side A must pick). Live play, Resume, Back and Forward and a
reload were checked and never stuck; only a replayed link did.

**The rule.** What a series screen shows and offers is one pure model, `seriesScreenOf`
(`src/ui/series/series-view.ts`), and the panel renders exactly its `actions`. Outside a fight
they are never empty: a pick, Play round, or Rematch and New series. With a link pick due, the
pairing is read from the state after the link's picks (`withLinkPicks`), so Play round shows and
makes them. `no-dead-end.test.ts` walks every format through every outcome order (draws and sudden
death included) and every pick, live and replayed from its link, and checks every moment offers an
action that leads on; a browser flow test plays round 2 of a real Reveal link in three engines.
Both failed before the fix.

### 2. The home demo plays at 1x

The 1x / 2x choice is for the player's matches. `playbackSpeedFor` gives home normal speed.

### 3. Best of 3 leads; quick match is Free play

Best of 3 vs bot is the game the vision builds towards, so it is home's large primary button and
takes focus. Choosing both balls is open testing, so it is **Free play**, a secondary button beside
the manual, still opening with the demo's pair. Considered: keeping Play primary. Rejected: it put
the first-time player in the mode with no stakes and no lineup, which is the game's idea.

### 4. Strong vs and Weak vs

A favoured side wins roughly 58-70%, so "Beats" and "Loses to" overstated it. The manual says
**Strong vs** and **Weak vs** (empty headings hidden), the legend ties ▲ and ▼ to those words, and
the README follows. A test keeps "beats", "loses to" and "defeats" out of every counter-map reason
and ball description.

### 5. The lineup: tap a tile to take a ball out, and the gap stays

A ball in the tray is a pressed tile marked "Slot N ✕" (✕ alone in Reveal, which sets no order);
a tap takes it out, as a tap on its slot does. **The slot stays empty and the next pick fills the
first empty slot.** Before, later balls moved up. The usual reason to take a ball out is to swap
it, and moving up put the new ball last, scrambling an order that decides the rounds in Blind and
Loser picks next. Keeping the gap puts the swap where the old ball was.

### 6. Minions are drawn between ticks

`interpolateWorld` blended balls and projectiles but drew minions at the latest tick. At 60 Hz
that is invisible, but at 90 or 120 Hz, common on phones, a minion stood still on 33% or 50% of
frames, a tick ahead of the balls: the lag seen on a phone. Minions now blend like projectiles.

| Necromancer vs Archer, frame driver | Minion still frames | Minion step variation (CV) | Balls (CV) |
| ----------------------------------- | ------------------: | -------------------------: | ---------: |
| 90 Hz, before / after               |            33% / 0% |                0.71 / 0.06 |       0.08 |
| 120 Hz, before / after              |            50% / 0% |                1.01 / 0.06 |       0.06 |

The main thread was not the cause: in Chromium at 375 x 812, 2x density and 4x CPU throttling,
across five matches with batch 3 balls, the frame callback took 0.5-0.7 ms at the median and at
most 7 ms, with no frame over 20 ms, before and after. The Magnet's pull line and the Ghost's
phased look are drawn from the blended balls, so they were already smooth.

### 7. Each ball's shape in `pnpm balance`

`pnpm balance` (and `--ball`) prints, per ball, its win rate and how many opponents it is strong,
even and weak against, by the counter map and by the measured result (outside the 45-55% even
band), with the average win rate in each group (`scripts/balance-summary.ts`). `pnpm
balance:summary` writes it to `docs/balance-summary.md`, which is committed. A ball whose strong
and weak counts differ by 4 or more (about 30% of 13 opponents) gets a **warning**, not a failure:
it is a prompt to look, since a shape can be deliberate (the Brawler is even with all but one). By
the map that flags the Magnet (+6), Quake (+4) and Ghost (-4) today, as ADR 0026 noted.

## Consequences

- Positive: a series can't strand a player, and the rule is tested rather than remembered.
- Positive: minions read as smooth as balls on fast screens.
- Negative: the lineup can hold a gap (`Draft` slots may be empty), one more state to handle.
