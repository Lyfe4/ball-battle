# App shell parity checklist (ADR 0081)

Everything home and the account screen do today (2026-11-23, `main` at f349248), so the move to tabs
drops nothing silently. Each build pull request ticks off the rows it moves (`[x]`, with the PR),
or marks a row dropped on purpose with its reason. "PR" is the build plan's number in ADR 0081.

## Home (`/`, `src/screens/home.ts`, `src/ui/home.ts`, `src/screens/online-mount.ts`)

The demo

- [x] The demo court behind the menu: a random first pair, then the counter map's lively pairs in
      order; not announced as counters (PR 4: unchanged, `src/screens/home.ts`)
- [x] "Demo match: A vs B" names the two balls (PR 4: under the court)
- [x] The next demo starts 2.5 s after a result shows; none is queued behind the next screen (PR 4:
      unchanged)
- [x] Reduced motion: each demo waits on a still frame, with "Watch the demo" to play it (PR 4:
      unchanged)
- [x] The demo is silent (ADR 0064) (PR 4: unchanged)

Title and Play

- [x] The title "BallBattle" and the pitch line (PR 4: the title row at the top of the page on a
      phone, the top of the panel beside; the pitch line on a desktop only, as beside already did)
- [x] Play starts the remembered bot series (format, length, level; first visit Best of 3 · Reveal
      · Normal), one tap to its lineup, its line saying what it plays (PR 4: with vs Bot chosen)
- [x] Play's spoken name says what it plays (`playSpoken`; against a friend `FRIEND_PLAY_SPOKEN`)
      (PR 4)
- [x] Play taps (`data-sound="tap"`) (PR 4)
- [x] Home focuses Play when it opens (PR 4: `play-chooser.browser.test.ts`)
- [x] A held series: Play becomes Resume series with its format and score; New series forgets it and
      opens Play's lineup (ADR 0042, 0046) (PR 4: with vs Bot chosen; vs Friend's Play is a friend
      match and New series steps aside)

Ways to play

- [x] vs Bot opens the bot setup on Play's choices (format, length) (PR 4: vs Bot in the chooser,
      then Change rules)
- [x] vs Friend (online builds only) opens the send screen, Reveal, Best of 3 (PR 4: vs Friend in
      the chooser, then Play; Change rules steps aside, as it would open the same screen)
- [x] Free play opens the quick-match pick on the pair the demo is showing (ADR 0020) (PR 4)
- [x] Ball manual opens the manual (PR 3: the Balls tab opens it, `tab-bar.browser.test.ts`; PR 4:
      home's link went)

The rest of home

- [x] The roster strip of every ball's drawing on a wide screen, named "N balls" (PR 4: kept on a
      desktop, under the quiet links)
- [x] Privacy and Terms as quiet links at the end (ADR 0069) (PR 4: the end of the Play tab; PR 5:
      Profile too)
- [x] One settings gear, at the top right of the title row (ADR 0040) (PR 3: unchanged beside the
      bar and rail)
- [x] Phone: the panel under the demo court; beside layout and desktop: beside it (ADR 0031, 0067)
      (PR 4; PR 3 kept it, the court yielding to the rail where the panel needs the room:
      `tab-rail.landscape-small.browser.test.ts`; PR 4: the title row above the court on a phone)
- [x] `?view=modes` opens home (PR 2: kept in every build, `route.test.ts`)

Online on home

- [ ] The account button beside the gear (accounts builds): the plain face while unknown, a "Sign in"
      pill for a guest or nobody, the initial once signed in; it opens the account screen (PR 5: the
      avatar)
- [ ] `/me` is asked once the page loads, on whichever screen it opens, and again on the next home
      after a sign-in, a log out or a new name; never polled (PR 5)
- [ ] An account starts the inbox watch; anything else stops it (PR 7)
- [x] "Back to your match" takes Play's place while a live match or lobby is on, asked again every
      10 s while it shows on home (ADR 0053) (PR 4: it takes the chooser's and Play's place)
- [x] "Back to your rematch" takes Play's place while a rematch waits on this player (ADR 0070); a
      match comes first (PR 4: as above)
- [ ] Builds without accounts: no account button, and Forget me in settings (ADR 0078) (PR 5)

## Links every build keeps (`src/app/route.ts`, `src/app/online-url.ts`)

- [x] `?challenge=`, `?start=`, `?online=` and `?view=send` open their screens in online builds and
      home without online play (PR 2: `route.test.ts`, `shell-routes*.browser.test.ts`)
- [x] `?view=signin`, and Google's return `?view=signin&google=…`, open sign-in with accounts and
      home without (PR 2: the same tests)
- [x] `?view=manual`, `?view=pick`, series and replay links open as before in every build (PR 2)

## The account screen (`?view=signin`, `src/screens/sign-in.ts`, accounts builds only)

Signing in

- [ ] A device without a guest is asked the 16+ question before signing in (PR 5)
- [ ] Sign in with an email code: the address, then "Check your email" and the code (PR 5)
- [ ] Sign in with Google, only where its client is set; it returns as `?view=signin&google=…`,
      read once and dropped from the address (PR 5; its return URL kept in PR 2,
      `shell-routes-accounts.browser.test.ts`)
- [ ] A guest links to the same player; an existing account is "Switch to it?", which deletes the
      guest (PR 5)
- [ ] No sign-in starts or finishes during a live match or lobby: the "already in a match" card, with
      a way to the match (PR 5)
- [ ] Sign-in off (`accounts_off`): "Sign-in isn't on here" (PR 5)
- [ ] The skeleton while it loads; failures say which (offline, timeout, server, refusal) with Try
      again (PR 5)
- [ ] The route is home in a build without accounts, and the account code is out of the bundle
      (`check-bundle.ts`) (PR 5)

Once signed in

- [ ] Straight after a sign-in, an account without a username is asked for one, once; Skip goes on
      (PR 5)
- [ ] "You're signed in", the username and Change your username; the server's words under the field;
      one change per 30 days (PR 5)
- [ ] Log out (PR 5)
- [ ] Delete account, asked first (PR 5)
- [ ] A guest's Forget me ("Delete your guest?") (PR 5)
- [ ] Back goes home (PR 5; PR 2 added the tab Back rule, the account screen's own Back unchanged)

The Friends section

- [ ] Your friend code with Copy (PR 6)
- [ ] Add a friend by username or code; "sent" or "friends" said under the field (PR 6)
- [ ] Requests waiting on you: Accept, Decline (PR 6)
- [ ] Your friends with their status (Online, In a match, Offline), Challenge, and Remove asked in
      place (PR 6)
- [ ] Requests you sent: Cancel (PR 6)
- [ ] No one yet: "No friends yet. Share your code, or add theirs." (PR 6)
- [ ] Every change answers with the whole list, drawn again; every server button busy through
      `busyOnClick` (PR 6)
- [ ] Statuses from each inbox read update the section while it shows (PR 6, PR 7)

## The inbox and the floating card (`src/screens/inbox-watch.ts`, `src/app/inbox-poll.ts`)

- [ ] The inbox is read on start, every 30 s while visible with something to watch, every 2 s while
      something is expected, never while hidden, at once when the page shows again; a change here
      pokes it (PR 7: unchanged)
- [ ] A friend's challenge shows as the floating card on any calm screen, never over a fight, where it
      waits (PR 7: also never over a lineup pick; folds into the badge)
- [ ] Accept goes straight to the lineup, busy until it is read; No thanks declines; a failure says
      why under the card (PR 7)
- [ ] A challenge answered here never shows again on this page; one the sender stopped is gone (PR 7)
- [ ] A rematch reaches the other player anywhere, as the same card (ADR 0070) (PR 7: unchanged)

## The end of a series (`src/ui/series-panel.ts`, `src/ui/series/series-view.ts`)

- [ ] Against the bot: Rematch (same setup, new seed) and New series (PR 8: Rematch, Change balls,
      Home)
- [ ] Online: Rematch ("Same friend, new lineups") and Home, or Rematch and No thanks to answer one
      (PR 8: unchanged)
- [ ] Copy link for a decided series (PR 8)
