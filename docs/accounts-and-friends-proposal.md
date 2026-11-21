# Accounts and friends: proposal (2026-11-22, not yet approved)

## Where things stand

1. Online play is live friend links in Reveal and Showdown, Bo3/Bo5. Every player is a Supabase
   anonymous user behind an HttpOnly `__Host-bb_session` cookie, named "Player 4821".
2. The functions (Ohio) own every rule; the database (Sydney) is reached only by `game_api`.
   Every route is `guard` then `sessionOf`, and rate limits are counted in Postgres.
3. vs Friend is behind one switch (ADR 0068), off in production. Forget me and the 90-day sweep
   work with the switch off (ADR 0078).
4. ADR 0052 already sketched accounts as "slice 2": Google plus a 6-digit email code, a guest
   links to the same user id, nothing merged, and Sign in with Apple when the app ships.
5. The last ~15 commits hardened what exists before a beta: Auth outages, 8 s query timeouts,
   more rate limits, deletion without the switch, and policy dates. No account code exists yet.

## The design

### Sign-in (all through the functions; the browser still never talks to Supabase)

- **Google**, server-side code flow on _our_ callback:
  1. `GET /api/v1/auth/google` sets a 10-minute `__Host-bb_oauth` cookie (PKCE verifier, state,
     nonce, `mode=link|signin`) and redirects to Google with scope `openid email`.
  2. `GET /api/v1/auth/google/callback` checks state, swaps the code at Google for an ID token,
     and sends it to Supabase's `id_token` grant. For a guest it sends `link_identity: true` with
     the guest's token, so the guest keeps its id.
  - Why not Supabase's hosted redirect: Google's consent screen would name
    `<ref>.supabase.co`, which looks like phishing unless we pay for Auth's custom domain. The ID
    token path is also exactly what the native app sends later (`POST /session/id-token`, Apple
    too), so web and app share one server path.
  - **Spike first:** confirm the REST linking flag on staging.
- **Email code:**
  - `POST /api/v1/auth/email {email}` always answers "We sent a code". A guest triggers Auth's
    `updateUser(email)` (an email change; the code is `{{ .Token }}` in that template). If the
    email already has an account, it falls back to `/otp` with `create_user: false`, so the
    answer never says whether an account exists.
  - `POST /api/v1/auth/email/verify {code}` reads the email and the path from a 10-minute signed
    cookie. Codes expire after 10 minutes.
- **Upgrade = link, same user id**, so history, open series and rematches stay.
  - When the identity already belongs to another account (Google `identity_already_exists`, or
    the email fallback): "This email already has an account. Switch to it?"
  - Switching sets that account's cookie and deletes the now-unreachable guest, the same way
    Forget me does (opponents see "Deleted player"). Nothing is merged.
- **A new device with no guest** signs straight in. A first-time account goes through the same
  16+ question.
- **Logout** (exists: `DELETE /session`) and **Delete account** (exists: `DELETE /me`; friendships
  cascade). **Export** `GET /me/export` (promised in ADR 0052).
- Guests are untouched: same cookie, same routes, same 90-day sweep. The sweep skips accounts.

### Schema (one expand-only migration per PR)

- **`profiles` gets new columns:**
  - `account_at` (set on upgrade or first sign-in; the sweep and every account-only rule read it);
  - `username citext unique`, `username_set_at`;
  - `friend_code text unique` (8 Crockford base32 characters, which can be regenerated);
  - `active_at` (written by `sessionOf` at most every 30 s, by the same statement that already
    marks `last_seen_at`).
- **`friendships`:** `(low uuid, high uuid, requested_by, created_at, accepted_at, declined_at)`,
  primary key `(low, high)`, both columns referencing `profiles … on delete cascade`.
  - One row per pair, which makes a double tap idempotent.
  - When both players request each other, the second request accepts.
  - A decline is kept 30 days so the same request can't be re-sent, then swept.
- **`challenges.invitee uuid null`**, plus `declined_at`: a friend challenge is a normal live
  link that also names who may see it in their inbox.
- Room for later: everything keys on `profiles.user_id`, which is the account. Ratings, wallet,
  unlocks and a ledger become their own tables keyed by it; nothing here needs changing for them.

### API routes (thin; rules in `accounts-service.ts` / `friends-service.ts`, SQL in `db/`)

| Route                                             | Does                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `GET auth/google`, `GET auth/google/callback`     | Google sign-in or link                                                 |
| `POST auth/email`, `POST auth/email/verify`       | Email code                                                             |
| `POST auth/switch`                                | Take the pending existing account, delete the guest                    |
| `GET /me` (extended)                              | `{ name, account, username?, friendCode? }`                            |
| `PUT /me/username`, `GET /me/username?check=`     | Choose a username; check one while typing                              |
| `GET /friends`                                    | Friends with status, requests in and out                               |
| `POST /friends {username or code}`                | Request (or accept, when they had asked you)                           |
| `POST /friends/:id/accept`, `DELETE /friends/:id` | Accept; decline, cancel or remove                                      |
| `POST /friends/:id/challenge`                     | Live challenge to that friend (existing `createChallenge` + invitee)   |
| `GET /me/inbox`                                   | Heartbeat: invites, request count, current match (absorbs `/me/match`) |
| `POST /challenges/:token/decline`                 | Invitee says no; the sender's lobby says so                            |

**Status**, decided only in SQL, and only for accepted friends:

- _in a match_: an open live series or lobby (`liveNowOf`);
- _online_: `active_at` within 75 s;
- _offline_: anything else.

Non-friends and pending requests never see it.

**Usernames:**

- 3–15 characters, `a–z 0–9 _`, case-insensitive.
- Set once, then at most one change per 30 days. Only accounts have one.
- Checked against a reserved list (admin, ballbattle, support, mod, deleted, `player\d+`, ball
  names) and a small, reviewed blocklist after folding leetspeak (0→o, 1→i/l, 3→e, 4/@→a, 5/$→s,
  7→t, repeated letters). Long words match as substrings, short ones as whole tokens.
- Our own file, no dependency: it is short, testable, and the libraries are English-only too.
- The owner can clear a name in SQL; the player is then asked again.

### Screens (phone first, one `rules-step`-style screen each; routes and screen keys as usual)

- **vs Friend setup:** a quiet "Sign in to add friends" row for guests. Signed in, a **Friends**
  card on home (beside vs Bot / vs Friend; it becomes the 2 × 2 grid ADR 0055 planned).
- **Sign in:** two buttons, "Continue with Google" and "Email me a code", then the code screen
  with Resend after 60 s.
  - In an in-app browser (Instagram, Messenger, TikTok and similar, detected from the user agent)
    the Google button becomes "Open in Safari/Chrome to use Google", and email stays.
  - The upgrade line: "Your matches stay with you".
- **Choose a username:** the step straight after the first sign-in. It checks after a pause in
  typing and says why a name won't do.
- **Friends:**
  - your username and friend code (Copy / Share link `?friend=CODE`);
  - an add field (username or code);
  - requests (Accept / Decline);
  - the list sorted online first, each row with a status dot plus words and Challenge (offline
    friends get "Send link").
- **Invite card:** the rematch card's look (ADR 0070), on any screen but over a fight. "sam
  challenges you · Reveal Bo3", with Accept (to the lineup, then the existing accept) and
  Decline.
- **Sender's lobby:** the existing lobby, with "Waiting for sam" and the link still shown as the
  fallback.

## Abuse and real use

| Risk                        | Answer                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code brute force            | 6 digits, 10 min life; 5 wrong tries per email-HMAC per 10 min burns the code; 50 per network per 10 min                                                                   |
| Email bombing / mail cost   | Sends: 3/h per email-HMAC, 5/h per guest, 60/h per network (a class fits), plus Auth's 60 s per-user gap                                                                   |
| Account enumeration         | Email answers never differ. The "already has an account" choice appears only after the code, to whoever holds that inbox                                                   |
| Username enumeration        | Usernames are public handles anyway (shown in matches), so "No player called X" is fine, for typo fixing. Lookups capped at 60/h per account; emails are never searchable  |
| Squatting / offensive names | Accounts only (each costs a Google or email account), 30-day change rule, blocklist, owner reset                                                                           |
| Request spam                | 20 requests a day, 50 pending out; a decline blocks repeats for 30 days; Remove at any time                                                                                |
| Status leaking              | Computed in one query joined on accepted friendships; a `viewOf`-style test with a stranger, a pending request and a removed friend                                        |
| Takeover via upgrade        | Linking needs the guest's HttpOnly cookie _and_ proof of the identity (Google ID token with our nonce, or the emailed code). The state and verifier cookie stop login CSRF |
| Retries / flaky nets        | Friend writes are idempotent by primary key. A verify whose answer was lost: the client re-reads `/me` before it says "wrong code"                                         |
| Shared device               | Logout exists; the cookie is per browser                                                                                                                                   |
| Non-English names           | ASCII-only usernames shut out other scripts. That is deliberate (no look-alike names); it is said plainly in the error                                                     |

The email-HMAC limits reuse `ipSubject`'s pattern (an HMAC under the server key, never the
address). Before relying on Auth's own OTP and verify limits, a probe like ADR 0068's checks
whether `Sb-Forwarded-For` reaches those endpoints.

## Build plan (each PR merged only when green; switch `BALLBATTLE_ACCOUNTS` off in production)

| #   | PR                                                                                                                                                | Size | Tests / verified by                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | ADR 0079 plus the staging spike (Google linking via the ID token; OTP limits with forwarding)                                                     | S    | Spike notes in the ADR                                                                                                                                    |
| 1   | Accounts switch (`Config.accounts`, `VITE_ACCOUNTS`, bundle check, `friend-switch.ts` takes a flag), migration `account_at`, sweep skips accounts | S    | config test, bundle check, db test: the sweep keeps an account and deletes a guest                                                                        |
| 2   | Email code: routes, limits, the switch-account path, the 16+ step                                                                                 | M    | db tests through `TestBrowser` (Auth mocked at `fetchAuth`): same answer for new and known emails, the 6th wrong code refused, the guest keeps its series |
| 3   | Google: routes, cookie, callback, in-app-browser fallback                                                                                         | M    | unit: state, nonce and verifier checks; db: link versus existing identity; manual check on a real iPhone and in Instagram's browser                       |
| 4   | Username: migration, check, screen                                                                                                                | M    | blocklist table tests (leet forms, look-alikes), citext uniqueness under two concurrent claims (`elsewhere`), browser flow at 375 px                      |
| 5   | Settings: Logout, Delete account, Export; `privacy.html` and terms updated                                                                        | S    | `legal-pages.test.ts` against the new constants, export db test                                                                                           |
| —   | **First slice ends here: sign-in plus username, useful alone** (history kept across devices, one name everywhere)                                 |      |                                                                                                                                                           |
| 6   | Friends: migration, add / accept / decline / remove, friend code, screen                                                                          | M    | db: mutual request accepts, idempotent double tap, decline cooldown, caps; `no-dead-end`, `history-rules`                                                 |
| 7   | Heartbeat and status: `active_at`, `/me/inbox`, the 30 s visible poll                                                                             | M    | db: the status rules and the stranger test; browser: no poll while hidden (fake timers)                                                                   |
| 8   | Challenge a friend: `invitee`, invite card, decline                                                                                               | M    | `test:online`: two phones, A challenges B from the list, B accepts from the card; B declines; an offline friend gets the link                             |

## Cost

- **Status and invites ride one poll:** `GET /me/inbox` every **30 s while the page is visible**,
  for accounts that have a friend or a pending request; none when the page is hidden; one at once
  on return.
  - That is **~120 calls per player-hour** on menus. Nothing extra during a live match, which
    already reads about once a second (~3,600 per hour) and sets "in a match".
  - Guests and players without friends: 0.
  - An invite arrives within 30 s (15 s on average); the sender's lobby says "Waiting for sam".
- Sign-in costs about 4 calls once. Each poll is 3 statements, about 0.7 s from Ohio to Sydney,
  and invisible to the player.
- **Netlify Free (legacy): 125k invocations a month, hard limit.**
  - Live play is the big spender: one Bo3 live match is about 2 × 360 reads.
  - Example: 40 players with 5 menu hours and 4 matches each is 24k (poll) + 58k (matches) ≈ 82k.
    A modest beta fits; a popular one doesn't.
  - Realtime would cut the poll to 0, but it needs Supabase tokens in page JS. Not worth it now.
- **Supabase Free:** 50k MAU (anonymous users count) and a 500 MB database; fine.
  - **The built-in mailer only sends to team members, 2 an hour, so email codes need custom
    SMTP.**
  - Resend Free (3,000 a month, 100 a day) needs a verified domain we own, so not `netlify.app`.
  - Raise Auth's email rate limit in the dashboard afterwards (it starts at about 30 an hour).
- **Build minutes:** 9 PRs × a deploy preview each. With ~129 minutes left until 1 Dec, start
  merging PRs that build after 1 Dec, or skip previews for docs-only changes (Netlify's `ignore`
  command).

## Risks

- **Supabase linking:** linking an ID token to an anonymous user over REST is documented for the
  SDKs, not for raw REST. The spike (PR 0) settles it before anything is built. If it doesn't
  work, fall back to Supabase's hosted OAuth redirect and accept the supabase.co consent screen.
- **Google in in-app browsers:** Google blocks sign-in there (`disallowed_useragent`). User-agent
  detection is best effort, and email is always offered.
- **iOS backgrounding:** iOS stops timers when the page is hidden, so the friend shows offline
  after 75 s and invites only reach open pages. Background invites need Web Push (an installed
  PWA on iOS), which is later work.
- **App store:**
  - Sign in with Apple becomes mandatory once Google is offered in the iOS app. It plugs into the
    same ID-token route and needs Apple token revocation on delete (ADR 0052 already says so).
  - Accounts key on user id, never email, so Apple's hidden relay addresses are fine.
  - The bearer-token change stays inside `sessionOf`.
- **Switch off after accounts exist:** accounts keep working as plain players (same user id),
  friend routes answer `accounts_off`, and the sweep still skips accounts. Rollback is the switch;
  the migrations only add.

## New data for privacy.html

| Data                                                                 | Why                           | Kept                                                     |
| -------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------- |
| Email address (Supabase Auth)                                        | Sign-in, codes                | Until the account is deleted                             |
| Google account id and email (scope `openid email`: no name or photo) | Google sign-in                | Until deleted or unlinked                                |
| One-time codes (hashed, in Auth)                                     | Sign-in                       | 10 minutes or until used                                 |
| Username, when set, when changed                                     | Your public name, 30-day rule | Until deleted                                            |
| Friend code                                                          | Adding friends                | Until regenerated or deleted                             |
| Friendships and requests (who, when)                                 | Friends list                  | Until removed or deleted; declines 30 days               |
| `active_at` (one timestamp, overwritten)                             | Online status to friends only | Until deleted                                            |
| Who a challenge was sent to                                          | Invites                       | As the challenge (existing)                              |
| Email-HMAC rate-limit counts                                         | Abuse limits                  | The window's length (≤ 1 h)                              |
| Mail provider's delivery logs (new processor, overseas: APP 8)       | Sending codes                 | Provider's retention (Resend: about 30 days, to confirm) |
| Accounts no longer swept at 90 days                                  | —                             | Deleted after **[decision]** of no activity              |

## Decisions for you

1. **A domain and a mail provider for email codes** (~A$15–25 a year for the domain; Resend Free).
   _Recommend yes_: email is the only sign-in that works in in-app browsers and without Google.
   If not now, ship Google first and email later.
2. **Inactive accounts:** delete after 24 months unseen. _Recommend 24 months_: long enough that
   no real player loses an account, and it keeps the policy honest. (Guests stay at 90 days.)
3. **Invite delay versus calls:** poll every 30 s (up to 30 s to arrive, ~120 calls an hour) or
   every 10 s (~360). _Recommend 30 s_ until we are off the 125k cap.
4. **First slice:** ship PRs 1–5 (sign-in and username) and run them in the beta before friends.
   _Recommend yes_: it is useful alone and tests the riskiest part (Auth, email, iPhone) first.
5. **Plan:** stay on Free for the beta, and move to a paid Netlify plan before switching friends on
   for everyone. _Recommend_: decide when monthly invocations pass ~80k.

Technical choices made: server-side Google flow on our own callback (one path with the future
app); no new npm dependency (the Google code exchange and JWKS check use `fetch` and the `jose` we
already have); the blocklist is our own file; status by polling, not Realtime.

## Draft ADR 0079 (outline)

Accounts and friends behind `BALLBATTLE_ACCOUNTS`:

- Google via the ID-token grant on our callback, and an email code with uniform answers.
- Upgrade links to the same id; switching deletes the guest.
- Usernames: ASCII, 30-day change rule, our own blocklist.
- Friendships: one row per pair.
- Status from `active_at` and live presence, shown to friends only, through one 30 s visible
  poll.
- Friend challenges are live links with an invitee.
- Accounts are skipped by the 90-day sweep.
- Not taken: Supabase Realtime, the hosted OAuth redirect, merging accounts, Unicode usernames.
- Amends ADR 0052 §2 (Google path, switching deletes the guest) and ADR 0069 (new data).
