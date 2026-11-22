# 0079: Accounts: sign in with Google or an email code, linking the guest

- Status: Accepted (2026-11-22). Built: PR (a), the switch and both sign-ins. Usernames, friends
  and the inbox follow in PRs (b) to (d)
- Date: 2026-11-22
- Amends: ADR 0052 §2 (accounts are slice 2: how they are built), ADR 0069 (the privacy policy
  names what an account stores), ADR 0068 (the sweep keeps accounts for 24 months)
- Builds on: `docs/accounts-and-friends-proposal.md` (approved in direction 2026-11-22, with its
  spike against Supabase Auth v2.197.0), changed as below

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
in_a_match` under the player's advisory lock (`checkNotLive`), before any cookie changes.

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

**No new dependency.** PKCE, the signed cookies and the nonce use Web Crypto; `jose` (already
here) decodes the ID token.

## Consequences

- Each environment with accounts needs: Supabase Auth's Google provider (the client id, nonce
  check on), "Confirm email" on (`/health` fails without it, `auth_email_confirmations`), its SMTP
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
- Slice 1 (this and PR (b)) reaches production only together with friends.
- Not taken: Realtime now, the hosted OAuth redirect, merging accounts, Unicode usernames, an
  export endpoint, the 60/30 split.
