# Launch-day runbook

Turning on accounts, friends, pokes and play by turns on the live site, so production matches
staging. Owner only: every step touches a hosted service. Do the steps in order; each says what to
do, what you should see, and how to undo it. What each setting should be, side by side with
staging, is [launch-checklist.md](launch-checklist.md). Replaces the accounts runbook of 24-26
November; the reasoning stays in ADR 0079, 0082, 0084, 0085 and 0092.

Never paste a real secret into this file, a pull request, a commit or a chat. Placeholders:
`<RESEND_API_KEY>`, `<GOOGLE_CLIENT_ID>`, `<GOOGLE_CLIENT_SECRET>`, `<BROWSER_POKE_KEY>`,
`<SENDER_ADDRESS>` (the From address staging uses, on `play.calvinrdevelopment.com`).

Live site: `https://battle-ball.netlify.app` (Netlify `battle-ball`), Supabase
`ballbattle-production` (`wtqmptuhonbtjwxjwtwl`). Staging: `https://main--battle-ball.netlify.app`.

## Before the day

1. **Staging is green and has run a week with everything on.** `curl -s
https://main--battle-ball.netlify.app/api/v1/health` shows `"status":"ok"`, `"accounts":"ok"`,
   `"emailSends":"ok"`, `"pokes":"on"`, `"turns":"on"`. The last week of the Supabase daily check
   (GitHub > Actions) is green.
2. **`main` is green** and holds everything you want live: `gh run list --workflow ci.yml --branch
main --limit 1` says success.
3. **Decide the database plan.** Production is on Supabase's free plan: no downloadable backups.
   Recommended: Supabase Pro for production before accounts go live (daily backups kept 7 days),
   then one restore drill (restore a backup into a scratch project and open it). You should see:
   Supabase > production > Database > Backups lists a backup from today.
4. **Optional, recommended: error reporting.** Create a free Sentry project and set `SENTRY_DSN`
   for Production and Branch deploys in Netlify (the server already reports to it,
   `src/server/monitor.ts`). You should see: a test error from staging appears in Sentry.

## 1. Netlify Pro, functions in Sydney

Why: on the legacy free plan the whole site stops at 125,000 function calls a month; friends'
traffic reaches that at about 29 daily players (ADR 0084). Pro with functions beside the database
also cuts each database round trip from about 190 ms to a few.

1. Netlify > team > Billing > Change plan > Pro. (Leaving the legacy plan is permanent.)
2. Netlify > `battle-ball` > Project configuration > Build & deploy > Functions region > Asia
   Pacific (Sydney). Nothing is live until the next deploy (step 3).
3. A small pull request changing `privacy.html`: Netlify's line says the server runs in Ohio;
   make it Sydney, Australia, with today's date. Merge it green before step 3.

You should see: Billing says Pro; after step 3, the production deploy's Functions tab says Sydney.
Undo: the region setting back to Ohio and a deploy (and the privacy line). The plan can't go back.

## 2. Supabase Auth settings for email codes (production)

Supabase > `ballbattle-production` > Authentication. Make each one match staging
([launch-checklist.md](launch-checklist.md), "Supabase: Auth"), in particular:

- Providers > Email: on, Confirm email on, OTP length **6**, OTP expiry **600** s (the game's text
  and the privacy page say 6 digits and 10 minutes). Allow manual linking off. Anonymous on.
- Rate limits: emails 100 an hour; anonymous sign-ins 150 an hour; **token verifications 10** per
  5 minutes (last night's medium: anyone can call Auth's verify directly, so this limit is the one
  that guards codes there); **token refreshes 1,800** per 5 minutes (every player's refresh comes
  from the functions' few addresses).
- Emails > SMTP: Resend, `smtp.resend.com`, port 465, user `resend`, password `<RESEND_API_KEY>`,
  sender `<SENDER_ADDRESS>`, name BallBattle. Templates: Confirm signup, Magic link, Change email
  address, subject "Your BallBattle code", body from `supabase/templates/code.html`.
- Sessions: refresh token rotation on, reuse interval 300 s.

You should see: `curl -s https://wtqmptuhonbtjwxjwtwl.supabase.co/auth/v1/settings -H "apikey:
<production publishable key>"` shows `"mailer_autoconfirm":false` and `"anonymous_users":true`.
Undo: set each back. None matters while accounts are off (never turn anonymous sign-ins off).

## 3. Publish, with the switches still off

`gh workflow run publish.yml` (or Actions > Publish > Run workflow on `main`). It refuses a commit
whose CI failed, applies production's migrations (all expand only), then moves `release`.

You should see, within about 5 minutes:

- the run green; Netlify > Deploys: a production deploy of `release`, Published;
- `curl -s https://battle-ball.netlify.app/api/v1/health`: `"status":"ok"`, `"ruleset":24` (or
  today's), `"accounts":"off"`, `"pokes":"off"`, `"turns":"off"`, `"emailSends":"ok"`,
  `"dbMatchesUrl":true` (the functions' database is production's project; `false` means
  `DATABASE_URL` points elsewhere: roll back at once, fix the variable, deploy again);
- `node scripts/smoke.ts --read-only`: every line PASS.

Undo: Netlify > Deploys > the previous production deploy > Publish deploy. Migrations stay.

## 4. Resend: a production key

resend.com > Domains > `play.calvinrdevelopment.com` is Verified. API Keys > Create: name
`ballbattle_production`, Sending access, that domain only. Copy it once as `<RESEND_API_KEY>`.
You should see: the key listed with Sending access. Undo: delete the key.

## 5. Vault secret and the mail relay row

Supabase > production > Vault > Add new secret: name `resend_api_key`, value `<RESEND_API_KEY>`.
Then SQL Editor:

```sql
insert into game.mail_relay (kind, url, sender_name, sender_email, key_name)
values ('resend', 'https://api.resend.com/emails', 'BallBattle', '<SENDER_ADDRESS>', 'resend_api_key');
```

You should see: `select name from vault.secrets where name = 'resend_api_key';` gives one row, and
`select kind, sender_email from game.mail_relay;` one row. Undo: `delete from game.mail_relay;`.

## 6. The two Auth hooks

Supabase > production > Authentication > Auth Hooks > Add hook: **Before User Created**, Postgres,
`public.ballbattle_before_user_created`; **Send Email**, Postgres, `public.ballbattle_send_email`.
Both enabled.

You should see: a guest still starts on the live site (private window > Play a friend > the link
appears), and `node scripts/project-check.ts production` passes and says Auth refuses a sign-up
without a ticket. Undo: disable each hook (only after the browser key is revoked, rollback 2).

## 7. Google sign-in for production

Google Cloud Console > the BallBattle project > Google Auth Platform > Clients > the web client:
add the redirect URI `https://battle-ball.netlify.app/api/v1/auth/google/callback` exactly. Branding:
home page, privacy and terms on the live site. Audience: Publish app (In production).
Supabase > production > Authentication > Providers > Google: on, Client IDs `<GOOGLE_CLIENT_ID>`.

You should see: the provider on in Supabase. Undo: Google off in Supabase, remove the redirect URI.

## 8. Netlify variables, Production context only

Netlify > `battle-ball` > Project configuration > Environment variables. For each, "Different value
for each deploy context", Production only:

| Key                    | Production value                                                                | Scope (Pro)       |
| ---------------------- | ------------------------------------------------------------------------------- | ----------------- |
| `GOOGLE_CLIENT_ID`     | `<GOOGLE_CLIENT_ID>`                                                            | Functions         |
| `GOOGLE_CLIENT_SECRET` | `<GOOGLE_CLIENT_SECRET>`                                                        | Functions, secret |
| `SUPABASE_BROWSER_KEY` | `<BROWSER_POKE_KEY>` (already set: check it is production's `browser_poke` key) | Functions         |
| `BALLBATTLE_POKE`      | `1`                                                                             | Builds, Functions |
| `BALLBATTLE_TURNS`     | `1`                                                                             | Builds, Functions |

`VITE_POKE` and `VITE_TURNS` are no longer set by hand: production builds them from these two.
Nothing changes until the next deploy (step 9 makes it).

You should see: `netlify env:list --context production` lists each key (it prints values: run it
alone). Undo: delete each for Production, then a deploy.

## 9. Accounts and friends on (one deploy carries steps 8 and 9)

`node scripts/friend-switch.ts on --accounts` (your own `netlify login`; argument order matters).
It sets `BALLBATTLE_ACCOUNTS=1` for Production, deploys, and waits for sign-in to answer.

You should see: the script ends "Accounts is on"; `/api/v1/health` has `"accounts":"ok"`,
`"accountsFailed":[]`, `"turns":"on"`, `"pokes":"off"` (the database flag is next); the deploy log
says `dist/ holds no secret`. On a phone: Sign in > email > the code arrives within a minute.
Undo: `node scripts/friend-switch.ts off --accounts` (one deploy).

## 10. Pokes on (instant, no deploy)

`node scripts/poke-switch.ts status production` (off), then
`node scripts/poke-switch.ts on production --production`.

You should see: "production: Pokes are on"; `/api/v1/health` `"pokes":"on"`; signed in, DevTools >
Network shows `GET /api/v1/me/poke` answering a topic and a `wss://wtqmptuhonbtjwxjwtwl.supabase.co`
socket open with no CSP error; its join message has `"private":true` (ADR 0092 addendum: only the
server can send a poke). Undo: `node scripts/poke-switch.ts off production` (instant).

Optional, Calvin, in the dashboard (no deploy): Realtime > Settings > "Allow public access" off,
staging first, then production. Pokes don't need it; off, nobody can open public channels on the
project's Realtime (its connections and messages are ours). Check after: a signed-in page's poke
socket still joins (DevTools > Network > the socket's messages: `phx_reply` with `"status":"ok"`).

## 11. The smoke check and the two-phone test

1. `node scripts/smoke.ts --expect online=on,accounts=on,pokes=on,turns=on`. You should see every
   line PASS: health, the version, the switches, the pages, two test guests through a link to the
   lineups, the poke socket joining, and both guests deleted again.
2. Two phones, two accounts (`docs/turns-playtest.md` has the script):
   - sign up with an email code on each; a username; a friend request and Accept (it reaches the
     other phone within about 3 s);
   - a live challenge: lineups together, a match, a rematch;
   - a game by turns from start to end (and one left to run out, checked the next day);
   - Profile, its stats and match history; block and report from a friend's sheet;
   - Log out on one phone (the other session keeps playing); Delete account on a test account.
     You should see: each works as on staging, with no console errors.

## 12. Monitors

UptimeRobot > New monitor > Keyword, `https://battle-ball.netlify.app/api/v1/health`, every 5
minutes, alert when the keyword is missing: `"status":"ok"`, `"accounts":"ok"`, `"emailSends":"ok"` and `"emailCodes":"ok"` (it turns `near` at 70 codes a day: the early sign of someone spending everyone's codes, audit finding S1).
You should see: all three Up within 5 minutes. Pause them before switching anything off.

## Switching one part off, fastest first

| Part          | Off                                                                       | Takes   |
| ------------- | ------------------------------------------------------------------------- | ------- |
| Pokes         | `node scripts/poke-switch.ts off production` (pages fall back to polling) | instant |
| Every socket  | Supabase > API Keys > `browser_poke` > Revoke                             | instant |
| Email codes   | Netlify Production `BALLBATTLE_EMAIL_CODES=off`, then Trigger deploy      | ~2 min  |
| Play by turns | Netlify Production: delete `BALLBATTLE_TURNS`, then Trigger deploy        | ~2 min  |
| Accounts      | pause the monitors; `node scripts/friend-switch.ts off --accounts`        | ~2 min  |
| vs Friend     | `node scripts/friend-switch.ts off` (ends live matches too)               | ~2 min  |
| Auth hooks    | only after accounts are off and the browser key revoked: disable both     | instant |

## Rolling back the code

Netlify > `battle-ball` > Deploys > the last good production deploy > **Publish deploy**. You should
see `/api/v1/health` answer with that deploy's ruleset within a minute. Migrations stay (expand
only: the old code runs on the new schema). Publish never moves `release` backwards; to publish
again later, merge a fix to `main` and run Publish.

## The week after

- Daily: the Supabase daily check is green; Resend > Emails shows no bounces.
- Weekly: Netlify > Usage (credits against 3,000), Supabase > Usage (Realtime messages and
  connections), `node scripts/reports.ts production` (reported names).
