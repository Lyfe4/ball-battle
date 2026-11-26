# Runbook: accounts and the Realtime poke on in production

How to switch **accounts** (ADR 0079) and the **Realtime poke** (ADR 0082) on for the live site,
`https://battle-ball.netlify.app` (Netlify site `battle-ball`, Supabase project
`ballbattle-production`, ref `wtqmptuhonbtjwxjwtwl`). Owner-only: every step touches a hosted
service. Do them in this order. Each step says why, what to do, how to check it and how to undo it.

Never paste a real secret into this file, a pull request, a commit or a chat. Placeholders:
`<RESEND_API_KEY>`, `<GOOGLE_CLIENT_ID>`, `<GOOGLE_CLIENT_SECRET>`, `<BROWSER_POKE_KEY>`,
`<SENDER_ADDRESS>` (the From address used on staging, for example `codes@play.calvinrdevelopment.com`).

**Naming.** Supabase key and secret names are lowercase with underscores: the publishable key is
`browser_poke` and the Vault secret `resend_api_key`. ADR 0082 (its "Switching the hooks on"
steps) says `browser-poke` with a dash; this runbook uses `browser_poke`, and staging's key should
be renamed to match when it is next rotated.

**Netlify plan.** The site is on the legacy Free plan until step 1 moves it to Pro (ADR 0084).
Variable **scopes** (Builds, Functions, Runtime, Post processing) are a Pro feature: once step 1 is
done, scope the secrets to Functions as ADR 0082 asks; on Free every variable applies to every scope. **Deploy contexts** (Production, Deploy Previews, Branch
deploys, Local development) are available on every plan (the vs Friend switch already sets
`BALLBATTLE_ONLINE` for Production only), so set every value below for the **Production** context
only. (verify: Netlify's pricing page still lists per-context values on Free.)

Where things are read:

| Variable                                   | Read by                                                                                                        | Production today      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------- |
| `BALLBATTLE_ONLINE`                        | functions (`src/server/config.ts`); the build as `VITE_ONLINE` (`netlify.toml` `[context.production]` command) | `1` (vs Friend is on) |
| `BALLBATTLE_ACCOUNTS`                      | functions (`Config.accounts`, only with online); the build as `VITE_ACCOUNTS` (same command)                   | unset                 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | functions; both or neither, else a `ConfigError`                                                               | (verify: unset)       |
| `BALLBATTLE_POKE`                          | functions; with it `SUPABASE_BROWSER_KEY` is required                                                          | unset                 |
| `SUPABASE_BROWSER_KEY`                     | functions only (`GET /me/poke` hands it to the page; never in the bundle)                                      | unset                 |
| `VITE_POKE`                                | the build only (`src/app/poke-build.ts`, `scripts/check-bundle.ts`)                                            | unset                 |
| `BALLBATTLE_EMAIL_CODES`                   | functions; `off` switches email codes off (Google still works)                                                 | unset (on)            |
| `BALLBATTLE_TURNS`, `VITE_TURNS`           | play by turns with a friend (ADR 0085): previews and staging only; production's command blanks `VITE_TURNS`    | unset: leave it so    |

`VITE_POKE` is **not** derived from `BALLBATTLE_POKE`: the production command only prefixes
`VITE_ONLINE` and `VITE_ACCOUNTS`. Set `VITE_POKE=1` for Production yourself; Netlify passes every
site variable into the build's environment, and the command's prefixes don't remove it.

---

## 0. Preconditions

**Why:** production gets nothing staging hasn't run for a week (ADR 0082 PR 8).

**Check, all on staging (`https://main--battle-ball.netlify.app`):**

- [ ] Hooks, relay row, Vault secret and browser key set on staging (ADR 0082 steps) for at least
      a week, pokes on (`node scripts/poke-switch.ts status staging` says on), no rollback needed.
- [ ] `curl -s https://main--battle-ball.netlify.app/api/v1/health` shows `"status":"ok"`,
      `"accounts":"ok"`, `"emailCodes":"ok"`, `"emailSends":"ok"`.
- [ ] The last week of `Supabase daily check` runs (Actions tab) are green for staging, with no
      "Auth accepts a sign-up without a ticket" warning.
- [ ] By hand on staging, on a phone and a desktop: email code sign-in (code arrives in under a
      minute), Google sign-in, a guest's email link keeping its history, Switch to it?, a
      username, a friend request and Accept, a friend challenge arriving within ~3 s (pokes), a live
      match and rematch, Log out, Delete account.
- [ ] Supabase → staging → Reports / Usage: Realtime messages and peak connections well inside
      the free quota (about 2M messages, 200 connections).
- [ ] `main` is green and holds every change you want live (`gh run list --workflow ci.yml
--branch main --limit 1`).
- [ ] Today's production: `curl -s https://battle-ball.netlify.app/api/v1/health` (on 24 Nov 2026
      it read `"accounts":"off"` and had **no** `emailSends` key: `release` predates the mail
      watch, so the hooks migrations are not in production yet. Step 3 fixes that).
- [ ] ADR 0084's trigger: accounts going live is one of its two triggers, so step 1 (Netlify Pro,
      functions in Sydney) comes first, in the same week.

**Undo:** nothing to undo.

## 1. Netlify Pro, functions in Sydney (ADR 0084)

**Why:** ADR 0084 decision 1: the legacy free plan counts function calls (125,000 a month, the whole
site stops past it), and friends' traffic reaches that at about 29 daily players. Accounts going
live is the trigger to move to **Netlify Pro ($20, credit-based) with functions in `syd`**, beside
the database, in that week. Leaving the legacy plan is permanent, so do it only when step 11 is
days away, not weeks.

**Do:**

1. Before: `node scripts/live-measure.ts https://battle-ball.netlify.app bo3 > live-before.json`
   (two browser contexts play one live match; keep the JSON for the comparison).
2. Netlify → team → **Billing** → change plan → **Pro**. (verify: whether the team can still buy
   _legacy_ Pro or only the credit plan; the proposal assumes credits, 3,000 a month.)
3. A branch and PR, merged green before step 3 so the Publish carries it:
   - the functions' region: `netlify.toml` `[functions]` (its comment says Ohio, Free plan), or the
     site setting **Project configuration → Build & deploy → Functions region** → Asia Pacific
     (Sydney) `ap-southeast-2` if `netlify.toml` doesn't take a region (verify which);
   - `privacy.html`: Netlify's line says the server code "runs in Ohio, USA, so every online
     request passes through the United States"; change it to Sydney, Australia, and the "Last
     updated" date (fold this into step 2's privacy PR if they go together).
4. Now on Pro, variable **scopes** exist: in step 10 scope the secrets (`GOOGLE_CLIENT_SECRET`,
   `SUPABASE_BROWSER_KEY`) to **Functions** only, as ADR 0082 asked.

**Check:**

- Netlify → Billing shows Pro; Usage shows credits.
- After step 3's deploy: Netlify → the production deploy → Functions → region Sydney.
- `node scripts/live-measure.ts https://battle-ball.netlify.app bo3 > live-after.json`: a read's
  time falls (ADR 0084 expects ~190 ms less per database round trip).
- Weekly: Usage → credits against 3,000 (ADR 0084 decision 5).

**Undo:** the region can go back to Ohio by the same setting and a deploy (and `privacy.html` with
it). The plan change can't return to the legacy free plan.

## 2. Privacy policy pull request

**Why:** ADR 0069 and ADR 0079's "Before accounts are switched on in production": the policy must
match what production does on the day it does it.

**Do:** a branch and PR changing `privacy.html` (and its "Last updated" date):

- "Deleting your data" says to use Forget me "in the game's settings" and that, signed in, "the same
  button is Delete account". With accounts on, Log out and Delete account live on the account
  screen (home's account button, ADR 0081), and so does a guest's Forget me; settings keep Forget me
  only in a build without accounts (ADR 0078). Say where each button is in each build.
- Re-read the accounts, friends, email-code, Resend and Realtime sections against the constants
  (`scripts/legal-pages.test.ts` checks the numbers) now that they apply to production.
- Merge it green (merge commit, branch deleted) before step 3, so the Publish carries it.

**Check:** `pnpm test scripts/legal-pages.test.ts` green on the branch; after step 3,
`https://battle-ball.netlify.app/privacy.html` shows the new date.

**Undo:** revert the PR (a policy that describes more than is live is wrong, so keep it only if
accounts ship).

## 3. Publish: migrations and code to production

**Why:** production (`release` at `f349248`, 23 Nov 2026) lacks every migration since then. Checked
against `main` on 26 Nov 2026 (`git diff --stat origin/release origin/main -- supabase/migrations`):

| Migration                                 | What it adds                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `20261124090000_auth_hooks.sql`           | the two Auth hooks, `game.auth_tickets`, `game.mail_relay`                   |
| `20261124120000_poke.sql`                 | `game.flags` (`poke`, off), poke keys and the row triggers                   |
| `20261124190000_mail_watch.sql`           | `game.mail_sends`, `game.mail_outcomes`                                      |
| `20261125090000_blocks_reports.sql`       | `game.friendships.blocked_by`, `game.name_reports`, `game.name_seen_by`      |
| `20261125150000_ranked.sql`               | ranked groundwork: seasons, ratings, rating changes, queue, rewards (unused) |
| `20261125200000_poke_turns.sql`           | `game.poke_turns()` and its trigger on `game.series`                         |
| `20261125210000_mail_watch_read_only.sql` | `mail_outcomes` for `supabase_read_only_user` (the daily check)              |
| `20261125234153_series_seen.sql`          | `game.series_seen` (the seen mark on an ended game by turns)                 |

Re-run that diff on the day: anything merged since joins this list and the check below.
Publish applies them to production before `release` moves (ADR 0068). It must come **before**
step 8: the before-user-created hook refuses any sign-up without a ticket, and only the new code
writes tickets, so turning the hook on under the old release would break every new guest.

**Do:** `gh workflow run publish.yml` (or Actions → Publish → Run workflow, ref `main`). It refuses
a commit whose CI on `main` didn't pass, migrates production, then fast-forwards `release`; Netlify
builds `release` (one production deploy: 15 credits on Pro after step 1; about a minute of the 300
build minutes on the legacy Free plan).

**Check:**

- The run is green and its summary lists the merges.
- Netlify → `battle-ball` → Deploys: the production deploy of `release` is Published.
- `curl -s https://battle-ball.netlify.app/api/v1/health` now has `"emailSends":"ok"` (no sends yet
  counts as ok; `unknown` means the mail watch's migration is missing) and still `"status":"ok"`.
- Supabase → production → SQL Editor:
  ```sql
  select to_regprocedure('public.ballbattle_before_user_created(jsonb)') is not null as hook_user,
         to_regprocedure('public.ballbattle_send_email(jsonb)') is not null as hook_email,
         to_regprocedure('game.mail_outcomes(integer)') is not null as mail_watch,
         (select enabled from game.flags where name = 'poke') as poke_flag,
         to_regclass('game.name_reports') is not null as reports,
         to_regclass('game.ratings') is not null as ranked,
         exists (select 1 from pg_trigger where tgname = 'poke_turns_changed') as poke_turns,
         has_function_privilege('supabase_read_only_user', 'game.mail_outcomes(integer)', 'execute')
           as read_only_watch,
         to_regclass('game.series_seen') is not null as series_seen;
  ```
  Expect `true, true, true, false, true, true, true, true, true`.

**Undo:** migrations are expand-only and stay. To roll the code back, Netlify → Deploys → an
earlier production deploy → "Publish deploy" (Publish never moves `release` backwards).

## 4. Resend: domain and a production API key

**Why:** the Send Email hook posts each code to Resend's API with this key; Auth's SMTP fallback
uses the same key as its password.

**Do (resend.com):**

- **Domains** → `play.calvinrdevelopment.com`: status **Verified** (DKIM TXT, the two CNAMEs and
  DMARC `p=none` as Resend lists them, DNS in Netlify → Domains → `calvinrdevelopment.com` → DNS
  records). If not verified, fix DNS first; nothing below works without it.
- **API Keys** → **Create API Key**: name `ballbattle_production`, permission **Sending access**,
  domain `play.calvinrdevelopment.com`. Copy it once as `<RESEND_API_KEY>`; it is shown only once.
  (verify: dialog wording.) A separate key from staging's, so each can be revoked alone.

**Check:** the key is listed with Sending access on that domain only.

**Undo:** API Keys → the key → Delete (codes then fail: watch `emailSends`; see rollback).

## 5. Supabase Auth settings (ADR 0079's list), production project

**Why:** `/health` reads `"accounts":"misconfigured"` without Confirm email, and the rest is what
staging and `supabase/config.toml` already hold.

**Do:** Supabase → `ballbattle-production` → Authentication (paths as of Nov 2026; verify: the
sidebar groups move between dashboard releases):

- **Sign In / Providers** → **Email**: enabled; **Confirm email** on; **Email OTP expiration**
  `600` s; OTP length 6. **Allow manual linking** off. **Allow anonymous sign-ins** on (already).
- **Emails** → **SMTP Settings** → Enable custom SMTP: host `smtp.resend.com`, port `465`,
  username `resend`, password `<RESEND_API_KEY>`, sender email `<SENDER_ADDRESS>`, sender name
  `BallBattle`. (A fallback: with the Send Email hook on, Auth sends nothing itself.)
- **Emails** → **Templates**: **Confirm signup**, **Magic link** and **Change email address**, each
  subject `Your BallBattle code`, body pasted from `supabase/templates/code.html` (it shows
  `{{ .Token }}`, never a link). Turn off any "identity linked" or other notification emails.
- **Rate Limits**: emails sent per hour `100`; anonymous sign-ins per hour `150` (already).
- **Sessions** (verify: may sit under **Settings** / **Advanced**): refresh token rotation on,
  **Refresh token reuse interval** `300` s.
- **URL Configuration**: Site URL `https://battle-ball.netlify.app`. No redirect URLs are needed
  (Google returns to our own callback, not Auth's).

**Check:** `curl -s https://<ref>.supabase.co/auth/v1/settings -H "apikey: <publishable key>"`
(production's ordinary publishable key, safe to use here) shows `"mailer_autoconfirm":false` and
`"anonymous_users":true`. Compare every field above with staging side by side.

**Undo:** set each back; none matters while accounts are off, except anonymous sign-ins (never
turn that off: guests need it).

## 6. Vault secret `resend_api_key`

**Why:** the hook reads the Resend key from Vault by the name in `game.mail_relay.key_name`.

**Do:** Supabase → production → **Integrations** → **Vault** → **Add new secret**: name
`resend_api_key`, secret `<RESEND_API_KEY>`, description "Resend sending key for the Send Email
hook (ADR 0082)". (verify: Vault may show under Project Settings → Vault in your dashboard.)

**Check (SQL Editor, never selects the value):**

```sql
select name, created_at from vault.secrets where name = 'resend_api_key';
```

**Undo:** Vault → the secret → Delete (the hook then refuses with "The mail relay has no key").

## 7. The `game.mail_relay` row

**Why:** the one row tells the hook where to post. Set by hand, never by a migration, so a local
Mailpit row can't reach a hosted project.

**Do (SQL Editor):**

```sql
insert into game.mail_relay (kind, url, sender_name, sender_email, key_name)
values ('resend', 'https://api.resend.com/emails', 'BallBattle', '<SENDER_ADDRESS>', 'resend_api_key');
```

`<SENDER_ADDRESS>` is the same address as step 5's SMTP sender, on `play.calvinrdevelopment.com`.

**Check:** `select kind, url, sender_name, sender_email, key_name from game.mail_relay;` shows one
row (`only_row` allows no second).

**Undo:** `delete from game.mail_relay;` (the hook then refuses with "No mail relay is set").

## 8. The two Auth hooks

**Why:** ADR 0082 decision 2: with the browser key in a page, anyone could call Auth's `/otp` and
`/signup`; the hooks refuse a sign-up or email the functions didn't ticket. Required before the
browser key reaches a production page (step 9 onwards). Only after step 3's release is live.

**Do:** Supabase → production → Authentication → **Auth Hooks** (verify: the docs call it
"Hooks") → **Add hook**:

1. **Before User Created** → type **Postgres**, schema `public`, function
   `ballbattle_before_user_created` → enabled → Create.
2. **Send Email** → type **Postgres**, schema `public`, function `ballbattle_send_email` →
   enabled → Create.

The migration already grants execute to `supabase_auth_admin`; both are `security definer`.

**Check:**

- A new guest still works: in a private window open the live site, start vs Friend (makes a guest)
  and see the challenge link.
- `node scripts/project-check.ts production` (writes a one-minute ticket, signs up and deletes one
  test guest) passes and says Auth **refuses** a sign-up without a ticket.
- Email can't be tested until step 11; until then nobody can request a code on production.

**Undo:** Auth Hooks → each hook → disable (Send Email off: Auth sends through step 5's SMTP with
the templates; Before User Created off: sign-ups need no ticket). Do this only after the browser
key is revoked (rollback order below).

## 9. Google OAuth for production

**Why:** Google signs in through our own callback; redirect URIs are exact, so production needs
its own entry. `/health` checks the Google provider only when the functions have
`GOOGLE_CLIENT_ID`, so a missing variable reads `"accounts":"ok"` with no Google button: check it
by hand.

**Do, Google Cloud Console** (console.cloud.google.com, the BallBattle project):

- **Google Auth Platform** → **Clients** → the web client (or **Create client** → Web application,
  named `ballbattle-production`): **Authorized redirect URIs** add exactly
  `https://battle-ball.netlify.app/api/v1/auth/google/callback` (no trailing slash). JavaScript
  origins are not needed (server-side code flow). Copy `<GOOGLE_CLIENT_ID>`,
  `<GOOGLE_CLIENT_SECRET>`.
- **Branding**: app name BallBattle, support email, home page `https://battle-ball.netlify.app/`,
  privacy policy `https://battle-ball.netlify.app/privacy.html`, terms
  `https://battle-ball.netlify.app/terms.html`, authorized domain as staging has it.
  (verify: `netlify.app` is a public suffix, so the authorized domain is `battle-ball.netlify.app`.)
- **Data Access**: scopes `openid` and `.../auth/userinfo.email` only (the code asks for
  `openid email`): non-sensitive, so no verification review. (verify: a logo triggers brand
  verification; leave it off to publish at once.)
- **Audience**: User type External; **Publishing status** → **Publish app** → In production.
  In Testing only listed test users can sign in.

**Do, Supabase** → production → Authentication → Sign In / Providers → **Google**: enabled,
**Client IDs** `<GOOGLE_CLIENT_ID>`, **Skip nonce checks** off. Client secret: as on staging
(Auth's ID-token path doesn't use it; verify whether the form insists).

**Do, Netlify** (step 10 sets it with the others): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

**Check:** after step 11, `curl -s https://battle-ball.netlify.app/api/v1/auth/options` offers
Google, and signing in with a Google account not on any test list works.

**Undo:** remove the redirect URI or the Netlify variables (and redeploy); Supabase → Google off
makes `/health` read `misconfigured` while the functions still have the id.

## 10. Browser key `browser_poke` and the Netlify variables

**Why:** the page opens its Realtime socket with a dedicated publishable key, revocable alone (the
emergency stop for every socket). Setting every variable now means step 11's one deploy carries
all of them (each production deploy costs build minutes).

**Do, Supabase** → production → **Project Settings** → **API Keys** → Publishable keys → **Create
new key**: name `browser_poke`, description "Browser Realtime socket (ADR 0082)". Copy
`<BROWSER_POKE_KEY>` (`sb_publishable_…`). (verify: button wording.)

**Do, Netlify** → `battle-ball` → **Project configuration** → **Environment variables** → **Add a
variable** → Add a single variable → "Different value for each deploy context" → fill
**Production** only, leave Deploy Previews, Branch deploys and Local development empty:

| Key                    | Production value                                                    |
| ---------------------- | ------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | `<GOOGLE_CLIENT_ID>`                                                |
| `GOOGLE_CLIENT_SECRET` | `<GOOGLE_CLIENT_SECRET>` (mark "Contains secret values" if offered) |
| `SUPABASE_BROWSER_KEY` | `<BROWSER_POKE_KEY>`                                                |
| `BALLBATTLE_POKE`      | `1`                                                                 |
| `VITE_POKE`            | `1`                                                                 |

Leave `BALLBATTLE_ACCOUNTS` to step 11's script. On Pro (step 1) set **Scopes** to Functions for
`GOOGLE_CLIENT_SECRET` and `SUPABASE_BROWSER_KEY`; `VITE_POKE` needs Builds. Without scopes the
variables reach the build too, which is harmless (`check-bundle.ts` fails a build whose bundle holds a
secret, and the browser key is publishable). If an existing variable already has a value for
another context, use Options → Edit and set Production only.

**Check:** `netlify env:list --context production` (read-only) lists each key; values unchanged in
the other contexts. Nothing is live until a deploy. `BALLBATTLE_POKE=1` on its own sends no poke:
`game.flags` `poke` is still off, so `/me/poke` answers `{ "off": true }`.

**Undo:** Options → Delete for each, then a deploy; or revoke `browser_poke` at once (rollback step 2).

## 11. Accounts on: `friend-switch.ts on --accounts`

**Why:** one variable, one deploy: the build gets `VITE_ACCOUNTS` from `BALLBATTLE_ACCOUNTS` and
the functions read the same one, so page and API switch together.

**Argument order matters:** the script reads the action from the first argument, so `on --accounts`; ADR 0079 writes `--accounts on`, which the script refuses ("Say on, off or status"), and plain `on` would flip vs Friend instead.

**Do:** `node scripts/friend-switch.ts on --accounts` (your own `netlify login`). It refuses unless
`release`'s `netlify.toml` builds from the switch and vs Friend is on; sets `BALLBATTLE_ACCOUNTS=1`
for Production; triggers a production deploy (about a minute of build time); waits for
`/api/v1/auth/options` to answer 200; then fails unless `/health` reads `"accounts":"ok"`.

**Check:**

- The script ends "Accounts is on" with no "set up wrong" line.
- `curl -s https://battle-ball.netlify.app/api/v1/health`: `"status":"ok"`, `"accounts":"ok"`,
  `"accountsFailed":[]`, `"emailCodes":"ok"`, `"emailSends":"ok"`.
- The deploy log shows `dist/ holds no secret.` and the bundle has the poke
  (`curl` the `main-*.js` from the home page and grep `me/poke`).
- On a phone: Sign in on home → email code → the code arrives from `<SENDER_ADDRESS>` within a
  minute; then in SQL Editor
  `select status_code, created from net._http_response order by created desc limit 5;` shows 200,
  and `select * from game.mail_outcomes(1);` shows `failed = 0`. Resend → Emails/Logs shows it
  Delivered.
- Google sign-in, a username, Log out and Delete account, each once.

**Undo:** `node scripts/friend-switch.ts off --accounts` (unsets the variable, one deploy; every
`/api/v1/auth/*` then answers `accounts_off`, signed-in players stay in the database).

## 12. Pokes on: `poke-switch.ts on production --production`

**Why:** the database flag is the last of the three poke switches, instant and with no deploy.
Only now: the hooks are on (step 8) and the page and functions already carry the key (steps 10-11).

**Do:** `node scripts/poke-switch.ts status production` (expect off), then
`node scripts/poke-switch.ts on production --production` (your own `supabase login`).

**Check:**

- It prints `production: Pokes are on (since …)`.
- Signed in on the live site, DevTools → Network: `GET /api/v1/me/poke` answers `url`, `key`,
  `topic` (`p:` + 32 hex), and a `wss://wtqmptuhonbtjwxjwtwl.supabase.co/realtime/...` socket
  opens with no CSP error in the console.
- Two devices: a friend request or challenge reaches the other within about 3 s; a live match's
  pick reaches the other phone within about 1.5 s.
- Next day: Supabase → production → Usage → Realtime messages and connections.

**Undo:** `node scripts/poke-switch.ts off production` (never refused, instant; pages fall back to
their timers at their next `/me/poke` ask; revoke the key to drop open sockets at once).

## 13. UptimeRobot keyword monitors

**Why:** `/health` stays 200 for sign-in and email problems, so the plain up/down monitor never
sees them; keyword monitors do (ADR 0079, ADR 0082 mail watch).

**Do:** UptimeRobot → **+ New monitor** → Monitor type **Keyword** → URL
`https://battle-ball.netlify.app/api/v1/health`, interval 5 minutes, alert **when keyword does
not exist** (verify: wording "Keyword not exists"), case-sensitive, your email as contact. One
monitor per keyword:

| Friendly name                      | Keyword                                             |
| ---------------------------------- | --------------------------------------------------- |
| `BallBattle production accounts`   | `"accounts":"ok"`                                   |
| `BallBattle production emailCodes` | `"emailCodes":"ok"` (add only if not there already) |
| `BallBattle production emailSends` | `"emailSends":"ok"`                                 |

Free plan: 50 monitors at 5 minutes (verify). `/health` is counted per network
(`LIMITS.health`): three monitors every 5 minutes stay far inside it.

**Check:** each monitor shows Up within one interval. Optional test: pause email codes with
`BALLBATTLE_EMAIL_CODES=off` on a branch context only; not on production (it would need a deploy).

**Undo:** pause or delete the monitors (do it before switching accounts off, or they alert on
`"accounts":"off"`).

---

## Final check list

- [ ] `privacy.html` on the live site has the new date and the account screen's buttons.
- [ ] `/api/v1/health`: `status ok`, `accounts ok`, `emailCodes ok`, `emailSends ok`.
- [ ] `node scripts/friend-switch.ts status --accounts`: on.
- [ ] `node scripts/poke-switch.ts status production`: on.
- [ ] `node scripts/project-check.ts production`: passes; Auth refuses a sign-up without a ticket.
- [ ] Email code, Google, username, friend request, friend challenge (by poke), live match,
      rematch, Log out, Delete account: each once on the live site, on a phone.
- [ ] A guest with no sign-in still plays vs Friend (the 16+ question, then the link).
- [ ] UptimeRobot: the three keyword monitors are Up.
- [ ] `node scripts/reports.ts production` (read-only) runs and says no names reported; read it
      weekly once friends are live (ADR 0079, 2026-11-25).
- [ ] Tomorrow's `Supabase daily check` run is green for production (no refused send).
- [ ] Resend → Emails: no bounces or failures; its daily count well under 100.

## Rollback, in order

Fastest and cheapest first. Stop as soon as the problem is gone.

1. **Pokes off** (instant, no deploy): `node scripts/poke-switch.ts off production`.
2. **Drop every open socket** (instant): Supabase → Project Settings → API Keys → `browser_poke` →
   Revoke/Delete. `/me/poke` keeps handing out a dead key until rollback step 4's deploy; pages then poll.
3. **Email codes off, Google kept** (needs a deploy): Netlify Production `BALLBATTLE_EMAIL_CODES=off`,
   Deploys → Trigger deploy → Deploy project. Use this for a Resend or abuse problem alone.
4. **Accounts off**: pause the UptimeRobot `accounts` monitor, then
   `node scripts/friend-switch.ts off --accounts` (one deploy). In the same Netlify edit remove
   `BALLBATTLE_POKE`, `VITE_POKE` and `SUPABASE_BROWSER_KEY` for Production so that deploy carries
   them (no key reaches a page again).
5. **Hooks off**, only once no page can hold the browser key (2 and 4 done): Authentication → Auth
   Hooks → Send Email off, then Before User Created off. Auth then mails through the SMTP fallback.
6. **Code**: Netlify → Deploys → an earlier production deploy → Publish deploy. Migrations stay
   (expand only); never edit or revert one.
7. Leave the Vault secret, the relay row and the Google client in place unless the key leaked:
   then revoke it in Resend, create a new one and update Vault (`resend_api_key`) and SMTP.

vs Friend itself (`friend-switch.ts off`) is a separate decision: it also ends live matches.
