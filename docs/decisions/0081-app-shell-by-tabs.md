# 0081: The app shell by tabs

- Status: Accepted (2026-11-23), approved by the owner as proposed (the shell proposal and its
  mockups, reviewed 2026-11-23), with the requirements from the mockup review below. Not built yet:
  the build plan below.
- Date: 2026-11-23
- Amends: ADR 0025 (§3 Back: a rule for tabs), ADR 0055 (home becomes the Play tab; the opponent
  cards become the Play chooser, and Ranked and Casual join it later instead of a 2 × 2 grid), ADR
  0070 (the floating card also waits through a lineup pick), ADR 0079 (the account screen splits
  into Profile and the Friends tab; a friend's challenge card folds into a badge)
- Builds on: ADR 0020 (every screen is a URL), ADR 0027 (no dead ends), ADR 0039 (the phone arena
  is the screen), ADR 0040 (one gear per screen), ADR 0067 (the beside layout), ADR 0078 (Forget me
  without accounts)
- Parity checklist: `docs/app-shell-checklist.md` (everything home and the account screen do
  today; each build pull request ticks off what it moves)

## Context

Home has grown one control at a time: Play, a card per opponent, Free play and the manual as
links, the account button beside the gear, and "Back to your match". Friends live in a section at
the bottom of the account screen (ADR 0079), and a friend's challenge reaches the player only as the
floating card. The game is heading for friends, ranked play, a leaderboard, currency and progression
(`docs/vision.md`); none of them has a place to live, and every one would land on home.

Mobile games with friends and ranks settle this the same way: a few top-level places one tap apart,
a profile behind an avatar, and a badge for what is waiting. We take the pattern, not anyone's look:
the shell is drawn in Sticker Pop (ADR 0032) with our own icons and words.

## Decision

### Four tabs, and nothing over a fight

- **Tabs: Play · Balls · Friends · Ranks**, with room for a fifth (Shop) later. A bottom bar on a
  phone held upright; a rail on the left in the beside layout (`(min-aspect-ratio: 5/4)`, ADR 0067),
  with the words beside the icons in the desktop query (ADR 0031). The current tab wears the
  primary's yellow; a badge wears the second accent (pink). Icons are our own plain shapes.
- **"Friends", not "Social"**: it holds friends and challenges, and it is the word the game
  already uses.
- **The bar shows on the tab screens only.** Setups, lineups, the coin toss, matches, series, live
  rooms, the challenge and start screens, sign-in and Profile take the whole screen as today, with
  their own Back. The phone arena stays the screen (ADR 0039): no bar ever shows while something
  fights or a lineup is being picked.
- **Which tabs a build shows:** Play and Balls always; Friends in builds with online play
  (`ONLINE_BUILD`); Ranks only in builds with accounts (`ACCOUNTS_BUILD`: previews and staging) until
  it holds something real (below). A tab never opens an empty page in production.

### What each tab holds

- **Play** (home, `/`): the demo court, the status strip, a chooser (vs Bot, and vs Friend in online
  builds), one large Play, then Change rules and Free play as quiet links, and Privacy · Terms at the
  end. vs Bot's Play is today's Play: the remembered bot series, one tap to its lineup, or Resume
  series and New series while one is held (ADR 0042, 0046, 0055). vs Friend's Play opens the send
  screen (`?view=send`). Change rules opens the chosen opponent's setup (`rules-step.ts`). Play
  still remembers only bot games (ADR 0055); the chooser starts on vs Bot. Ranked and Casual become
  more choices in the chooser, not more cards. "Back to your match" and "Back to your rematch" take
  Play's place exactly as today.
- **Balls** (`?view=manual`, `&ball=`, `&tab=chart`): the ball manual and the matchup chart, moved
  as they are.
- **Friends** (`?view=friends`, new; online builds): see "Friends, guests and accounts off".
- **Ranks** (`?view=ranks`, new; accounts builds only): the trophy road, a friends board and an
  everyone board, each marked "Coming soon", and a way on (Play a friend). It ships to production
  when it holds one real thing, such as a friends board from the online wins the server already
  records; that is a decision of its own.

### The avatar and Profile

- **The avatar replaces the account button** (ADR 0079 addendum of 2026-11-22): top left on a
  phone, at the top of the rail in the beside layout. It shows the initial (the first grapheme, by
  `Intl.Segmenter`, so "Łukasz" or an emoji name shows whole), a guest's plain face, or, while `/me`
  is unknown, the plain face that claims nothing (`accountLook`, as today). It opens Profile.
- **Profile** (`?view=profile`, new; accounts builds): name, @username and friend code; a stats card
  marked "Coming soon" (no data is read for it); then Change username, Log out and Delete account
  for an account, or what signing in unlocks, Sign in and Forget me for a guest; Privacy · Terms at
  the end. It takes the signed-in half of today's account screen.
- **Builds without accounts** (production today) have no avatar and no Profile, as they have no
  account button now: their code stays out of the bundle (`scripts/check-bundle.ts`), and Forget me
  stays in settings (ADR 0078).
- **Sign-in** stays its own screen at `?view=signin`, opened from the avatar, Profile and Friends;
  Google's return to `?view=signin&google=…` is unchanged (its redirect URIs are exact). After a
  sign-in the player lands on the Friends tab.
- **The gear** stays one per screen, top right (ADR 0040). On the Play tab in the beside layout it
  sits at the top of the panel beside the court.

### Friends, guests and accounts off

- **Signed in to an account**, in this order: Waiting for you (a friend's challenges with Accept and
  No thanks; friend requests with Accept and Decline), the friends list (status as today: Online, In
  a match, Offline; Challenge on an online friend; Remove, asked in place), your code with Copy and
  the Add field (and the requests you sent, with Cancel), then "Play a friend with a link". **With no
  friends, the link card comes first**, then Waiting for you, then your code and Add.
- **Guests are never walled off.** A guest can challenge a friend with a link today, so the guest's
  Friends tab leads with "Play a friend with a link", then a card of what signing in unlocks (your
  own friend code, seeing who is online, challenges that reach you anywhere) with Sign in.
- **Accounts off** (an online build without `ACCOUNTS_BUILD`): the link card, then "Friends lists are
  on the way", with no Sign in and no account code in the bundle.

### The status strip, the badge and the pop-up

- **The status strip** sits on the Play tab above the chooser: "2 friends online · 1 challenge
  waiting", leading to the Friends tab. What is waiting comes first. **It hides when it has nothing
  to show** (never "0 friends online"), for guests and with accounts off.
- **The badge** on the Friends tab counts what waits on the player (challenges and friend requests),
  with the count in the tab's accessible name ("Friends, 2 waiting"); it shows nothing at zero.
- **The challenge pop-up** is today's floating card (one look, ADR 0070, `rematch-notice.ts`), sitting
  above the tab bar. **It never shows during a fight or a lineup pick** (a series or live lineup, a
  start's lineup, a coin toss): it waits until the match is over. **Ignored, it folds back into the
  badge**: closed by the player, or after 20 s without an answer, it goes and does not come back for
  that challenge on this page; the challenge stays in Waiting for you and on the badge. A rematch's
  card keeps its own rules and clock (ADR 0070).

### Back with tabs

Play is the root. Any other tab is one step above Play: moving between the other tabs replaces that
step, Back from any of them goes to Play, and Back from Play leaves the game. Screens opened from a
tab (a ball's page, Profile, a setup) stack on it as today. Screens still move only with
`navigation.go`, which decides; each new screen gets a key in `screenKeyOf`, a flow in
`history-rules.test.ts` and a test for its link (rule 5, ADR 0025).

### Every URL keeps its meaning

`route.test.ts` keeps every link shape the game has ever written: `/`, `?view=modes` (home),
`?view=manual`, `?view=pick`, series links, replay links, `?view=send`, `?challenge=`, `?start=`,
`?online=` and `?view=signin`. The new screens are `?view=friends`, `?view=profile` and
`?view=ranks`; in a build without the tab, its URL opens home, as an online URL does in a build
without online play.

### Cost: no new endpoint and no new timer

- **The badge, the strip and the pop-up are three views of one answer**: the `/me/inbox` read that
  `inbox-watch.ts` already makes (`friends` with `status`, `requests`, `invites`), on the times it
  already keeps (`inbox-poll.ts`: on start, every 30 s while visible with something to watch, every
  2 s while something is expected, never while hidden). Its host is handed the whole answer instead
  of the friends alone.
- **The avatar and Profile** read the `/me` answer `who-am-i.ts` already asks for (only where the
  hint cookie or a remembered player says there may be one).
- **The Friends tab** reads `/me/friends` when it opens, as the account screen does; never on a timer.
- **Ranks and the stats card** read nothing. "Back to your match" keeps its own ask on the Play tab,
  unchanged.
- **Guests and accounts off**: the inbox is never read, so no strip, no badge, no calls.
- **Kept, not fixed with polling**: a player with no friends, requests or invites stops reading after
  the first answer (today's poll), so their first request shows when the page is next shown or
  reloaded.

The Supabase Realtime "poke" (ADR 0053) replaces the wait, not the read: the server broadcasts
"inbox moved" (no data) on the player's own channel after any change to it, the page calls
`poll.poke()`, and the 30 s timer becomes a slow safety read (messages sent while a socket is down
are lost, and a broadcast is at most once). It needs `connect-src` for the Supabase origin (in
`security-headers.ts` and `netlify.toml` together), the publishable key in the page, a way to
authorise a channel without a Supabase token in JavaScript (a short-lived token from our API, or an
unguessable per-player topic: a leak costs only a spare read), and a socket only while signed in and
visible (200 concurrent connections on the free plan). It is its own decision, on ADR 0053's trigger.

## Requirements from the mockup review

Each is part of this decision, with the test that holds it and the pull request it lands in.

1. **Room for the bar.** Every tab screen leaves room at its end for the tab bar and the phone's
   bottom safe area, so the last item is never under the bar. Test (PR 3, then each tab's PR): at
   390 × 664, scrolled to the end, the last friend row and the "Challenge with a link" button lie
   wholly above the bar.
2. **Ball names fit their tile.** A name never overflows or clips (the mockup's "Necromancer" did):
   it shrinks or wraps. Test (PR 3): every ball's tile at 375 px wide, its name's `scrollWidth`
   within its `clientWidth`.
3. **One chevron.** The status strip's arrow is the "›" our other links draw (`.text-link::after`),
   the same size and baseline, never a glyph of its own. Test (PR 7): `look-checks.ts` finds no
   second chevron rule.
4. **Play without scrolling.** At 390 × 664 the Play button is wholly visible without scrolling, with
   the tab bar showing; the demo court shrinks to make room. Test (PR 4): the `safari` project's home
   flow, Play's bottom above the bar's top.
5. **Friends tab order.** As above: Waiting for you, the friends list, your code and Add, play with a
   link; with no friends, the link card first. Test (PR 6): the order of the sections in both cases.
6. **The strip hides when empty.** Never "0 friends online"; hidden for guests and with accounts off.
   Test (PR 7): an inbox with nobody online and nothing waiting shows no strip, and a guest page
   makes no inbox read.
7. **The pop-up waits and folds.** Never during a fight or a lineup pick; shown once it is over;
   ignored, it folds back into the badge. Test (PR 7): a challenge arriving during a lineup shows only
   after it, and the card gone after 20 s leaves the badge counting it.

## Consequences

- Home stops growing: ranked play, a leaderboard and a shop each have a place.
- 25 test files name home's controls or words today; the build changes them screen by screen, keeping
  accessible names ("Play", "Rematch", "Accept") where they still fit. Only CI runs the online flows,
  so each pull request greps `*.online.test.ts` before renaming anything.
- The rail holds four tabs at 667 × 320 (an avatar and four 56 px tabs, 276 px); a fifth needs 48 px
  tabs there, or the avatar in the panel. That is part of Shop's decision.
- A friend's challenge on a second device, or a second tab, stays up there until its next read after
  it was answered here; the server already refuses the second Accept, so it needs words ("Already
  answered"), not a lock.

## Build plan

Each pull request ships on its own and leaves the game whole; each ticks off its rows in the
checklist.

1. This record and the checklist.
2. The tab routes, with no links yet: `friends`, `profile`, `ranks` in `Route`, `screenKeyOf`, the
   tab Back rule (`route.test.ts`, `history-rules.test.ts`, `navigation.test.ts`, `no-dead-end.test.ts`).
3. The tab bar and rail on home and the manual (requirements 1 and 2; `layout-queries.test.ts`,
   `one-of-each.test.ts`, `press.test.ts`, the bar hidden in every fight state in
   `phone-arena-flow.ts`, all seven browser projects).
4. The Play tab: the chooser, Play, the quiet links; the cards and the manual link go (requirement 4;
   `modes.test.ts`, `modes-text.test.ts`, the `home-play.*` and `home-resume` flows, `beside-walk`,
   `landscape`, `small-landscape`, `settings`).
5. The avatar and Profile, replacing the account button and the signed-in account screen
   (`account-look.test.ts` with the grapheme initial, `log-out.test.ts`, `forget-me-host.test.ts`,
   `sign-in.browser.test.ts`, `legal-pages.test.ts`).
6. The Friends tab (requirement 5; `friends-section.browser.test.ts`, `friends-text.test.ts`, the
   online `friend-challenge` and `lineups-together` flows).
7. The badge, the strip and the pop-up above the bar (requirements 3, 6 and 7;
   `inbox-watch.browser.test.ts`, `inbox-poll.test.ts` unchanged, `rematch-watch.browser.test.ts`).
8. The end screen: Rematch, Change balls and Home against the bot; Rematch and Home online, where a
   rematch already opens new lineups (ADR 0080) (`series-view.test.ts`, `no-dead-end.test.ts`,
   `best-of-5-flow`, the online `rematch-anywhere` and `live-match` flows).
9. The Ranks placeholder, in accounts builds only.
