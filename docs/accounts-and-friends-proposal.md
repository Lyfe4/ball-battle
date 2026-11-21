# Accounts and friends: proposal (revised 2026-11-22, approved in direction)

## Where things stand

1. Online play is live friend links in Reveal and Showdown, Bo3/Bo5. Every player is a Supabase
   anonymous user behind an HttpOnly `__Host-bb_session` cookie, named "Player 4821".
2. The functions (Ohio) own every rule; the database (Sydney) is reached only by `game_api`.
   Every route is `guard` then `sessionOf`, and rate limits are counted in Postgres.
3. vs Friend is behind one switch (ADR 0068), off in production. Forget me and the 90-day sweep
   work with the switch off (ADR 0078).
4. ADR 0052 already sketched accounts as "slice 2": Google plus a 6-digit email code, a guest
   links to the same user id, nothing merged, and Sign in with Apple when the app ships.
5. No account code exists yet.

## The design

### Sign-in (all through the functions; the browser still never talks to Supabase)

**Google**, a server-side code flow on _our_ callback:

1. `GET /api/v1/auth/google` makes three random values:
   - `state` (32 bytes);
   - a PKCE `verifier` (32 bytes, S256 challenge);
   - a `nonce` (32 bytes).

   They go in a 10-minute `__Host-bb_oauth` cookie (HttpOnly, Secure, SameSite=Lax), with
   `mode=link|signin`. The redirect to Google asks for scope `openid email` and carries `state`,
   the challenge and `sha256hex(nonce)`.

2. `GET /api/v1/auth/google/callback` checks, in order:
   - **state:** the query's `state` equals the cookie's, compared in constant time. Otherwise it
     refuses and clears the cookie (stops login CSRF). Missing, expired or reused cookie: refuse.
   - **PKCE:** the code is exchanged at Google with the cookie's `verifier`. A code stolen without
     the verifier is useless.
   - **nonce:** our own check that the ID token's `nonce` is `sha256hex(nonce)`, then the raw nonce
     goes to Supabase, which checks the same (stops a replayed ID token).

   Then it calls `POST /auth/v1/token?grant_type=id_token` with
   `{provider:'google', id_token, nonce}`. For a guest it also sends `link_identity:true` and the
   guest's access token as `Authorization: Bearer`. Spike result below.
   - The cookie is cleared on every outcome, so it is one use.
   - Why not Supabase's hosted redirect: Google's consent screen would name
     `<ref>.supabase.co`. The ID-token path is also what the native app sends later
     (`POST /session/id-token`, Apple too).

**Email code:**

- `POST /api/v1/auth/email {email}` always answers "We sent a code".
  - For a guest it triggers Auth's email change (`PUT /auth/v1/user`; the code is `{{ .Token }}`
    in that template).
  - If the email already has an account, it falls back to `POST /auth/v1/otp` with
    `create_user:false`, so the answer never says whether an account exists.
- `POST /api/v1/auth/email/verify {code}` reads the email and the path from a 10-minute signed
  cookie. Codes expire after 10 minutes.

**Upgrade = link, same user id**, so history, open series and rematches stay.

- When the identity already belongs to another account: "This email already has an account.
  Switch to it?" That covers:
  - Google `identity_already_exists`;
  - Google `email_exists`: its email is on an email-code account. Signing in with Google then
    joins that account by verified email;
  - the email fallback.
- Switching sets that account's cookie and deletes the now-unreachable guest, as Forget me does.
  Nothing is merged.
- **Never during a live match or lobby:** every sign-in, link and switch route refuses
  `409 in_a_match`, "Finish or leave your match first, then sign in". It checks when the flow
  starts and again at its end, under the player's existing advisory lock (`in_a_match`), before
  any cookie changes. A Google callback refused this way lands on the sign-in screen with that
  message; nothing reaches Supabase.

**Everything else:**

- **A new device with no guest** signs straight in. A first-time account answers the same 16+
  question.
- **Logout** (`DELETE /session`, exists) and **Delete account** (`DELETE /me`, exists;
  friendships cascade). No export endpoint: requests by email (already in privacy.html) cover
  access.
- **Guests are untouched:** same cookie, same routes, same 90-day sweep. The sweep skips
  accounts, and accounts are deleted after **24 months** unseen.

### Email abuse and Resend Free's caps

Mail goes through Resend Free (100 a day, 3,000 a month, one domain) from a subdomain of
`calvinrdevelopment.com`:

- the subdomain (e.g. `play.calvinrdevelopment.com`) has its own SPF and DKIM, so a bad day can't
  hurt the main domain's reputation;
- Supabase Auth's SMTP settings point at Resend.

Our own limits are counted before Auth is called, in `game.rate_limits`. Each subject is an HMAC
under the server key (as `ipSubject`), never the address.

| What                         | Limit                                                                 | The player reads                                                    |
| ---------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Codes sent to one email      | 3 an hour, 10 a day                                                   | "We've sent a few codes to that address: try again in 40 min"       |
| Codes sent from one network  | 30 an hour (a class fits), 100 a day                                  | "Lots of sign-ins on this network: try again in 12 min"             |
| Codes sent by one guest      | 5 an hour                                                             | as per email                                                        |
| Resend again                 | 60 s after the last (the button counts down; Auth also enforces 60 s) | the countdown                                                       |
| Wrong codes for one email    | 5 per code, then the code is dead and a new one is needed; 10 an hour | "That code has expired: send a new one"                             |
| Wrong codes from one network | 50 per 10 min                                                         | "Too many tries: wait a little"                                     |
| **All of us, a day**         | **90** (Resend's 100 less a margin)                                   | "Email codes are busy today: continue with Google, or try tomorrow" |
| **All of us, a month**       | **2,700** (of 3,000)                                                  | the same, "try again next month"                                    |

- The two "all of us" buckets are global subjects in `rate_limits`, refused before Auth is called.
  The player gets a clear `503 email_busy`, not a mail error. Google is untouched by them.
- Passing 70 a day reports to Sentry once, so we hear before players do.
- If Resend still refuses (or Auth's own hourly cap, raised to 100 in the dashboard, trips), Auth's
  error maps to the same `email_busy`.
- Supabase's "identity linked" notification emails stay off: they would spend the quota.

### Schema (expand-only migrations)

- **`profiles` gets new columns:**
  - `account_at`;
  - `username citext unique`, `username_set_at`;
  - `friend_code text unique` (8 Crockford base32 characters, which can be regenerated);
  - `active_at` (written by `sessionOf` at most every 30 s, in the statement that already marks
    `last_seen_at`).
- **`friendships`:** `(low, high, requested_by, created_at, accepted_at, declined_at)`, primary key
  `(low, high)`, cascading from `profiles`.
  - One row per pair, so a double tap is idempotent.
  - When both players request each other, the second request accepts.
  - A decline is kept 30 days to stop re-sends.
- **`challenges.invitee`, `declined_at`:** a friend challenge is a normal live link that also names
  who sees it in their inbox.
- Ratings, wallet, unlocks and a ledger later become their own tables keyed by
  `profiles.user_id`; nothing here blocks them.

### API routes (thin; rules in services, SQL in `db/`)

| Route                                             | Does                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `GET auth/google`, `GET auth/google/callback`     | Google sign-in or link                                                  |
| `POST auth/email`, `POST auth/email/verify`       | Email code                                                              |
| `POST auth/switch`                                | Take the pending existing account, delete the guest                     |
| `GET /me` (extended)                              | `{ name, account, username?, friendCode? }`                             |
| `PUT /me/username`, `GET /me/username?check=`     | Choose a username; check one while typing                               |
| `GET /friends`                                    | Friends with status, requests in and out                                |
| `POST /friends {username or code}`                | Request (or accept, when they had asked you)                            |
| `POST /friends/:id/accept`, `DELETE /friends/:id` | Accept; decline, cancel or remove                                       |
| `POST /friends/:id/challenge`                     | Live challenge to that friend (`createChallenge` + invitee)             |
| `GET /me/inbox`                                   | Invites, requests, friends' status, current match (absorbs `/me/match`) |
| `POST /challenges/:token/decline`                 | Invitee says no; the sender's lobby says so                             |

**Status**, decided in SQL, for accepted friends only:

- _in a match_: an open live series or lobby;
- _online_: `active_at` within 75 s;
- _offline_: anything else.

**Usernames are ASCII only, and the screen says so plainly:** "Letters a–z, numbers and _ only,
3–15 characters". Other scripts and accents are refused with that sentence, never a vague
"invalid".

- Case-insensitive. Set once, then one change per 30 days.
- Checked against a reserved list and our own blocklist after folding leetspeak; the owner can
  clear a name in SQL.

### Screens (phone first)

- **Sign in:** "Continue with Google" and "Email me a code", then the code screen with a 60 s
  Resend. In an in-app browser (detected from the user agent) Google becomes "Open in
  Safari/Chrome to use Google", and email stays.
- **Choose a username:** straight after the first sign-in.
- **Friends:**
  - your username and friend code (Copy / Share link);
  - add by either;
  - requests;
  - the list with a status dot plus words and Challenge ("Send link" for offline friends).
- **Invite card:** the rematch card's look (ADR 0070), any screen but a fight. **Sender's lobby:**
  "Waiting for sam", with the link still there as the fallback.

## Abuse and real use (beyond email, above)

| Risk                        | Answer                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Account enumeration         | Email answers never differ; "already has an account" only after the code                                  |
| Username enumeration        | Handles are public anyway; lookups 60/h per account; emails never searchable                              |
| Squatting / offensive names | Accounts only, 30-day change rule, blocklist, owner reset                                                 |
| Request spam                | 20 a day, 50 pending out, a decline blocks repeats for 30 days                                            |
| Status leaking              | One query joined on accepted friendships; a test with a stranger, a pending request and a removed friend  |
| Takeover via upgrade        | Needs the guest's HttpOnly cookie _and_ proof of identity (state + PKCE + nonce, or the emailed code)     |
| Flaky nets                  | Friend writes are idempotent; a lost verify answer: the client re-reads `/me` before it says "wrong code" |

## Build plan: 4 PRs (Netlify build minutes)

Each PR merges only when green, with `BALLBATTLE_ACCOUNTS` off in production. The ADR (0079) and
the spike notes ride in PR (a).

**(a) Switch, email code, Google sign-in (L)**

- `Config.accounts` and `VITE_ACCOUNTS`, the bundle check, and `friend-switch.ts` taking a flag.
- Migration `account_at`; the sweep skips accounts (24 months for them).
- Both sign-in flows, the switch-account path, the `in_a_match` refusal, the 16+ step, and the
  email limits and global caps.
- Unit tests, each shown failing with its check removed:
  - callback refuses wrong state;
  - callback refuses missing or expired cookie;
  - callback refuses wrong nonce;
  - callback refuses a code exchanged without the verifier (Google mocked).
- db tests through `TestBrowser`, Auth mocked at `fetchAuth`:
  - the same answer for new and known emails;
  - the 6th wrong code is refused;
  - the 91st code of the day answers `email_busy`;
  - a guest keeps its series after linking;
  - switching deletes the guest;
  - sign-in during a live match gets `409`.
- The sweep keeps an account and deletes a guest.
- Manual: a real iPhone in Safari, and Instagram's in-app browser, on staging.

**(b) Username, logout, delete account, privacy page (M)**

- Blocklist table tests (leet forms, look-alikes, the ASCII sentence).
- Two simultaneous claims of one name (`elsewhere`): one wins, one gets "taken".
- 30-day rule.
- `legal-pages.test.ts` reads the new constants; browser flow at 375 px; `no-dead-end`,
  `history-rules`.

**(c) Friends (M)**

- db tests: mutual request accepts, idempotent double tap, decline cooldown, caps, add by code and
  by username, delete account cascades.
- Screen flows at the four sizes.

**(d) `/me/inbox`, status, challenge a friend (M)**

- db tests: the status rules and the stranger test.
- browser: no poll while hidden (fake timers), one poll on return.
- `test:online`:
  - two phones: A challenges B from the list, B accepts from the card;
  - B declines and A's lobby says so;
  - an offline friend gets the link.

**Rollout:** slice 1 ((a) + (b)) is built and tested on staging with a few friends, with the
accounts switch on there only. Production gets accounts together with friends ((c) + (d)) in one
publish, never on its own.

## Cost

- **Status and invites ride one poll:** `GET /me/inbox` every **30 s while the page is visible**,
  for accounts with a friend or a pending request.
  - That is ~120 calls per player-hour on menus; none while hidden; one at once on return.
  - Guests and players without friends: 0.
  - Nothing extra in a live match (its reads already set "in a match").
- **A live match costs about 141 calls (Bo3) or 235 (Bo5) for both players** (ADR 0053).
- **Netlify Free (legacy): 125k invocations a month, hard limit.** Example: 40 players × 5 menu
  hours (24k) + 80 Bo3 matches (11k) ≈ 35k.
- **Supabase Free:** 50k MAU and 500 MB; fine.
- **Resend Free:** capped at 90 a day and 2,700 a month by our own limits (above). Google
  sign-ins cost nothing there.
- **Build minutes:** 4 previews instead of 9.

## Moving off polling

Polling is the starting point, not the end state.

- **The plan:** replace polling with a Supabase Realtime "poke" (ADR 0053). The server broadcasts
  "something changed" on a player's or series' channel, and the page then does one normal read.
  Presence stays our own heartbeat (a channel's presence could be faked).
- **Triggers, whichever comes first:**
  - about 1,000 live matches a month;
  - Netlify function calls past ~60% of the plan's limit;
  - the 30 s challenge delay feeling slow once friends ship to everyone;
  - at the latest, before an open ranked live queue.
- **Designed for the swap:** `/me/inbox` and the live series reads stay complete, idempotent
  reads with an ETag. The poke only says "read now", so the API, the answers and the screens
  don't change; only the client's wait does (the timer becomes "on poke, or a slow 2-minute
  safety read").
- **What the swap involves:**
  - `connect-src` gains the Supabase origin;
  - a socket client (`realtime-js`, or a small Phoenix client), which needs an ADR;
  - the publishable key in page JS, with channels carrying no data beyond a version number, and
    private channels authorised by a short-lived token the API mints;
  - reconnects on flaky phones and after the background, with a read on every reconnect;
  - Realtime's free limits: 200 concurrent connections, 100 messages a second, ~2 M messages a
    month.
- **A closed app on iPhone gets neither a poll nor a poke.** Reaching it needs push
  notifications, with the app-store release.

## Risks

- **Google in in-app browsers:** Google blocks sign-in there (`disallowed_useragent`). Detection is
  best effort, and email is always offered.
- **iOS backgrounding:** a hidden page shows offline after 75 s, and invites reach only open pages.
- **App store:**
  - Sign in with Apple is required once Google is offered on iOS. It uses the same ID-token
    route, plus Apple token revocation on delete.
  - Accounts key on user id, never email.
  - The bearer-token change stays in `sessionOf`.
- **Switch off after accounts exist:** accounts keep playing as plain players, friend routes
  answer `accounts_off`, and the sweep still skips accounts. The migrations only add.

## New data for privacy.html

| Data                                                   | Why                           | Kept                                       |
| ------------------------------------------------------ | ----------------------------- | ------------------------------------------ |
| Email address (Supabase Auth)                          | Sign-in, codes                | Until the account is deleted               |
| Google account id and email (no name or photo)         | Google sign-in                | Until deleted                              |
| One-time codes (hashed, in Auth)                       | Sign-in                       | 10 minutes or until used                   |
| Username, when set                                     | Your public name, 30-day rule | Until deleted                              |
| Friend code                                            | Adding friends                | Until regenerated or deleted               |
| Friendships and requests                               | Friends list                  | Until removed or deleted; declines 30 days |
| `active_at` (one timestamp, overwritten)               | Online status, friends only   | Until deleted                              |
| Who a challenge was sent to                            | Invites                       | As the challenge                           |
| Email-HMAC rate-limit counts                           | Abuse limits                  | The window's length (≤ 1 day)              |
| Resend's delivery logs (new overseas processor, APP 8) | Sending codes                 | Resend's retention (to confirm)            |
| Accounts                                               | —                             | Deleted after 24 months without activity   |

## Decisions

Taken:

- Resend Free on a subdomain of `calvinrdevelopment.com`.
- Deleting inactive accounts after 24 months.
- A 30 s inbox poll.
- A paid Netlify plan decided later from real usage.
- 4 PRs.
- No export endpoint.
- Slice 1 goes to production only with friends.

## Spike: linking Google to a guest (local)

**Status: half done.** The source is read and the local probe has run; the end-to-end run with a
real Google ID token waits on a Google OAuth test client.

**The call** (Supabase Auth v2.197.0, the version the local CLI runs):

```
POST /auth/v1/token?grant_type=id_token
apikey: <publishable key>
Authorization: Bearer <the guest's access token>
{ "provider": "google", "id_token": "<Google's>", "nonce": "<raw nonce>", "link_identity": true }
```

**From Auth's source** (`internal/api/token_oidc.go`, `identity.go`):

- With `link_identity`, Auth requires the bearer user and adds the Google identity to _that_
  user, so the id stays.
- If the user has no email yet, Auth takes Google's verified email, confirms it and sets
  `is_anonymous = false`. The answer is a fresh session for the same user.
- **Already linked to another user:** `422 identity_already_exists`, "Identity is already linked
  to another user".
- **Google's email already on another account** (an email-code account): `400 email_exists`.
  Signing in without `link_identity` then lands on that account, since Auth links verified
  emails automatically.
- **Nonce:** the ID token must carry `sha256hex(raw nonce)` and we send the raw one. A mismatch
  is `invalid nonce`, and a nonce on only one side is refused.
- **Audience:** the token's `aud` must be the configured Google client id.
- **Not gated by "manual linking":** that setting guards only `/user/identities/*`, the hosted
  redirect path.

**Local probe** (`supabase start`, Google enabled with a dummy client):

- `link_identity` with the guest's bearer and a junk token got as far as checking the ID token
  ("Bad ID token"), so the flag is honoured over REST.
- Without a user bearer: `403 bad_jwt`.
- The hosted linking route, with manual linking off: `404 manual_linking_disabled`.

**Still to run with a real Google client:**

- a link keeps the guest id;
- `identity_already_exists` for a second guest;
- plain sign-in returns the linked user;
- wrong nonce;
- `email_exists`, then joining the email account.

The throwaway script covers all of these from one Google sign-in.

**Meaning for PR (a):** the plan stands as designed. Two additions:

- Map `email_exists` to the "Switch to it?" path.
- Leave manual linking off in every project: the hosted path stays closed and ours doesn't need
  it.

The fallback (the hosted redirect) is not needed unless the full run surprises us.

## Draft ADR 0079 (outline)

Accounts and friends behind `BALLBATTLE_ACCOUNTS`:

- Google via the ID-token grant on our callback (state, PKCE, nonce), and an email code with
  uniform answers and our own caps under Resend's.
- Upgrade links to the same id; switching deletes the guest; never during a live match.
- Usernames: ASCII only.
- Friendships: one row per pair.
- Status from `active_at`, through one 30 s visible poll designed to become a Realtime poke at the
  triggers above.
- Not taken: Realtime now, the hosted OAuth redirect, merging accounts, Unicode usernames, an
  export endpoint.
- Amends ADR 0052 §2 and ADR 0069.
