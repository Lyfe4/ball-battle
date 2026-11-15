# 0055: Home by opponent, and online match screens that feel alive

- Status: Accepted (2026-11-16), with the owner's decisions below; built in five pull requests
  (build plan, below)
- Date: 2026-11-16
- Amends: ADR 0046 (home and Other modes), ADR 0048 (where the length is chosen), ADR 0053 (the
  lobby, the pick timer, the end of a live match)
- Builds on: ADR 0054 (the chosen look, the whole countdown, no loading pages)

Mockups: `docs/images/ux/` (phone 390 × 664, desktop 1280 × 800), drawn with the game's own tokens
and font from `docs/images/ux/src/` (`node docs/images/ux/src/render.mjs`). Screens as they are
today: `docs/images/ux/before/`.

## Context

Online play works, but the way into it and the screens around a match still read as scaffolding:

- **Home is one fixed mode.** Play is always Best of 3 · Reveal against the bot (ADR 0046); a
  player who prefers Best of 5 on Hard goes through Other modes every time. Other modes repeats the
  Best of 3 / 5 toggle per section and mixes bots, a friend and Free play in one list. Casual and
  Ranked will need a place too.
- **The pick timer is a line of small text** ("Your pick · 28 s"); the waiting player sees "Waiting
  for Player 4821 · 26 s" in the same small grey line, and nothing moves while they wait.
- **The match's first screen is one long sentence** ("Waiting for Player 6338 to join · 60 s. Stay
  until the end. Leaving for 30 s loses the match.") over an empty track.
- **The lobby shows a raw URL** as body text, Copy link beside Cancel at equal weight.
- **The friend's card** is a wrapped header title and two paragraphs.
- **The countdown** is one line of small text on the pairing card.
- **The end of a live match** offers Home only; the obvious next step, a rematch, isn't there.

| Home                              | Other modes                              | Series start                              | Pick                              | Lobby                              | Challenge card                              | Countdown                              |
| --------------------------------- | ---------------------------------------- | ----------------------------------------- | --------------------------------- | ---------------------------------- | ------------------------------------------- | -------------------------------------- |
| ![](../images/ux/before/home.png) | ![](../images/ux/before/other-modes.png) | ![](../images/ux/before/series-start.png) | ![](../images/ux/before/pick.png) | ![](../images/ux/before/lobby.png) | ![](../images/ux/before/challenge-card.png) | ![](../images/ux/before/countdown.png) |

## A. Home and navigation

### Options

| A1 (recommended): Play + opponent cards | A2: opponent tabs over Play         | A3: Play + a list of ways           |
| --------------------------------------- | ----------------------------------- | ----------------------------------- |
| ![](../images/ux/home-a1-phone.png)     | ![](../images/ux/home-a2-phone.png) | ![](../images/ux/home-a3-phone.png) |

- **A1. Play remembers; vs Bot and vs Friend are two cards under it.** Play starts the last setup
  the player started, and says it: "Best of 5 · Reveal · vs Hard bot" (or "vs Friend · Best of 3 ·
  Showdown", which goes to that lineup and then Send challenge). A first visit plays today's
  default. Each card opens **one setup screen** for that opponent: length, format and (bot) level,
  each a segmented row or cards in the shared chosen look, then Choose lineup. Free play and the
  Ball manual are quiet links below. Other modes goes; its URL (`?view=modes`) opens home.
  - **Room for Casual and Ranked:** the two cards become a 2 × 2 grid, the most competitive first
    (Ranked, Casual, vs Friend, vs Bot), and Play remembers whichever was last
    (`home-a1-later-phone.png`). Nothing else on home moves.
- **A2. A Bot / Friend toggle over Play.** One screen, one decision less; but the toggle changes
  what Play does without leaving home, length and format hide behind a "Change" link, and four
  opponents later make a crowded toggle.
- **A3. Play, then a list of every way to play.** The plainest growth path, but it is Other modes
  moved onto home: Free play and the manual sit at the same weight as playing a friend, and home
  gets long on a phone.

**Recommendation: A1.** One clear action (Play, your way), one clear choice of opponent, one
screen per opponent with no duplicated toggles, and a grid that takes Casual and Ranked later
without redesign.

| vs Bot setup (phone)                  | vs Friend setup (phone)                  | vs Bot setup (desktop)                  | Home (desktop)                        |
| ------------------------------------- | ---------------------------------------- | --------------------------------------- | ------------------------------------- |
| ![](../images/ux/setup-bot-phone.png) | ![](../images/ux/setup-friend-phone.png) | ![](../images/ux/setup-bot-desktop.png) | ![](../images/ux/home-a1-desktop.png) |

### Back, Escape and browser Back

One rule as today (ADR 0025, `navigation.go`), with the new keys:

| From                       | ‹ and browser Back                                                                  | Escape      |
| -------------------------- | ----------------------------------------------------------------------------------- | ----------- |
| vs Bot / vs Friend setup   | home                                                                                | closes only |
| A lineup reached from Play | home                                                                                | closes only |
| A lineup from a setup      | that setup, choices kept                                                            | closes only |
| The lobby                  | home; the lobby stays open (Back to your match)                                     | closes only |
| A live match               | asks Leave and forfeit? (in-app); browser Back leaves with the grace period, as now | closes only |
| `?view=modes` (old links)  | opens home                                                                          |             |

Escape only ever closes things (ADR 0038). Every state keeps a way forward (`no-dead-end.test.ts`
gains the two setups). The remembered setup is per device (`localStorage`, as the level is).

## B. The online match screens

### The pick timer, shown to both players

| B1: a ring on the pick card          | B2 (recommended): a bar on the pick card  | B2 at 7 s                                   | B3: a ring on the track              |
| ------------------------------------ | ----------------------------------------- | ------------------------------------------- | ------------------------------------ |
| ![](../images/ux/timer-b1-phone.png) | ![](../images/ux/timer-b2-calm-phone.png) | ![](../images/ux/timer-b2-urgent-phone.png) | ![](../images/ux/timer-b3-phone.png) |

- **B1. A ring with the seconds**, at the start of the pick card. Glanceable, but a ring at 44 px
  reads poorly for the last seconds and competes with the ball icons.
- **B2. A bar across the pick card, the seconds at its end.** Calm lilac until 10 s, then the
  accent yellow (not red: urgent, not alarming); the number stays the same size, no flashing, no
  sound. The same card on both phones: "Your pick · 22 s" for the picker, "Player 4821 is picking
  · 18 s" for the other. With reduced motion the bar steps once a second instead of gliding.
- **B3. A small ring beside whoever picks, on the track.** Ties the clock to the player, but on a
  phone the track is above the fold and the pick rows below, so the eye travels.

**Recommendation: B2**: the widest, plainest signal, in the card the player already reads, and the
same component for both players. Its colour change is the one urgency cue.

### Waiting, and the series start

| The other player picks              |
| ----------------------------------- |
| ![](../images/ux/waiting-phone.png) |

- **"Player 4821 is picking"** with three soft dots that pulse in the second accent, the same bar
  counting down, and what they are answering ("You showed Storm. They answer from:" and their
  remaining balls). One line under the track says what happens next: "You'll fight as soon as they
  pick."
- **Series start** (both players arriving): the same card says "Waiting for Player 6338 to join",
  with the 60 s as its bar; "Stay until the end…" moves to the lobby and the friend's card, where
  it is read before the match, not during it.

### The countdown into each fight

| C1 (recommended): Get ready                    | C1: 3                                      | C2: a ring on the pairing card           |
| ---------------------------------------------- | ------------------------------------------ | ---------------------------------------- |
| ![](../images/ux/countdown-c1-ready-phone.png) | ![](../images/ux/countdown-c1-3-phone.png) | ![](../images/ux/countdown-c2-phone.png) |

- **C1. One big sticker centred on the court**: "Get ready", then a huge 3, 2, 1, with the pairing
  in small type under it. Each number pops in (a 120 ms scale, none with reduced motion) and the
  sticker lifts away at Fight!. It is the ready card at a larger size, so it stays one component.
- **C2. The pairing card as today with a ring counting the second.** Quieter, but small on a phone
  and easy to miss mid-scroll.

**Recommendation: C1.** It is impossible to miss and reads across a room; ADR 0054 already
guarantees the whole count on both phones.

### The lobby, the friend's card and the end of the match

| Lobby                             | Lobby (desktop)                     | Friend's card                    | End                             | End (desktop)                     | Rematch asked                                 |
| --------------------------------- | ----------------------------------- | -------------------------------- | ------------------------------- | --------------------------------- | --------------------------------------------- |
| ![](../images/ux/lobby-phone.png) | ![](../images/ux/lobby-desktop.png) | ![](../images/ux/card-phone.png) | ![](../images/ux/end-phone.png) | ![](../images/ux/end-desktop.png) | ![](../images/ux/end-rematch-asked-phone.png) |

- **Lobby:** a bouncing ball (the busy ball's big sibling, still with reduced motion), "Waiting
  for your friend", the format; **Share link** as the one primary button; the link in a quiet
  box with Copy; the stay rule in one line; Cancel as a quiet link, not a button beside Share.
- **Friend's card:** "A challenge from Player 6908" as a sticker, the format as three chips, "How
  it goes" in three short steps, one primary (Build your lineup) and a quiet Not now.
- **End:** the result as the Winner sticker's look ("You win 2–1 vs Player 4821" / "Close one"),
  both lineups, the fair-play line; **Rematch** primary, Home and How it was won secondary.
- **Rematch (proposed):** Rematch sends the same friend a live challenge with the same length and
  format, shown on their end screen as "Player 4821 wants a rematch" with 30 s to answer; both
  build new lineups. It is a new challenge on the existing machine (no new series rules): the
  server needs `POST /series/:id/rematch` that creates a live challenge addressed to the other
  player and a field on their series view saying one is waiting. Needs a migration (one nullable
  column, expand only) and the owner's approval for staging. Without approval, the end screen
  ships with "New challenge" (Other modes' send flow with the same settings) in Rematch's place.

## C. Other scaffold-like things, by how much they matter

1. **The series start's long sentence** (above): the first thing both players see. B fixes it.
2. **The 16+ card appears after Send challenge or Accept** (the player has built a lineup, then is
   stopped). Ask it on the vs Friend setup's first visit instead; the lineup then never waits.
3. **The score line wraps at 390 px** mid-fight ("Round 1 · You 0–0 Player 6066" on two lines,
   `before/countdown.png`). Shorten long names to "P6066" there, or drop "Round 1 ·" on phones.
4. **The lobby's raw URL** and Copy/Cancel at equal weight (B fixes it).
5. **Desktop notices** (the age card, a failure) float as a narrow card high on a wide empty page;
   centre them in the sheet's column and give them the card's padding.
6. **Leave match sits in pink by the live line** at the same weight as the clock; make it the
   quiet muted link it is offline, pink only on hover/focus.
7. **"Live · normal speed"** under every live fight says what can't be changed; show it once, in
   the first round, then leave the line empty unless the opponent disconnects.
8. **The friend's card title wraps** in the header ("Player 6908 challenges / you"); B's sticker
   fixes it.
9. **The demo match on home** sometimes waits on a still frame under reduced motion; show the
   pairing card over it so it reads as a picture, not a frozen game.

## Tests (when built)

- `home-modes-flow.ts` becomes `home-play-flow.ts`: Play remembers each opponent's last setup
  across a reload; each card opens its setup in one step and one Back; old `?view=modes` links
  open home; `no-dead-end.test.ts` and `history-rules.test.ts` gain the setups.
- The pick card's timer: a unit test for its colour change at 10 s and both players' words; the
  online flow checks the waiting player sees the opponent's seconds.
- The countdown sticker: `one-of-each.test.ts` keeps it the ready card; the online flow checks
  "Get ready", 3, 2, 1 on both phones (as ADR 0054 measures).
- Rematch (if approved): database tests for one rematch per series and side, both answering at
  once, and a rematch after a forfeit.

## Decision (the owner, 2026-11-16)

1. **A1, B2 and C1**, as recommended, with these choices:
   - **Play only ever remembers bot games.** It shows and starts the last series set up against the
     bot ("Best of 5 · Reveal · vs Hard bot"); a first visit is Best of 3 · Reveal · vs Normal bot.
     A friend match needs a link, so it never becomes Play's setup (A1's "vs Friend · …" Play line
     is dropped). Under Play the vs Bot and vs Friend cards each open their setup screen as mocked;
     Free play and the Ball manual are quiet links. Other modes goes; `?view=modes` opens home.
     Room is left for Ranked and Casual (`home-a1-later-phone.png`). Back, Escape and browser Back
     follow the table above.
   - **Desktop home** fills its column: the title, Play and the cards scale up with the screen so
     the column is as weighty as the demo court beside it (checked at 1280 × 800 and 1920 × 1080).
   - **B2:** calm until 10 s, then yellow; the same card for both players ("Your pick · 22 s" /
     "Player 4821 is picking • • • 18 s", with what they are answering).
   - **C1:** the big "Get ready" sticker, then a huge 3, 2, 1, on the existing ready card.
2. **The lobby, the friend's card and the end screen** as mocked: Share as the main button, the
   link in a quiet box with Copy, Cancel as a quiet link; the card with "How it goes"; the result
   sticker and Rematch.
3. **Rematch: yes**, with its migration (additive only) and server route. Both players must agree
   within the timer; if one says no or time runs out, both see a clear message and Home. A rematch
   is a new live match with new lineups and new seeds, under the same rules.
4. **Part C: all nine.** Most important: the 16+ question is asked at the start of the vs Friend
   flow (before building a lineup, and before accepting a link), only on a device that hasn't
   answered it.

## Build plan

1. Home and the setup screens (A1, part C item 2).
2. The pick timer, the countdown and the waiting states (B2, C1, part C items 1 and 3).
3. The lobby, the friend's card and the end screen (part C items 4 and 8).
4. Rematch: the migration, the route and the end screen's answer.
5. The rest of part C (items 5, 6, 7 and 9).

## As built

### 1. Home and the setup screens

- **Play** (`src/app/modes.ts`): `PlaySetup` is the format (`ballbattle.playFormat`), the length
  (the old `ballbattle.seriesLength`, so a Best of 5 chosen on Other modes carries over) and the
  bot's level (`ballbattle.botLevel`, which the lineup step's own level choice also writes). The
  vs Bot setup's Choose lineup saves all three; Play opens that series' lineup in one tap.
- **One setup screen for both opponents** (`src/ui/series/rules-step.ts`): the length with its
  rule, the format cards, the bot's level (vs Bot, hidden for Blind) or the live note (vs Friend),
  then Choose lineup. Every choice is a `.choice` in the shared chosen look. vs Bot is a series
  link's first step (`?mode=bo3&fmt=…`, so old `?mode=bo3` links still open it); vs Friend is
  `?view=send&…&step=setup` before its lineup (`?view=send&…`, as before). Each choice rewrites
  its own history entry, so Back from the lineup finds the setup as it was left, and a reload
  keeps it. A lineup reached from Play goes back home; from a setup, to it; arriving on a lineup
  from a link, its setup on the link's choices.
- **The 16+ question first** (part C item 2): opening the vs Friend setup, or Build your lineup on
  a friend's card, asks it on a device without a guest, before any lineup. A device that loses its
  cookie still meets it after a refused request, as before.
- **Home's cards** are data (`HOME_CARDS`; vs Friend only in builds with online play, where the one
  card takes the row). On a desktop the column grows to `clamp(26rem, 100vw - 100dvh - 4rem,
38rem)` and its type and cards scale with the screen's height.
- An old `?view=modes` link, or any home URL with leftovers, opens home and rewrites its address.
