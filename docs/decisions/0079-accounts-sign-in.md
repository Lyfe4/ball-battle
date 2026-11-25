# 0079: Accounts: sign in with Google or an email code, linking the guest

- Status: Accepted (2026-11-22). Built: PR (a), the switch and both sign-ins; PR (b), usernames,
  Log out and Delete account; PR (c), friends, and PR (d), the inbox, status and challenging a
  friend (addenda of 2026-11-23)
- Date: 2026-11-22
- Amends: ADR 0052 §2 (accounts are slice 2: how they are built), ADR 0069 (the privacy policy
  names what an account stores), ADR 0068 (the sweep keeps accounts for 24 months)
- Builds on: `docs/accounts-and-friends-proposal.md` (approved in direction 2026-11-22, with its
  spike against Supabase Auth v2.197.0), changed as below
- Amended by: ADR 0081 (the account screen becomes Profile and the Friends tab; a friend's challenge card folds into a badge)
- Amended by: ADR 0082 (the inbox on pokes with a slow safety read; Auth hooks refuse what we didn't start)
- Amended by: ADR 0086 (the addendum of 2026-11-25: a friend's or a request's More, Report and Block move into the person's sheet, one level deep and confirmed)

## Context

Online play has guests only: an anonymous Supabase user behind the `__Host-bb_session` cookie.
Friends, usernames and ranked play need a player who can come back on another device. ADR 0052
planned Google and a 6-digit email code, linking the guest to the same user id and merging
nothing.

## Decision

**One switch.** Accounts are `BALLBATTLE_ACCOUNTS=1`, read by the functions (`Config.accounts`,
only with online play on) and built into the page as `VITE_ACCOUNTS` (`ACCOUNTS_BUILD`, dead code
otherwise; `check-bundle.ts` refuses the sign-in routes in a build without it). Off in
production. Off, every `/api/v1/auth/*` route answers 404 `accounts_off` and guests are exactly as
before.

**Google, through our own callback.** `GET /auth/google` makes a `state`, a PKCE verifier and a
`nonce` (32 random bytes each) and keeps them in `__Host-bb_oauth`: HttpOnly, signed, 10 minutes,
one use (cleared on every outcome of the callback). The callback checks the state in constant
time, exchanges the code with the verifier, checks the ID token's nonce itself, then calls Auth's
`grant_type=id_token` with the raw nonce and Google's `access_token`, adding `link_identity` and
the guest's bearer for a guest. The ID token never leaves the function. Each of the three checks
has a test shown failing without it.

- Not Supabase's hosted redirect: Google's consent screen would name `<ref>.supabase.co`, and the
  ID-token path is the one the app will use.
- Redirect URIs are exact, so Google is offered only where `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` are set: locally and the main branch deploy (staging), never a deploy
  preview. `GET /auth/options` tells the page; without Google it says "Google sign-in works on the
  main test site".

**An email code.** `POST /auth/email` always answers "We sent a code". For a guest it is Auth's
email change (`PUT /user`); an email that already has an account falls back to `/otp` with
`create_user:false`; a device without a guest asks the 16+ question and uses `/otp`. Which path
it took lives in a signed 10-minute cookie, never in the answer. `POST /auth/email/verify` checks
the code.

**Linking keeps the user id.** History, open series and rematches stay. An email or a Google
account that already has an account asks "Switch to it?"; switching deletes the guest as Forget me
does. Nothing is merged. The other account's session waits in `__Host-bb_pending` (signed, 10
minutes) until the player chooses.

**Rules read `profiles.account_at`,** written by the server when an account is made or linked,
never `is_anonymous` from a token: a copy of the guest's old token stays valid for up to an hour.

**Never during a live match or lobby.** Every start and finish of a sign-in refuses `409
in_a_match` under the player's advisory lock (`checkNotLive`), before any cookie changes. The
player's own live match is settled first (ADR 0053's settle on read, `whileNotLive`): one both
players left, and nobody has read since, is forfeited by its clock there, not counted as still
going (staging found an abandoned match blocking sign-in and Log out).

**Email codes and Resend Free's caps.** Counted in `game.rate_limits` before Auth is called, each
subject an HMAC (as `ipSubject`):

| What                   | Limit                            |
| ---------------------- | -------------------------------- |
| Codes to one address   | 3 an hour, 5 a day               |
| Codes from one network | 10 an hour, 20 a day             |
| Codes by one guest     | 5 an hour                        |
| Tries at one code      | 5, then "send a new one"         |
| Tries for one address  | 10 an hour                       |
| Tries from one network | 50 per 10 minutes                |
| All of us              | 90 a day, 2,700 a calendar month |

- The global caps answer `503 email_busy`, the same words for everyone; Auth refusing to send maps
  to the same. Google is never capped. `BALLBATTLE_EMAIL_CODES=off` switches email codes off.
- **Changed from the proposal: no split of the daily budget** between new sign-ups and returning
  accounts. Once a new-sign-up share ran out, a known email would still get a code and a new one
  would not, which tells anyone which emails have accounts. It also needed a third bucket and a
  path-dependent check.
- `/api/v1/health` gains `emailCodes`: `ok`, `near` (70 a day or 2,200 a month), `full` or `off`,
  without changing its status. The daily workflow fails past 2,200 codes in the month.

**Accounts are kept 24 months unseen**, guests 90 days, by the same sweep.

**Usernames (PR (b)).** An account may choose one; a guest stays "Player 1234". `profiles.username`
keeps it as typed, unique by a `lower(username)` index (no `citext` extension), with a check on
the column for the format: letters a-z in either case, digits and `_`, 3 to 15 characters, said
in exactly those words (`USERNAME_RULE`) to anything else. The name everyone sees is
`coalesce(username, display_name)`, read where a name was read before: the live link, a series'
names, the list, `/me`.

- Chosen right after a sign-in, when the account has none: once, with Skip for now. The sign-in
  screen, reached from settings' Your account, shows it afterwards with Change username.
- One change per 30 days by the database's `now()` (`username_set_at`); the same name again is no
  change. A name given up is free at once. Two claims of one name at once: the index decides,
  the other gets `username_taken`.
- A blocklist with no dependency (`username-words.ts`, `username-rules.ts`): words found anywhere
  in a name, and short ones only as a whole part (split at `_` and before a capital), read after
  folding case, digits as letters (1 as i and as l), `_` between letters and a letter held down
  (three in a row: "boot" is not "bot"). So "glass", "therapist" and "Kirk" pass and "sh1t",
  "a55" and "BigAss" don't. The owner clears a name in SQL.
- **Changed after testing on staging (2026-11-22):** our own list was too thin ("bumhole" passed). It now adds
  an open list as data, LDNOOBW's English list (`username-words-ldnoobw.ts`, Creative Commons
  Attribution 4.0, credited in the file, entries unchanged): words of 5 letters or more anywhere,
  shorter ones as a whole part, and a few that hide in ordinary words ("therapist", "basement",
  "Montenegro") as a whole part only. Ours adds anatomy compounds and the slurs it lacks. Names
  that could pass for a guest or the game are refused: anything starting "player", and bot,
  admin, mod, ballbattle, support and system (as a part of a name, in any case).
- **A report button is likely needed later.** No list catches every name: once players can find
  each other (friends, PR (d)), a "Report this name" that queues it for the owner beats a longer
  list.
- Checked on the server only: the page sends what was typed and shows the answer under the field.
- **No "is it free?" check while typing** (changed from the proposal's `GET ?check=`): saving is
  the check, and every try counts first, 20 an hour per account and 100 per network, so "taken"
  can't list who plays.

**Log out and Delete account (PR (b)).** Settings' Online group, for an account: Your account, Log
out and Delete account (Forget me's request and in-place question, in an account's words: its
username and games go with it; finished matches stay in opponents' history as "Deleted player").
Log out is `DELETE /session` as before, refused `409 in_a_match` during the account's live match
or lobby, which it would lose; then the device forgets every `ballbattle.*` key, as Forget me does.

**/health and sign-in's settings (PR (b)).** Sign-in's own settings, `auth_email_confirmations` and
`auth_google`, are `"accounts": "ok" | "misconfigured" | "off"` (with `accountsFailed` naming
them), never a 503: a sign-in setting must not make the game look down to UptimeRobot or hold up
the vs Friend switch or Publish. Confirm email off is still serious (a guest could take any
address), so: `friend-switch.ts on --accounts` fails after its deploy unless `accounts` is `ok`,
and UptimeRobot gets a keyword monitor for `"accounts":"ok"` beside the one for
`"emailCodes":"ok"` (production reads `off` until accounts ship; add the monitor then).

**No new dependency.** PKCE, the signed cookies and the nonce use Web Crypto; `jose` (already
here) decodes the ID token.

## Consequences

- Each environment with accounts needs: Supabase Auth's Google provider (the client id, nonce
  check on), "Confirm email" on (`/health` says `"accounts":"misconfigured"` without it, naming
  `auth_email_confirmations`, and stays 200), its SMTP
  pointed at Resend with the hourly email limit at 100, OTP expiry 600 s, and the confirm signup,
  magic link and email change templates showing `{{ .Token }}` (`supabase/templates/code.html`).
  Manual linking stays off. Resend's domain is `play.calvinrdevelopment.com` (DNS in Netlify):
  the DKIM TXT, the two CNAMEs and the DMARC `p=none` record Resend lists, all as Resend gives them.
- **A known timing leak.** For a guest, an address that already has an account takes two Auth
  calls (the email change refused, then `/otp`) where a new one takes one, so "We sent a code"
  comes back a little later (about one round trip to Auth). Someone timing many requests could
  guess which emails have accounts. Accepted for now: the per-address, per-guest and per-network
  limits cap how many addresses one person can try (20 a day per network), and Google sign-in
  leaks nothing. If it matters later, the fix is to answer before Auth is called (send in the
  background) or to pad the fast path.
- Deploy previews can test email codes but not Google.
- **Before accounts are switched on in production** (`friend-switch.ts on --accounts`), in this
  order, each its own pull request where it changes the repository:
  - **Update the privacy policy** (`privacy.html`, ADR 0069) and its date: Log out and Delete
    account now live on Profile (ADR 0081), and so does a guest's Forget me in a build with
    accounts. "Deleting your data" says to use Forget me "in the game's settings" and that,
    signed in, "the same button is Delete account": true only while accounts are off.
  - Every setting in the list above, on production's project; `/health` reads `"accounts":"ok"`.
  - UptimeRobot's keyword monitor for `"accounts":"ok"` (above).
- Slice 1 (this and PR (b)) reaches production only together with friends.
- **Staying signed in** (checked 2026-11-22). The session cookie lasts 400 days (Chrome's most),
  renewed at each hourly refresh; refresh tokens don't expire (no time-box on the Free plan), and
  Safari's 7-day limit doesn't reach an HttpOnly cookie its own site set. So only the sweep ends a
  quiet device's session: a guest after 90 days unseen, an account after 24 months.
  - **The refresh token reuse interval is 300 s**, Supabase's most (its default is 10 s), on
    staging and production and in `supabase/config.toml`. (Corrected 2026-11-22: this said an
    hour, 3600 s, but Supabase caps the setting at 300 s; both projects are set to 300.) A refresh
    whose answer never reached the phone (a dropped connection, a tab closed mid-request) left the
    cookie holding a used token; past 10 s Auth read its next use as theft and ended the session,
    losing a guest for good. Within the interval Auth answers with the session's current token
    instead. The cost: a stolen copy of an older cookie still works for 5 minutes after its
    refresh without ending the session. Our tokens never reach the page's JavaScript, so a thief
    needs the device or its cookie store, and holds the current cookie then anyway. Still
    uncovered: a device that comes back more than 5 minutes after such a refresh (a phone that
    lost signal mid-refresh and stayed off longer), which Supabase's cap leaves us no setting for.
  - **For the coming UX proposal: settings should read signed in or out from the server (`/me`),
    not `localStorage`.** Safari clears a site's script storage after 7 days without a visit, so
    `ballbattle.online.account` goes while the cookie stays: settings offer Sign in to a device
    still signed in (Sign in then finds it and recovers, after the 16+ question).
- Not taken: Realtime now, the hosted OAuth redirect, merging accounts, Unicode usernames, an
  export endpoint, the 60/30 split, a username check while typing.

## Addendum (2026-11-22): the account on home, settings for the device

The UX pass (proposal approved 2026-11-22) gave the player one place. Sign in, Your account, Log
out and Delete account sat in settings' Online group, so a per-device menu held the player's
identity, nothing on home said whether you were signed in, and settings decided it from
`localStorage`, which Safari clears after 7 days without a visit while the session cookie stays.

- **The account entry on home**, beside the gear (accounts builds only): a round sun-yellow button
  with the username's initial ("Your account, Sam_R") once signed in; a quiet "Sign in" pill for a
  guest or nobody (owner's decision: an unlabelled icon reads as "profile", not "sign in"). It
  opens the account screen (`?view=signin`). Home only; every other screen keeps one gear.
- **The account screen is the one place for the player.** Signed in: the username and Change,
  then Log out and Delete account as quiet actions at the card's end; Delete asks once in the
  card's place, Keep first. A guest: the ways in, then Forget me, asked the same way. Friends
  (PR (c)) join as a section of this screen, not a screen of their own, until the list needs
  search. vs Friend still allows guests (owner's decision): the friend you send a link to plays
  within a minute.
- **Settings are this device's alone**, in two headed groups: **Fights** (speed, sound) and
  **Tips** (Ability hints, What to watch cards, Show all tips again); Close alone at the end.
  Compact form unchanged. A build without accounts keeps Forget me in settings (ADR 0078: there is
  no account screen there).
- **Signed in is what `/me` says** (`who-am-i.ts`), read when home shows after a page load or
  after the account screen, and when the account screen opens; never polled, at most once per
  home in a tab. The device's keys are a cache it updates.
- **A hint cookie decides whether to ask.** `__Host-bb_player=1` (Secure, SameSite=Lax, not
  HttpOnly, 400 days) holds nothing but "this device has a player". The server sets and clears it
  with the session cookie in one place (`withPlayerHint`, `http.ts`), and every `/me` read sets it
  again, so a device signed in before it existed gets it on its first read. A device with neither
  the hint nor a remembered player asks nothing: a first visit costs no function call. Set by the
  server, so Safari's 7-day cap on script storage doesn't reach it. The privacy policy names it.
- **A neutral face when `/me` can't say.** Offline, timed out or failing, the button shows a plain
  head and shoulders named "Your account", never "Sign in" to a player who may be signed in; the
  next home asks again. The account screen then falls back to the device's keys, as before.

Real use: a family iPad shows whose account it is before anyone plays online, and Log out is one
tap from home; a player on a train with no signal sees the face, and home and Play work; Safari
after 8 days: `/me` says signed in, so no false Sign in and no 16+ question.

Library and platform behaviour relied on: `document.cookie` lists only cookies the page may read
(the session stays HttpOnly); a `__Host-` cookie needs Secure, `Path=/` and no Domain, as the
session cookie already does (so `netlify dev` on localhost behaves as it does for the session);
Safari's ITP caps cookies set by
script at 7 days but not ones the site's own server set; `Set-Cookie` headers are appended in
order, so a later clear wins over an earlier set.

Tests: `who-am-i.test.ts` (no request without the hint or a remembered player, `/me` over the
keys, 401 clears them, a failure keeps them and is unknown), `account-look.test.ts` (initial,
Sign in, the face), `cookie.test.ts` (the hint follows the session, the page reads what the server
sets), `sign-in.browser.test.ts` (a wiped device shown its account, Delete asked once, a guest's
Forget me, no request on a first visit; seen failing without the `/me` read), `settings.browser`
(the two groups; seen failing on the old menu), and `sign-in.online.test.ts` (Log out and Delete
account from home's account button, Sign in shown after).

## Addendum (2026-11-23): friends (PR (c))

Accounts add each other and answer requests from a **Friends section of the account screen** (as
approved: a section, not a screen of its own), under the signed-in card: your friend code with
Copy, a field to add by username or friend code, then Requests (Accept, Decline), Your friends
(Remove, asked once in place, Keep first) and Sent (Cancel). Every change answers with the whole
list. A guest sees no section (it is the sign-in screen) and every friends route answers
`403 not_an_account`; with accounts off they answer `accounts_off`.

- **Schema** (`20261123090000_friends.sql`, expand only): `profiles.friend_code` (8 Crockford
  base32 characters, unique, made the first time the account opens its friends) and
  `game.friendships`, one row per pair (`low < high`): who asked, when, accepted, declined, and
  `withdrawn_at`. A row has its own `id`, which the page uses: no player's user id leaves the
  server. Deleting either profile deletes the row.
- **Routes**: `GET /friends`, `POST /friends {to}`, `POST /friends/:id/accept`,
  `DELETE /friends/:id` (remove a friend, cancel a request, or decline one). Rules in
  `friends.ts`, SQL in `db/friends.ts`.
- **One row decides races.** A double tap, two taps at once, and two requests between the same
  pair at once (one each way) all meet on the pair's row (`insert ... on conflict do nothing`, then
  the row read `for update`). Asking someone who had asked you makes you friends.
- **Lookups can't list who plays.** A request names one exact username (ignoring case) or one
  code (typed in any case, with a dash or spaces, I and L read as 1 and O as 0). Every request is
  counted before the lookup: 30 an hour per account and 300 per network (a class adding each
  other fits). Only accounts are found. Usernames are public in matches already; "no account has
  that name" at 30 an hour is no faster than watching matches.
- **Spam.** 20 new requests a day per account (answering one never counts), at most 50 waiting
  out per account and 100 waiting in, 200 friends.
- **A decline stops repeats.** It keeps the row 30 days (`DECLINE_DAYS`), and to its sender it
  still reads as sent: sending it again does nothing and tells them nothing. Cancelling a declined
  request hides it from the sender (`withdrawn_at`) but keeps the row, so cancel-and-resend can't
  get round it. The one who declined may still ask, which makes them friends (the other wanted
  it). The sweep drops declines after 30 days. **Not built: a permanent block.** Decline covers 30
  days; a block (and the "Report this name" button above) should come with PR (d) or before
  friends ship, once real use shows whether 30 days is enough.
- **Privacy**: the policy names the friend code, friendships and requests (with the 30 days a
  decline is kept) and the new counts; dated 23 November 2026.
- **Bundle**: a path starting `friends` is accounts' code (`ACCOUNTS_MARK`); the section is made
  only where `ACCOUNTS_BUILD`.

Real use: two friends on one school network add each other by typing a username they read off a
match (no code needed); someone mistypes a name three times (3 of 30 lookups); a stranger who keeps
re-adding after a decline sees "Request sent" and reaches nobody for 30 days.

Library behaviour relied on: Postgres `insert ... on conflict do nothing` waits for a concurrent
insert of the same key to commit, then does nothing, and a later statement in the same READ
COMMITTED transaction sees the committed row; `select ... for update` locks the row until commit;
postgres.js nests a fragment (a tagged `db` query) inside a query; `crypto.getRandomValues` byte `% 32` is
uniform (256 is a multiple of 32).

Tests: `friends.db.test.ts` (guests refused and never found, accounts off, the code made once, by
username in any case and by a typed code, no user id in any answer, an unknown name and yourself,
a double tap and two taps at once, both asking at once, accept, decline and its 30 days, cancel
and remove, another pair's row untouched, each limit, a deleted account's rows gone; the decline
test seen failing with the block switched off), `friends-section.browser.test.ts`, unit tests of
the code and words, `legal-pages.test.ts`, `check-bundle.test.ts`, and `friends.online.test.ts`
(two phones signed in with email codes; one adds the other by username, the other accepts).

## Addendum (2026-11-23): the inbox, status and challenging a friend (PR (d))

- **`GET /me/inbox`**, accounts only: each accepted friend with a status, how many requests wait,
  and live challenges friends sent the player that still wait. A complete, idempotent read (no
  ETag yet: the answer is small and `no-store`). `/me/match` stays as it is for home's Back to
  your match.
- **The poll** (`inbox-poll.ts`): read once when home learns the device is an account (`/me`),
  then every 30 s while the page is visible and the last answer had a friend, a waiting request or
  an invite; none while hidden, one at once on return, none after sign-out, and a poke after any
  change made in the Friends section. Only the wait lives there: a Supabase Realtime "poke" later
  calls `poke` on each message and keeps a slow safety read; the read and screens don't change.
  An account without friends costs one read per page load.
- **Status**, decided in one SQL statement joined on accepted friendships only (a stranger, a
  request or a removed friend learns nothing): **in a match** (an open live series they are still
  heard from on within the away and grace times, or a lobby waiting), else **online** (a request of
  theirs within 75 s: `profiles.active_at`, written by `profileOf` at most every 30 s, accounts
  only), else **offline**. Changed from the proposal: "in a match" needs fresh presence, so an
  abandoned series that nothing has settled (staging never sweeps) doesn't read as in a match.
  Shown as a dot and words on each friend's row (Online, In a match, Offline).
- **Challenge** on each friend's row: the vs Friend setup, then the lineup; Send challenge sends
  an ordinary live link that also names the friend (`challenges.invitee`, `POST /challenges` with
  `friend: <friendship id>`; only an accepted friend of an account, live only). The lobby says
  "Waiting for Sam_R" and keeps the link and Share as the fallback. The friend being challenged is
  held by the challenge screens until it is sent or the player leaves them.
- **The friend's card**: the rematch's floating card (`rematch-notice.ts`, a new `invite` kind,
  named "Challenge"), "Sam_R challenges you · Best of 3 · Reveal · live" with Accept and No thanks,
  on any calm screen and never over a fight (it waits, as the rematch card does). Accept reads the
  challenge and goes straight to its lineup (its card if it was taken or stopped meanwhile). No
  thanks is `POST /challenges/:token/decline` (the invitee only): it leaves their inbox and the
  sender's lobby reads "Sam_R said no thanks", the link still working for anyone else.
- **Privacy**: the policy names `active_at` (who sees it, the 75 s) and who a challenge was sent
  to; `legal-pages.test.ts` reads the 75 s against `ONLINE_MS`.

Real use: two friends on phones, one on home and one challenging: the card arrives within 30 s
(the poll), so a friend who says "I'll send it" still sees it without a message; a phone in a
pocket (hidden) reads nothing and its friends see it offline after 75 s; a friend in a live match
gets the card only after the fight on screen ends. iOS backgrounding means a closed or hidden page
gets nothing until it shows again (push needs the app).

Library behaviour relied on: `document.hidden` and `visibilitychange` (a hidden tab is also
throttled, so no timer is relied on there); Postgres `exists` with correlated subqueries per
friend row; `make_interval(secs => ...)` with the database's `now()` for every time.

Tests: `inbox.db.test.ts` (accounts only; status for accepted friends only, not a stranger, a
request either way or a removed friend, seen failing without the accepted-only join; online from
the friend's own requests and offline after 75 s; a guest never marked active; in a match while
playing or in a lobby, not once away past the grace; a challenge in the friend's inbox, the lobby
naming them to the sender only, No thanks by them alone, gone once the sender stops waiting; only
a friend, from an account, live), `inbox-poll.test.ts` (fake timers: a read at the start, every
30 s while visible, none while hidden, one on return, idle without friends until poked, none
after sign-out), `inbox-watch.browser.test.ts` (the card's words, Accept to the lineup, No thanks,
held over a fight and seen failing without that hold, nothing read signed out),
`friends-section.browser.test.ts` (status words, the inbox's status taken, Challenge) and
`friend-challenge.online.test.ts` (two phones: the friend on home, the sender sees them online and
challenges them, the card arrives by the poll, Accept, a live match starts on both).

## Addendum (2026-11-23, later): the inbox from any screen, and quickly while news is expected

The owner, on staging with two signed-in phones: a friend's challenge showed only after opening
the account screen.

**Why.** The inbox poll started only from home's `/me` ask (`homeShown`). A page opened (or
reloaded) on any other screen, the manual for one, never read the inbox. Coming back to home from
the account screen asks `/me` again, which restarts the poll with a read at once: that read is
what brought the card, not the account screen.

**Decision.**

- `/me` is asked once the page loads, on whichever screen it opens (one read where the device may
  have a player, as before), so the inbox starts everywhere; the card still never covers a fight.
- **Quickly while something is expected** (`expecting`, `INBOX_EXPECTING_MS` = 2 s): a rematch of
  the last live match can still move (the rematch watch is on), or the player's lobby waits (each
  of its asks marks it for 5 s). Otherwise 30 s, and never while hidden. `quicken` cuts a running
  30 s wait to 2 s without a read, when the screen changes, a live match ends or the lobby asks.
  The rematch watch keeps its own 2 s away from the end screen (the end screen and the rematch's
  lineup ask every second), and now waits for the last fight's end instead of asking through it.

Cost in function calls per visible player per hour (a hidden page makes none):

| State                                                  | Inbox            | Other reads               |
| ------------------------------------------------------ | ---------------- | ------------------------- |
| Signed in, no friends                                  | 1 per page load  | `/me` once per page load  |
| Friends, nothing expected                              | 120 (every 30 s) |                           |
| A rematch window, away from the end screen (≤ 3.5 min) | 1,800 (2 s)      | rematch watch 1,800 (2 s) |
| On the end screen or the rematch lineup                | 1,800 (2 s)      | 3,600 (1 s)               |
| Waiting in the lobby                                   | 1,800 (2 s)      | lobby 1,800 (2 s)         |

A rematch window lasts at most 3.5 minutes from the last fight's end, so a match that ends adds at
most about 105 inbox reads; an idle hour with friends stays 120.

**What it doesn't fix.** A friend's challenge to someone who expects nothing still arrives with
the next 30 s read (15 s on average): nothing tells their page a challenge is coming before it
exists. That delay feeling slow is the trigger for the Realtime poke in "Moving off polling"
(`docs/accounts-and-friends-proposal.md`), and it has now been felt. The swap stays as planned:
`poke` on each message, `expecting` and both timers become the slow safety read.

**Tests.** `inbox-poll.test.ts`: every 2 s from the moment something is expected, none while
hidden, back to idle after; a 30 s wait cut to 2 s without a read (both failed before).
`friend-challenge.online.test.ts`: the friend's page opened on the manual gets the card and
accepts (failed against the build of `main`: no card in 40 s); the friend on home as before.

## Addendum (2026-11-25): blocking, reporting a name, a shared network's codes, the timing leak

The four items left before accounts go live in production (this ADR's "Not built: a permanent
block", "A report button is likely needed later" and "A known timing leak", and the per-network
code limit's effect on phone carriers).

**Blocking** (`blocks.ts`, `20261125090000_blocks_reports.sql`). From a friend's row, a request
to you, or a friend's challenge: More, then Block, asked in place under the row (Keep first).
Unblock is in the Friends tab's Blocked list, beside your code and Sent.

- **A block is the pair's friendship row kept for good** as the blocked player's request, declined
  by the blocker (`friendships.blocked_by`, checked: the row is then a declined request, never
  accepted). So every rule that keeps a decline from its sender already holds, and the sweep never
  drops it. To the blocked player it reads exactly as what they could already see: a request they
  sent and nobody answered (sending again "sends" it), or a friend who removed them. Nothing
  arrives: no request, no inbox count, no challenge (challenges need an accepted friend).
- **It ends the friendship and calls off what waits**, in one transaction: the blocker's own
  challenges to them are cancelled; theirs to the blocker read as No thanks (the answer any friend
  may give).
- **The blocker** can't send them a request (`409 friend_blocked`, "unblock them first"), nor
  accept one by its id. **Unblock** deletes the row: a clean slate, as if they had never met, so a
  request they "sent" while blocked never surfaces later.
- Considered: a `game.blocks` table beside friendships. Every rule that reads friendships would
  then need a second check, and a forgotten one is a leak; one column on the row the rules already
  read keeps "a no is never told" in one place.
- Not covered: a rematch right after a live match against someone you then block (a rematch needs
  a match that just ended, which a blocked player can only get through a link you accepted), and a
  live link shared outside the game.

**Report this name** (`game.name_reports`). From the same More: Report name, then why in one tap
(Rude or hurtful, Pretends to be someone, Something else).

- **Stored:** reporter, reported, the username as it was, the reason, the time. Kept 90 days by
  the sweep (`REPORT_DAYS`) and deleted with either account. The same name reported twice by one
  player is one report. Counted first: 10 a day per account (`LIMITS.nameReports`).
- **Hidden from the reporter** at once: `game.name_seen_by(viewer, ...)` shows them that player's
  "Player 1234" wherever the friends list, requests, statuses and a friend's challenge show a
  name, until the username changes. Other players still see it. Series and live-match names are
  read elsewhere and still show it (a live match is with someone you chose to play).
- **Reviewing:** `node scripts/reports.ts staging|production [--days n]`, read-only through the
  Supabase CLI: most reported first, the reasons, the name now and the player's id; reporters only
  counted. Clearing a name stays the SQL in "Usernames" above.
- A player with no username can't be reported (`nothing_to_report`): "Player 1234" is the game's.

**A shared network's email codes** (this ADR's table, changed). Behind a phone carrier's shared
address (CGNAT) or a school's, many players are one network; at 10 codes an hour and 20 a day, one
person asking again and again, or a class signing in, locked out everyone else there.

| What                         | Before                  | Now                                          |
| ---------------------------- | ----------------------- | -------------------------------------------- |
| Codes from one network       | 10 an hour, 20 a day    | **20 an hour, 40 a day different addresses** |
| All of us                    | 90 a day, 2,700 a month | the same, and **30 an hour**                 |
| To one address, by one guest | 3 an hour, 5 a day; 5   | unchanged                                    |

- **The network counts addresses, not codes:** only an address's first code in each window spends
  it (`spendAll` now answers each bucket's count). Asking again for your own slow email costs the
  network nothing; the address's own 3 an hour still applies.
- **The trade-off.** One network can now take 40 of the day's 90 codes rather than 20, so two
  abusive networks (not five) could use up a day's email codes for everyone. The new hourly cap
  means no burst takes more than a third of a day, so later hours still have codes, and Google
  sign-in is never capped. Bombing one inbox is still stopped by the per-address limits.
  Considered and not taken: no per-network limit at all (one script empties the day), and
  weighting by guest age (an attacker's guests can wait a day too, and it adds a read to every
  send).

**The timing leak** (closed). A guest's address with an account took two Auth calls where a new
one took one, and a new device's new address makes a user, so how long "We sent a code" took said
whether an address has an account. The Auth part of `POST /auth/email` (the ticket, the calls, any
refusal) now answers no sooner than `CODE_ANSWER_FLOOR_MS`, 2.5 s, on every path. Two calls from
Ohio to Sydney take about 1-1.5 s; a slower answer shows in the request log's `durationMs` for
`auth.email`, to tune the floor. Our own limits answer before it (they say nothing about
accounts), and the answer's words were already the same. Considered: answering first and sending
in the background (work after a function's answer isn't guaranteed on Netlify, and a bad address
could no longer be refused). A friend lookup's "No account has that username or friend code" stays:
usernames are public in every match, and a typo must say so.

Real use: a teen blocks a classmate who keeps challenging them; the classmate sees their request
"sent" and nothing else. Twenty players on one carrier sign in at lunch; one whose email was slow
taps Send again without costing the others. Someone timing `/auth/email` over a list of addresses
sees 2.5 s for every one.

Library behaviour relied on: Postgres checks a `CHECK` constraint per row on update (a block can't
be half-written); `least`/`greatest` order `uuid` values bytewise, the same order as their
lower-case text (`low < high` in TypeScript); Node's `setTimeout` waits at least its delay.

Tests: `blocks.db.test.ts` (a friend gone to them and blocked to me; a re-sent request reads as
sent and never arrives, past the 30 days and the sweep; a blocked request still reads as sent;
challenges called off both ways and no new one; `friend_blocked` until Unblock, which only the
blocker can do; a report stored once, hidden from the reporter alone, shown again on a new name,
from a request and a challenge; a bad reason, no username, the day's limit; 90 days and account
deletion; the re-send test seen failing with the block check off, the request-name test with
`name_seen_by` off), `email-limits.db.test.ts` (20 players behind one address get codes and a
re-send spends nothing, seen failing with codes counted; the hourly cap),
`email-sign-in.db.test.ts` (four paths each at least the floor and within 250 ms of each other,
seen failing without it), `friends-section.browser.test.ts` (More, Keep first, Block, Report,
Unblock), `scripts/reports.test.ts`, `legal-pages.test.ts`, `inbox.db.test.ts`.
