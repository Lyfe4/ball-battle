# 0042: A Best of 3 survives a reload

- Status: Accepted
- Date: 2026-11-07
- Amends: ADR 0020 (§3: `step=answer` and `step=play` no longer fall back to the lineup after a
  reload when the device kept the series), ADR 0025 (§3: a held series survives a reload; Leave
  series now forgets the series instead of holding it)

## Context

Reloading during a Best of 3 lost the whole series. Until a series is decided its URL only says
`?mode=bo3&step=play`, because the bot's lineup must not be in the address bar (ADR 0017). A reload
therefore opened an empty lineup step with no Resume. Safari on an iPhone often reloads a tab after
the player switches apps, so players lost series without doing anything.

The same was true one step earlier. Reloading round 1's pick in Reveal or Showdown (`step=answer`)
lost the revealed bot lineup, and reloading the lineup step lost the tray.

Presentation and storage only: `src/sim`, the bots' choices, `RULESET_VERSION`, links and the known
match results are unchanged.

## Decision

### 1. What is saved: the series as `verifySeries` sees it, plus where the page is

`src/app/series-save.ts` keeps two records in `localStorage`, as plain JSON:

- **`ballbattle.series`**: the series being played or held.
  - `setup`: the series setup with every pick made so far (`setupWithPicks`). This is the same data
    `verifySeries` checks and a server would be sent (ADR 0022).
  - `plays`: matches recorded so far, drawn plays included.
  - `recorded`: whether the last recorded match's result is still on screen.
  - `link`: for a replayed link, all of the link's picks.
  - `save: 1`: the shape of the record.
- **`ballbattle.seriesSetup`**: the setup in progress. It holds the lineup tray (gaps included)
  and, in Reveal and Showdown, the series revealed for round 1's pick (its seed and both lineups,
  no pick yet).

Nothing else is needed, because a series is deterministic. The draws, sudden death, the score,
the track, the bot's shown ball and the next match all follow from the setup, the picks and the
number of plays. The controller saves after every change: start, each recorded match, Play round,
each pick. A save is a few hundred bytes.

**Why not the URL:** the bot's lineup and its picks would be in the address bar, in the history and
in a copied link before their time. A Blind series hides the bot's lineup until each round starts,
and the screens are built around that (ADR 0017, 0025).

**Why `localStorage` and not `sessionStorage`:** the goal includes closing the tab and opening it
again. `sessionStorage` dies with the tab, and on iOS a tab can be discarded outright.

**Why no encryption:** it is a single-player game against a bot. A player who reads their own
storage learns only what devtools would show them anyway. What matters is that nothing visible (the
URL, the screen, accessible names) gives the lineup away. A flow test checks exactly that.

### 2. Putting it back: replay to the same position, then verify the whole series

`src/app/series-restore.ts` rebuilds the session by replaying the saved matches headlessly. It uses
the same session functions the controller uses (`beginSession`, `resolvePicks`, `settleCurrent`,
`showBotBallNow`, `advanceSession`), with the saved picks fed in as they come due. The session it
returns is therefore the one the page had, field for field. Unit tests check this for every
reachable position. The slow suite checks it for every format and bot level over 12 seeds each.

A save is trusted only if all of these hold:

- It names today's ruleset.
- Its picks lead, through the rules, exactly to the position it names: none missing and none left
  over.
- `verifySeries` accepts the whole series it is part of. For a live series, that is the saved
  picks followed by legal choices for the player's later turns (the first ball left) and the bot's
  own picks. For a replayed link, it is the link itself.

So there is still one rule for whether a series is valid (CLAUDE.md), and a tampered bot pick or
bot lineup is refused exactly as an edited link is. Replaying costs at most about 18 headless
matches, about 3 ms each in Node, once per page load.

A save that fails any check is removed, and the page goes to its usual start. A `step=play` URL
with nothing to carry on with opens the lineup step, as it always has. This is never a dead end.

### 3. What a reload shows

- **The lineup:** the tray as it was. A held series still offers Resume, with its score.
- **Round 1's pick (Reveal, Showdown):** the same coin toss, the same shown ball and the same rows.
  A reload can't re-roll the bot's lineup. Going back to the lineup still can, as before: that
  starts a new series (ADR 0025).
- **The Fight! moment, or mid-fight:** the round starts again from its Fight! moment. It is the
  same deterministic match from tick 0, so it draws the same opening. Progress within a fight is
  not saved. Saving it would mean saving a world mid-tick for a few seconds of watching, and the
  ready beat is the natural place to pick up again.
- **Between rounds, after a draw, after sudden death, the result:** the round screen as it was.
  Beside it on a desktop, the round just played stands dimmed as it ended. It is replayed
  headlessly and shown without its intro or Fight!, through `arena.show(world, finished)`. The
  same path now serves Resume after a Back, which used to leave whatever match was last on the
  arena behind the round screen.
- **A decided series:** the URL already holds the whole link. Before, a reload replayed that link
  from round 1. Now, when the saved series is that link (compared by the link each would write,
  `sameSeries`), the page carries on with it and stays on the result. A replayed link that was
  reloaded part-way carries on where it was in the same way.

### 4. When it is forgotten

- **Leave series** forgets the series: there is nothing to resume. This changes ADR 0025 §3, where
  Leave held it like a Back. Leave is a deliberate button; a Back swipe can be an accident, so Back
  still holds the series and a reload keeps it held.
  - **Leave is asked once, in place** (`src/ui/series/leave-confirm.ts`), because it can't be
    undone and it sits by the speed buttons. A tap on the link turns its row into "Leave? You’ll
    lose this series · Leave · Stay".
    - There is no modal: the fight goes on behind it.
    - Stay is the primary button and takes focus, and Escape means Stay (Escape only closes things,
      ADR 0038). Focus returns to the link.
    - Leaving the screen any other way, such as Back, answers Stay.
    - The row fades in only when motion is welcome.
    - New series at the result needs no question: the series is already decided and its link is in
      the address bar.
- **New series**, **Rematch** and starting any other series replace or clear it. A finished series
  stays saved, so a reload shows its result, until one of these happens or Back leaves it (a
  decided series has nothing to resume, ADR 0025).
- **Opening a different series link** replays that link, replacing the saved series. This is the
  existing rule that a new series replaces the held one.
- **A save from an older ruleset, or one that is broken or doesn't verify,** is dropped with no
  message. There is nothing the player could do with it, and the normal start is one tap from
  where they were.

### 5. Tests

- **Unit** (`series-save.test.ts`):
  - Every position of a series in each format comes back identical.
  - Draws and sudden death, from a Blind series whose round 1 draws three times (seed 28534,
    found by search), come back identical.
  - A replayed link comes back still making its own picks.
  - Each kind of bad save is refused and removed: another ruleset, another save shape, a reordered
    bot pick, a reordered bot lineup, an unknown bot, an unknown ball, a pick the series never
    reached, plays past the end, picks past the position, a wrong type, a link that doesn't match.
  - Throwing storage is harmless.
  - The tray and the revealed series are kept and checked.
- **Slow** (`series-save.slow.test.ts`): every position, every format, every bot level, 12 seeds
  each.
- **Through the real page** (`series-reload-flow.ts`, at 375 × 812, 390 × 664 and 1280 × 800 in
  Chromium, Firefox and WebKit):
  - The page runs in a frame the test reloads as a browser does.
  - For a live Blind (Normal), Reveal (Hard) and Showdown (Easy) series, it reloads at the
    half-built lineup, round 1's pick, every Fight! moment, mid-fight, between every pair of rounds
    and at the result. Each time it checks the URL, the title and the words of every part are
    unchanged. At the Fight! moment it also checks the court's size and pixels, so the same
    opening is drawn. Mid-fight it compares the words only: once, under load, the court's pixels
    there differed in Chromium at 390 × 664 while every word matched, and it passed on a rerun.
  - In round 1 it goes Back, reloads the held lineup and resumes.
  - In Blind it checks at every step that none of the bot's unplayed balls is in the URL, the
    page's words or any accessible name.
  - From saved positions, it checks after a draw, the third play of a drawn round at Fight!, and
    after sudden death.
  - It checks that Leave series and New series clear the save, and that an old-ruleset save and a
    broken save land on the lineup with no Resume.
  - It checks Leave's question: it shows in place with the focus on Stay; Leave and Stay are 44 px
    tap targets; Stay and Escape each keep the series unchanged and put focus back on the link; only
    Leave leaves.
  - It checks that a decided series' link opened in a fresh browser (nothing saved) replays from
    round 1, as links always have. Only the device that played it carries on at its result.
  - The flow was run against `main`'s page code (with `main`'s app files swapped in), once per
    step, skipping the checks before it. Every step failed on `main`: the lineup tray, round 1's
    pick, Fight!, mid-fight, between rounds, the held series, the result, after a draw, the third
    play at Fight!, after sudden death, and reaching a saved series to Leave. The bot-hidden check
    passes on `main` too, as it should: it guards against a leak, not a missing feature.
  - The answer-step reload also found a bug in this change before it shipped: a revealed Reveal
    series whose bot shows first was refused, since its first pick is the bot's.
- **Isolation:** browser test files share one origin, so a setup file (`src/flows/browser-setup.ts`)
  clears both records before each file. One flow's series is never put back in the next flow's page.

## Consequences

- Positive: a reload, a closed and reopened tab, or Safari reloading in the background costs at
  most the fight in progress, which starts again from Fight! as the same match.
- Positive: the save is the data a server would verify, checked by the same rule. Server-checked
  PvP can reuse it as the record of a series in progress.
- Negative: one save slot per device, last writer wins. Two tabs playing two series each save their
  own. A reload of either tab carries on with whichever saved last. That is acceptable for a
  single-player game, and the series replaced is never corrupted, only swapped.
- Negative: a page load with a saved series replays its matches headlessly before the first frame,
  twice: once to reach the position, once in `verifySeries`.
  - **Measured** in headless Chromium on the repo's throttled phone profile (375 × 812, 2× density,
    4× CPU, as in `scripts/frame-timing.ts`), restoring a decided series, which replays every play:

    | Series                                                                                  | Plays | Restore (median of 7, slowest) |
    | --------------------------------------------------------------------------------------- | ----- | ------------------------------ |
    | The longest found: the most plays in 40,000 Blind mirror series (seed 908, 8,065 ticks) | 6     | 208 ms, 261 ms                 |
    | Sudden death (seed 28534)                                                               | 5     | 132 ms, 139 ms                 |

  - About 13 µs a tick under throttling. The whole page reached DOMContentLoaded in 591 ms with the
    longest series saved, against 272 ms on the lineup with nothing saved. That difference includes
    building the result screen.
  - The theoretical worst case, nine 60-second draws, would be about 0.85 s. No series anywhere
    near it turned up in the search.
  - If it matters on real phones, the second replay can go: `verifySeries` could hand back the
    states it passes through. That would be a small change to `src/sim`.
- Negative: Leave series can no longer be undone with Resume; it is asked once instead.
- Negative: the browser CI job now takes longer than 10 minutes, because the reload flows play
  three whole series per size and engine. Its timeout is 25 minutes.
