# 0086: Social UX: one place for each signal, a sheet per person, focus for the keyboard only

- Status: Accepted (2026-11-25), approved by the owner with every recommendation (the eight
  decisions below). Building in four batches with ADR 0087 (the plan below).
- Date: 2026-11-25
- Amends: ADR 0081 (Play loses the status strip; the floating card becomes one banner; a friend row
  opens the friend's sheet; What to play has one close, the ×; the Play addendum's "No ring round
  Play" becomes the app-wide keyboard-only rule), ADR 0070 (the floating card becomes the one
  incoming banner, at the top on a phone), ADR 0079 addendum of 2026-11-25 (a friend's or a
  request's More, Report and Block move into the person's sheet, one level deep and confirmed),
  ADR 0085 (play by turns starts from the friend sheet's "Take turns"; "Your games" lists every
  open game by turns now, before the playtest), ADR 0040 and ADR 0044 (settings and the legend
  close with the shared ×, not "Close ›")
- Builds on: ADR 0025 (Back and focus), ADR 0032 (Sticker Pop: calm platform screens), ADR 0037
  (touch first), ADR 0054 (no pauses, one chosen look), ADR 0080 (lineups together), ADR 0082
  (pokes)
- With: ADR 0087 (one frame and loading), whose build plan this record shares
- Proposal: `docs/social-ux-proposal.md` (the audit, the flow walk and the redesign; its
  screenshots, mockups and scripts are kept locally)

## Context

Accounts, friends, the inbox and play by turns were built one pull request at a time (ADR 0079,
0081, 0085). A two-phone walk of the whole challenge flow on the local stack, guests on staging,
and WebKit with touch for focus (the proposal, Part D) found that each piece works and the whole
feels unintentional:

1. **A friend's More is a debug panel.** "More ›" adds a second line of pink text links (Close,
   Report, Block) under a row that already has Challenge, Remove and More: six things at one level,
   five of them links whose "›" says "goes somewhere" when they don't, and the dangerous ones look
   exactly like Copy and Close.
2. **The same news three times on Play.** One challenge is the status strip, the floating card and
   the Friends badge at once. The strip costs the demo court most of its room (about 60 px at
   390 × 664 instead of about 200), and the card covers Free play and, on Friends, the very row it
   duplicates.
3. **Focus rings on tap.** WebKit matches `:focus-visible` on script focus when nothing had
   keyboard focus before, and iOS Safari never focuses a tapped button, so What to play rings its
   chosen option after a tap (seen), and Play rings again once `data-quiet-focus`'s one-off patch
   is gone (from the code and the owner's sighting). Fourteen places move focus by script.
4. **Two Dones on What to play**: a "Done ›" link top right (hidden from screen readers) and a
   full-width Done at the bottom, besides tap-outside, Escape and Back. Settings and the legend
   close with "Close ›", another action drawn as a link.
5. **By turns is hidden** behind the vs Friend setup's Play row, and a game waiting on the other
   player appears nowhere once you leave it; a turn that runs out is never told to either side.

Fifteen smaller findings (the proposal's table): a friend in a lobby for you shown as "In a match"
with Challenge beside it; a status dot before every second line; a by-turns challenge row that
reads as live; actions drawn as links in ten places; a lobby that leads with Copy link when the
friend already has it in the game; two looks for the rematch and challenge cards; news repeated on
Home after the end screen said it; the server's 409 sentence as a page title; crossed challenges
that deadlock ("Your lobby is waiting: finish it first"); a blocked player's link the blocker can
accept without a word.

Twelve big games (the proposal, Part B; fine UI detail unverified for all) agree: social lives in
its own place, never inside Play; friends online is a count or a light on the Friends entry or per
row; Challenge shows only when it can succeed; Remove, Block and Report are one level deep; no
sheet has two visible closes.

## Decision

### Where each signal belongs

| Signal                                      | Today                      | Now                                                                                      |
| ------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| A challenge, request or turn waiting on you | strip + badge + card       | the **badge on Friends** (what waits on you) + **Waiting for you** at the top of Friends |
| A live challenge arriving now               | floating card (bottom)     | **one incoming banner**: the top on a phone, bottom right beside and on a desktop        |
| Friends online                              | strip on Play + row status | **Friends only**: "N online" beside the list's title, a dot per row                      |
| Your turn (by turns)                        | strip + badge + row        | badge + a Waiting for you row with Play (no banner: not urgent, ADR 0085)                |
| The Play tab                                | demo, strip, box, Play     | the demo court at full size, the box, Play: **nothing social**                           |

### A sheet per person

- **Rows**: avatar, name, status with its dot (on status lines only), and at most **one** inline
  action: Challenge, only when it can succeed (online and not in a match). The whole row opens the
  person's sheet. No Remove and no More on a row. A friend whose lobby waits for you says so.
- **The friend sheet** reuses What to play's frame (a bottom sheet on a phone, a panel in the
  middle beside and on a desktop, a native modal `<dialog>`): a large avatar ringed in their status
  colour, name, @username, status; **Challenge · live** (primary), **Take turns** (where
  `TURNS_BUILD`), Remove friend as a row; under a rule, **Report** and **Block** in the danger style
  (`--color-unfavoured` words on `--color-band-edged`). One close, the ×.
- **Confirm in place**: Block and Remove swap the sheet's content for a confirm step that says what
  it does, the red action and Cancel (Back, Escape and × are Cancel). Report is the shared choice
  rows, "Also block", and a red Send report.
- The same sheet for a request (Accept, Decline, then Report and Block), and list sheets for Sent
  (Cancel request) and Blocked (Unblock, one line on what blocking does). `friends-more.ts` goes.
- **Waiting for you**: real buttons side by side (No thanks / Decline secondary, Accept / Play
  primary); a challenge row says "live" or "take turns".

### One incoming banner

One component for a friend's live challenge and a rematch: avatar, "Alex challenges you" / "Alex
wants a rematch", the rules, No thanks and Accept, a × named "Later: keep it in Friends", and a bar
that drains for the time it waits (a rematch's is the server's 30 s; a challenge's the banner's own
20 s). It enters at the top on a phone (it covers the header row only, never Play, the court or the
tab bar) and bottom right beside and on a desktop; slides in (a fade with reduced motion). × or 20 s
unanswered folds it into the Friends badge, which pulses once. No banner while the player is on
Friends (the row lights instead); never over a fight or a lineup (`invitesMayShow`, unchanged).
When the sender stops waiting it says so ("Alex stopped waiting") with OK. News the end screen
already said is not repeated on Home.

### What to play, the friend lobby, by turns

- **What to play**: one close, the × in its head; no Done (choices apply as they are tapped, so a
  Done promised a commit that doesn't exist); tap outside, Escape and Back close it as well. It
  focuses its title on open.
- **The friend lobby**: "Challenge sent", a card with the friend's avatar and "Waiting for Jo" with a
  gentle pulse, one line on what happens next, Cancel challenge as a button, the link folded under
  "Also send a link". The link-only lobby keeps Copy link first.
- **By turns** starts from the friend sheet's Take turns (its lineup in place, as ADR 0085); the vs
  Friend setup keeps its row for a link. Friends gains **Your games** (every open by-turns series:
  whose turn, time left) and an **ended** row kept until seen (a turn ran out, a series finished).
  This needs the inbox to carry open series and unseen endings in its one statement (ADR 0081's "no
  new endpoint" holds) and a `seen` mark per player (an expand-only migration; `privacy.html` if it
  stores anything new).
- **Crossed challenges merge**: accepting a challenge from the person your own lobby waits for
  cancels your lobby in the same transaction (server). Sending twice says "You already challenged
  Jo" with Open it / Cancel and send this; a server refusal is never shown as its own sentence.
- **A blocked player's link tells the blocker**: "You blocked Sam" with Unblock or Not now.
- The leaver of a live match is told on Home once ("You left: Jo wins").

### Focus rings for the keyboard only

- One input-modality flag (`src/app/input-modality.ts`): `pointerdown` (capture) sets
  `<html data-input="pointer">`, `keydown` sets `data-input="key"`. Every `:focus-visible` ring
  rule gains `:root:not([data-input='pointer'])`. This is the fix iOS Safari needs and it replaces
  `data-quiet-focus`. A stylesheet scan fails on an unguarded ring rule.
- A sheet or dialog focuses its title (`tabindex="-1"`), so a screen reader hears its name and Tab
  reaches the first option.
- Script focus stays on close (the gear, `?`, the box): right for the keyboard, hidden after a tap.

### One close per overlay

A shared × (`src/ui/close-button.ts`: a 44 px target named "Close", from the tokens, with the press
and hover rules) sits last in every overlay's head: What to play, settings, the symbol legend, and
later the friend sheet and the banner. Tap outside, Escape and Back close as well. A `look-checks`
rule fails on an open dialog or panel with other than one visible close.

### The UI quality bar (CLAUDE.md, under UI)

New UI gets a mockup in the game's real styles first; an action is a button or a sheet row and a
text link only navigates; one place per piece of information; no doubled controls (one close, one
primary per card); destructive actions apart, one level deep, confirmed, Cancel the safe default;
focus rings for the keyboard only and a sheet focuses its title; every state designed (empty,
loading, error, offline, the other person gone) in the game's words; a row offers at most one
inline action, only when it can succeed. Merged with ADR 0087's lines in CLAUDE.md.

## The owner's decisions (2026-11-25), all as recommended

1. **Friends online on Play**: nothing, and no green dot on the Friends tab icon.
2. **The banner on a phone** enters at the top (it covers the header only).
3. **Challenge from a row**: one inline Challenge, only when it can succeed; everything else in the
   friend's sheet.
4. **What to play** has the × only; both Dones go.
5. **The head-to-head line** ("You 3 – 2 Jo") is dropped from the design for now: the server serves
   no such number.
6. **A blocked player's link** tells the blocker (Unblock / Not now), rather than refusing outright.
7. **Crossed challenges** merge on Accept.
8. **By turns' "Your games"** is built now, before the playtest, not with ranked.

## The build plan (merged with ADR 0087)

Four batches, one staging build each (a batch's pull requests merge close together; docs-only and
test-only ones skip Netlify, `netlify-ignore.sh`). "S n" is this record's pull request n, "P n" ADR
0087's. Every pull request runs its tests and the browser projects of the screens it touches, greps
`*.online.test.ts` and the flows before renaming words, and shows its screens at 390 × 664,
812 × 375 and 1920 × 1080.

| Batch                          | Pull requests                                                                                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1: the rules and first paint   | 1 docs (this record, ADR 0087, the quality bar); 2 tokens and the scrollbar gutter (P 2); 3 first paint (P 3); 4 focus for the keyboard only (S 2); 5 one close per overlay (S 3)            |
| 2: the frame                   | 6 the header row; 7 the shell rule (`shellOf`); 8 columns; 9 Play under the header row; 10 tabs and one name size; 11 the sheet as a component (S 4)                                         |
| 3: loading and the Friends tab | 12 one `/me` and the visit cache; 13 Friends in place; 14 friend rows and the friend sheet (S 5); 15 Take turns from the sheet (S 6); 16 Profile and the controls                            |
| 4: signals and motion          | 17 Play loses the strip (S 7); 18 one incoming banner (S 8); 19 screen motion; 20-22 the crossed challenge and words (S 9), the friend lobby (S 10), by turns' Your games and endings (S 11) |

## Consequences

- Play is a game surface again: the court gets its room back, and social news has one home, the
  Friends tab, with one badge and one banner.
- Every per-person action is one level deep and every destructive one is confirmed; nothing
  dangerous looks like Copy.
- Focus rings show only for the keyboard, in every engine, from one flag; a stylesheet scan keeps it
  that way.
- "Your games" and ended rows need the inbox to carry more in its one statement and a per-player
  seen mark (a migration); S 11 checks the cost against ADR 0084's budget.
- The crossed-challenge merge is a server rule in one transaction (`challenges.ts`), tested with two
  `TestBrowser`s.

## Addendum (2026-11-26): the friend sheet keeps one shape

The owner's change after Batch 3. **Challenge · live always shows** in a friend's sheet. When the
friend can't take it (offline, in a match, or waiting on you in their own lobby) it stays visible
but unavailable: `aria-disabled` (focusable, in the tab order, never `disabled`), its click does
nothing, and one line under it (`aria-describedby`) says why and the way that works:

- "Jo is offline · Take turns instead" / "Jo is in a match · Take turns instead" where the build
  plays by turns, and Take turns takes the primary look (one primary per sheet);
- "… · Try again when they're online" / "… · Try again after it" where it doesn't;
- "Jo is waiting for you · Accept in Waiting for you" for a friend whose lobby waits on you (Take
  turns stays secondary: theirs is the way).

The sheet's parts and their order are the same in every state (`friend-sheet.browser.test.ts`).
The row's inline Challenge keeps its rule: it shows only when it can succeed. Words in
`friends-text.ts` (`liveUnavailable`). Since ADR 0087's "one button and row system" addendum the
sheet says **Play by turns** where this record says Take turns ("Jo is offline · Play by turns
instead").

## Addendum (2026-11-26): Batch 4 as built

Batch 4 of the plan (social S7-S11 with ADR 0087's P19), built as one stack of six pull requests,
each on the one before. What the record above left open, and what changed in the building:

- **S7, Play loses the strip**: `statusLine` and the strip are gone; "N online" is in the friends
  list's title ("Friends · 5 · 2 online", never "0 online"). The demo court is 200 px at 390 × 664.
  New series (a held bot series) moved into Free play's row, at its end: its own row cost the court
  56 px.
- **S8, one incoming banner** (`incoming-banner.ts`, `incoming-text.ts`): the rematch's old card is
  gone. On a phone it floats at the top over the header row, inside the safe area, and moves
  nothing (a first build pushed the page down under the row, which shrank Play's court by 92 px at
  390 × 664; `frame-anchors` now opens a banner on every frame screen at every size and checks that
  no landmark moves); bottom right on a desktop; on Play beside it sits over the
  court's foot, since the corner there is Play. **A rematch has no ×**: it can't wait anywhere else,
  so only a challenge folds into the badge. While a challenge's banner shows, the badge doesn't count
  it (one place for the news); it counts it from the fold, then pulses. "Stopped waiting" is told
  apart from "taken on another of this player's tabs" by the sender's status in the same inbox
  answer (in a match: taken). An ending the end screen showed is never repeated (`endingTold`).
- **P19, screen motion**: a tab change has **no** motion (the record allowed none or a quick fade;
  instant keeps tabs quick and avoids fading twice with a skeleton's reveal). View Transitions are
  used for browse moves only, with the rail and the visible header row named (the header by script,
  so two never meet); under reduced motion no View Transition runs (its group still moves the
  picture), only a fade. Rows leaving Friends fade as a still copy over their place, so a redraw
  stays one synchronous step. The motion-literal allow-list is empty. The ready card's "Hide tips"
  is a compact secondary beside Fight!. While the friend count is unknown on a phone, the cards
  under the list wait unseen in their place (rather than storing a count on the device, which
  `privacy.html` would have to name).
- **S9, the challenge lifecycle**: crossed challenges merge in `acceptChallenge`, both players'
  advisory locks taken in one order before the link's row lock; a second, simultaneous Accept finds
  the pair's lineups and joins them. A blocked sender's link: the blocker's card says "You blocked
  Sam" (Unblock, Not now) and Accept is refused (`friend_blocked`); the sender is told nothing.
  `/me/match` names the friend a lobby waits for. Every 4xx of the challenge services has the game's
  words (`CHALLENGE_REFUSALS`). The leaver is told once on Home on the banner's look.
- **S10, the friend lobby**: the line on what comes next reads the lineups' clock from
  `startLineupMs` (`src/api/start.ts`, 60 s, 75 s for Best of 5). After a No thanks, "Challenge
  someone else" cancels the lobby first, so the next send isn't refused for it.
- **S11, Your games and endings**: Your games lists the games waiting on the **other** player; a
  game waiting on you stays in Waiting for you with Play, so no game shows twice. Endings show until
  seen, for at most 7 days (`ENDING_DAYS`), seen by the player's own read of the ended series
  (`game.series_seen`, migration `20261125234153_series_seen.sql`; no trigger, so seeing pokes
  nobody). The inbox reads turns, games and endings in one statement (`gamesFor`); an ending already
  pokes both inboxes through the series trigger (ADR 0085). `privacy.html` names the seen mark.

## Addendum (2026-11-26): a challenge shows on a live match's end screen

The owner's staging check: two friends finished a live match, one said No thanks to the rematch and
stayed on the end screen, the other went home and challenged them, and nothing showed until they
went home too. The cause: `isFighting` counted the online screen as a fight whenever the series was
live, its end included, so `invitesMayShow` held the banner there. The rule was always "never over
a fight or a lineup pick", and the end screen comes after the match.

- **One table** (`screenKindOf`, `screen-rules.ts`): every screen and moment is a `fight`, a `pick`
  or `calm`. A rematch waits only through a fight; a friend's challenge waits through a fight or a
  pick. A series' end (bot, by turns or live) is calm. `screen-rules.test.ts` lists every live and
  bot state, and fails when a screen the router knows is missing from it.
- **One banner at a time**: while the end screen's own rematch question is open (asked either way,
  or agreed and on its way to the lineups, `OnlineRematch.holds`), a friend's challenge waits
  behind it, and shows the moment the rematch is answered (the end screen's read refreshes the
  inbox watch).
- **Test**: `challenge-on-end.online.test.ts` (shard 2): Jo says No thanks to Sam's rematch and
  stays on the end screen; Sam challenges Jo from Friends; Jo's banner shows there, and Accept
  opens the lineup.
