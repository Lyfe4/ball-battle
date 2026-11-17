# 0061: The coin toss as a moment, and together online

- Status: Accepted
- Date: 2026-11-17
- Amends: ADR 0041 (the toss in the pick banner), ADR 0053 (the live start), ADR 0054 (the lead
  into a fight)
- Builds on: ADR 0029 (Reveal's coin toss), ADR 0053 (times are the database's)

## Context

Reveal's coin toss was a 32 px coin in the pick banner that flipped once in 600 ms: easy to miss
in every mode. Online, "Player 4821" didn't fit on it, and the two phones never saw it together:
the player who showed first saw it with their pick, the other saw "waiting for the other player"
and met the flip only at their own pick, many seconds later. The server opened the first pick the
moment both players had arrived.

## Decision

**A moment of its own.** Round 1 of a Reveal series opens on the toss (`coin-toss.ts`, one part
for every screen that shows it): a big Sticker Pop coin (88-112 px on a phone, 128 px on a
desktop) with a cream rim, the player's face the accent yellow with "You" and the other's the pink
with their short label. It rises, turns five times and lands on the winner's face with a squash
(`TOSS_FLIP_MS`, 2 s), and its shadow shrinks as it rises. Under it, "Coin toss…", then who shows
first in full in display type, which pops on as it lands and is held (`TOSS_HOLD_MS`, 1.5 s).
Nothing of the pick shows until then, not the banner, rows or track (the bot's shown ball would
give the result away). The banner keeps the toss in words afterwards ("Coin toss: you show
first."). Offline it flips once per series, when round 1 first shows (the bot's screen, or a
rematch).

**Names never leave the coin.** A face carries at most five characters: "You", "Bot", a guest as
"P4821" (as the score line names them), a short name as it is, and anything longer "Them"; the
label is clipped to its face as well. The full name is in the line under the coin, which wraps.

**Reduced motion: a calm toss.** The coin stays still with a "?" over it while it is tossed, the
"?" fades to the winner's face as it lands, and the result does not pop. The timeline is the same,
so a live toss still ends with the other phone's.

**Live: timed by the server, the same moment on both phones.** When both players have arrived,
the start (`live-service.ts`) opens a Reveal series' first pick `TOSS_LEAD_MS` (6.5 s) later,
not at once: `TOSS_READY_MS` (3 s) of "Get ready" (as the lead into a fight: room for the other
phone to learn of the start at its next read, measured at up to 2.2 s in ADR 0054), then the flip
and the result. Each page times the toss back from that opening (`liveTossOf`: only when the
first pick opens exactly `TOSS_LEAD_MS` after the start, so a series started before this change
has none), sets one timer for each stage on its corrected clock, and a page that learns of it
late joins the flip where it has got to (the animation's `currentTime`), never from the start. A
pick during the toss is refused as `too_early`, like one during a fight. Showdown has no toss and
opens at once.

No migration: the first pick's opening was already a column (`turn_opens_at`), and its deadline
follows it (30 s from the opening).

## Measured

Two phones on one PC against `netlify dev` (`coin-toss.online.test.ts`, each page recording when
its own screen changed, one clock): the phone that arrived first saw Get ready 480 ms before the
other; both started the flip at the same millisecond, landed at the same millisecond, and showed
the first pick card 3 ms apart (its ticker draws every 250 ms).

## Consequences

- Each live Reveal match starts 6.5 s later; the flow reads both join, Get ready, the flip
  together, the result, the first pick.
- Every offline Reveal series waits 3.5 s before round 1's pick. Browser flows wait for it
  (`tossed`, `tossedIn`), and one flow times it on a phone.
- The banner's little coin and its stylesheet are gone; the toss is one part.
