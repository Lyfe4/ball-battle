# 0062: Teaching in live matches: What to watch during the countdown

- Status: Accepted
- Date: 2026-11-17
- Amends: ADR 0037 (the ready card), ADR 0053 (no card in a live round)
- Builds on: ADR 0036 (teach in the arena, once), ADR 0054 (6 s to Fight!)

## Context

The What to watch card never showed in a vs Friend match, even with its setting on: a live round
was held on its ready card with no card text, because "nobody reads a card in 3 s" (ADR 0053).
Since ADR 0054 the lead into a live fight is 6 s (Get ready, then the whole 3-2-1), as long as a
player takes to read the card before Fight! against the bot. The ability hints were never turned
off live, but nothing had checked them there.

## Decision

- **A live round shows What to watch** on its ready card when the pairing is new to the device and
  the setting is on (`readyFor`, now pure in `src/app/ready-moment.ts`), under the Get ready and
  the 3-2-1, exactly as against the bot. It goes with the sticker at the server's Fight!, so it
  never holds or delays a live fight: both phones still start at the server's time.
- **No "Don't show these again" on a live card**: offline it starts the fight it closes, and a
  live fight starts at its own time. The settings menu's switch turns the cards off (ADR 0040).
- **Hints are unchanged**: already read from the fight's events live as offline. Now tested there.

## Measured

Two phones against `netlify dev` (`slime-live.online.test.ts`), one with teaching on, one off:
the card showed on each Get ready of the first phone (three pairings) and never on the other; the
ability hints ("Webs!", "Split!", "Arrows!", "Lifesteal!", "Sniper shot!") likewise. Each ready
card lifted on both phones within 14 ms of each other. In a Slime mirror both phones showed "Same
ball, same tricks." and "Split!".

## Consequences

- A live round's card can be taller (the reason under the pairing); it fits the phone court at
  390 × 664 with Get ready and with a huge 3.
