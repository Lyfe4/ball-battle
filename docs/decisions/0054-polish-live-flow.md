# 0054: A finished feel for online play: no pauses, no loading pages, the whole countdown, one chosen look

- Status: Accepted
- Date: 2026-11-16
- Amends: ADR 0044 (§3 the match waits under settings: offline only), ADR 0053 (the lead to Fight!
  is 5 s with "Get ready" before the 3-2-1; buttons that move to another screen wait for it), ADR
  0038 (one look per state: the chosen option)

## Context

Live friend matches work end to end, but four things still felt like scaffolding, on a phone and
a desktop:

1. **Settings paused a live match.** On a short phone (375 × 635 in Safari) ADR 0044 lets the menu
   cover the court and holds the match. A live match plays on the server's clock, so the paused
   phone fell behind its opponent and lost that part of the fight.
2. **"Loading…" pages between screens.** Accept challenge went to a page titled "Loading…" with a
   Home button, then the series; so did Back to your match and the lobby when the friend accepted.
   A link opened cold showed the same bare title.
3. **The 3-2-1 was often joined part-way.** The server set Fight! 3 s after the lock, and a phone
   learns of the lock only at its next read. Measured below: most countdowns started at 2 or 1.
4. **The chosen option was a shade.** The Best of 3 / Best of 5 toggle, the bot level, the format
   cards, the Free play slots and the lineup's balls showed the chosen one by a slightly lighter
   plum (`--color-selected`), easy to miss; the speed toggle alone used the pink.

## Decision

### 1. Settings never make a live match wait

`SettingsHost.mayWait()` is false while a live match is on screen (`online.isLive()`). Then, when
no place keeps the full menu off the court, it takes its compact form and `placeClear`
(`settings-place.ts`, pure) puts it in the tallest band of its column clear of the court and its
gear, its height capped to that band, so it scrolls inside itself. It never covers the court, so
`settingsCoverCourt()` is never true and the arena never holds. Offline keeps ADR 0044's rule.

### 2. No loading pages: the button waits, a cold screen shows its skeleton

- **Between screens:** a button that leads into an online series (Accept challenge, Back to your
  match, Back to your match on the "already in a match" card) and the lobby's own move when the
  friend accepts read the series first (`online-prime.ts`) and keep the bouncing ball until it is
  read. The series screen takes that answer at once (`SeriesClient.open(id, primed)`), as if it
  had just read it, with no read of its own first. Send challenge reads the lobby's card before
  it shows. A primed answer is kept 10 s at most and never a failure.
- **On its own** (a link opened cold, a reload): a skeleton of the screen's real layout
  (`skeleton.ts`): the series' bar, status line, track, banner and pick rows; the card's header,
  lines and buttons. Calm blocks in the card fill that breathe slowly (still with reduced motion).
  It keeps a real way out (the gear and Home; the card's Back) and is one busy status to a screen
  reader. `onlineNotice` no longer has a loading case: its type refuses one.
- **Errors** keep the existing notices with Try again.
- Found on the way: the lobby asked again every 2 s and showed its card again with focus, moving
  keyboard focus to the heading each time. It now keeps focus where it is.

### 3. The whole 3-2-1 on both phones

**Measured** with `scripts/live-countdown.ts` (two phones on one PC in New South Wales; the
friend's at 6x CPU and a 30 fps cap; functions in Ohio, database in Sydney): for each fight on
each phone, how long its countdown card showed and which lines.

| Build                                 | Countdowns | Whole 3-2-1 | Card shown before Fight! (min / median / max) | How late a phone learned (max) |
| ------------------------------------- | ---------- | ----------- | --------------------------------------------- | ------------------------------ |
| Before (staging, `main`, 3 s lead)    | 12         | 3           | 1.37 / 2.20 / 2.98 s                          | 1.63 s                         |
| After (deploy preview, 5 s lead)      | AFTER      | AFTER       | AFTER                                         | AFTER                          |
| After (local `netlify dev`, 5 s lead) | 6          | 6           | 3.38 / 4.76 / 4.87 s                          | 1.62 s                         |

Before, 9 of 12 started at "Fight in 2…" or showed "3" for a moment only. A phone learns of a
ready round at its next read: up to one poll (1 s after the last answer) plus a read (630 ms at
the median from Ohio, p90 about 1 s), and the locking phone a little after its own pick's answer.
Replaying the round headlessly to time it costs 5-12 ms (x6 on the slow phone), so the lag is the
polling, not the phone.

- **The lead is 5 s** (`LEAD_MS`): 2 s for the other phone to learn of the round, then the 3-2-1
  (`COUNTDOWN_MS`). Before the count the card says **Get ready**.
- **Each line changes by a timer set for its exact moment** (`nextLineChange`), not on the 250 ms
  display tick, so each number shows for a whole second, also at 30 fps.
- **A phone that learns too late for the whole count** (less than 2.8 s before Fight!: a cold
  function, a phone back from the background) says Get ready until Fight!, never joining the
  count part-way (`countdownLine`). Fights still start together at the server's time.
- Cost: 2 s more per round, 6 s in a Best of 3 and 10 s in a Best of 5. No migration: `fight_at`
  is computed in `src/server/live.ts`.

### 4. One look for the chosen option

`src/ui/choice.css`: every option is `.choice`; the chosen one (`aria-pressed` or `aria-checked`
true) takes the selected fill, a 3 px ring in the second accent (pink, the colour of picking) and
a round pink check sticker on its top right corner: a change of colour and of shape. A lineup's
ball tile keeps its own × (a tap takes it out), so it shows the ring only. Settings' switches stay
switches (a thumb that moves, a track that lights up). `choice.test.ts` fails if any other
stylesheet draws a chosen state, or a control sets `aria-pressed` without the shared look.

## Tests

Each was seen failing on the code before the change.

- `settings-live.safari.browser.test.ts` (390 × 664): a menu too tall for any clear place covers
  the court and holds an offline match, but in a live match keeps off the court, under its gear,
  inside the screen, scrolling, and never holds it. `settings-place.test.ts`: `placeClear`.
- `online-play.browser.test.ts`: a series read just before moving is on the arena as the screen
  opens, with no read of its own; opened cold, the skeleton shows (busy), no notice, no Loading
  heading, until the first answer. `online-prime.test.ts`: once, fresh, never a failure.
- `live-match.online.test.ts` and `live-support.ts`: each phone notes every skeleton or Loading
  heading it shows; Send challenge to the lobby, Accept and the lobby to the series, and Back to
  your match show none; a cold link shows the card's skeleton, never a Loading title. Chromium,
  and once in WebKit (`ONLINE_ENGINE=webkit`).
- `live-play.test.ts`: the lead leaves 2 s before the count; Get ready, 3, 2, 1 each for a whole
  second; a phone that learns late keeps Get ready; each change on its exact moment.
- `choice.test.ts`: one look, worn by every control that says it is chosen.

## Library and platform behaviour relied on

- CSS `outline` follows `border-radius` (Chromium 94, Firefox 88, Safari 16.4); the focus ring is a
  `box-shadow` (base.css), so the chosen ring and the focus halo show together.
- `min-height` beats `max-height`: the menu caps its height with `max-height` and its content
  scrolls (`overflow-y: auto`), so nothing in it may set a `min-height` on the panel itself.
- `setTimeout` never fires early, but late under load; each countdown line re-reads the clock when
  it fires and schedules the next change from there, so a late timer never skips a number.
- A browser throttles timers in a hidden tab and iOS suspends it: a page back from the background
  re-stages at the server's moment (ADR 0053) and, too late for the count, says Get ready.

## Consequences

- Positive: a live match never stops for settings, no screen says only "Loading…", every phone
  that learns in time sees the whole 3-2-1, and what is chosen is plain on every screen.
- Negative: each live round takes 2 s longer. A phone that learns very late sees Get ready, not
  the count (rare: a cold function or a phone back from the background).
- Negative: an online move reads the next screen before it shows it: the button waits about one
  read longer, and the screen then shows complete.
