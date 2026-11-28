# Launch checklist: staging vs production

What production must hold so that it matches staging once accounts, friends, pokes and play by
turns are on. Read on 28 November 2026 (audit), read-only: Netlify's variables by name and context
(values never printed; secret values come back masked, so they can't be compared), the public Auth
settings and `/health` of both. Anything that needs the dashboard or an owner's token is marked
**Calvin to check**, with where to look. The order to change things in is
[launch-day-runbook.md](launch-day-runbook.md).

Projects: staging is Netlify `main--battle-ball.netlify.app` with Supabase `ballbattle-staging`
(`fcmzgitzaaabcmbzxxcg`); production is `battle-ball.netlify.app` with `ballbattle-production`
(`wtqmptuhonbtjwxjwtwl`).

## Netlify: site and build

| Setting            | Staging (branch deploy)        | Production today                    | Change for launch                                                      |
| ------------------ | ------------------------------ | ----------------------------------- | ---------------------------------------------------------------------- |
| Plan               | legacy free (`nf_team_dev`)    | same site                           | Pro, credit-based (runbook step 1)                                     |
| Functions region   | `us-east-2` (Ohio)             | `us-east-2` (Ohio)                  | Sydney `ap-southeast-2` (step 1), privacy page too                     |
| Build command      | `pnpm build` + `[context]` env | builds `VITE_*` from `BALLBATTLE_*` | none (this audit made `VITE_POKE`, `VITE_TURNS` follow their switches) |
| Release built from | `main`                         | `release`                           | Publish moves it (step 3)                                              |
| Node               | 24 (`netlify.toml`)            | 24                                  | none                                                                   |

## Netlify: environment variables (names only)

"set" means a value exists for that context; "empty" an entry with no value.

| Variable                   | Secret | Staging       | Production today                           | For launch                                                                                                                           |
| -------------------------- | ------ | ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `BALLBATTLE_ONLINE`        | no     | `1`           | `1`                                        | keep                                                                                                                                 |
| `BALLBATTLE_ACCOUNTS`      | no     | `1`           | empty                                      | `1` (`friend-switch.ts on --accounts`, step 9)                                                                                       |
| `BALLBATTLE_POKE`          | no     | `1`           | not set                                    | `1` (step 8)                                                                                                                         |
| `VITE_POKE`                | no     | `1`           | not set                                    | nothing: production now builds it from `BALLBATTLE_POKE`                                                                             |
| `BALLBATTLE_TURNS`         | no     | `1`           | not set                                    | `1` (step 11)                                                                                                                        |
| `SUPABASE_URL`             | no     | set (staging) | set (production project, verified by host) | keep                                                                                                                                 |
| `SUPABASE_PUBLISHABLE_KEY` | no     | set           | set, differs                               | keep                                                                                                                                 |
| `SUPABASE_BROWSER_KEY`     | no     | set           | set, differs                               | keep; **Calvin to check** it is production's `browser_poke` key (Supabase > production > API Keys)                                   |
| `SUPABASE_SECRET_KEY`      | yes    | set           | set                                        | keep; scope to Functions once on Pro                                                                                                 |
| `DATABASE_URL`             | yes    | set           | set                                        | check `/health` `"dbMatchesUrl":true` after the publish (masked to the API; the functions compare its project with `SUPABASE_URL`'s) |
| `SEED_KEYS`                | yes    | set           | set                                        | keep                                                                                                                                 |
| `GOOGLE_CLIENT_ID`         | yes    | set           | empty                                      | production's client id (step 7)                                                                                                      |
| `GOOGLE_CLIENT_SECRET`     | yes    | set           | empty                                      | production's secret (step 7); scope to Functions                                                                                     |
| `BALLBATTLE_EMAIL_CODES`   | no     | not set (on)  | not set (on)                               | keep unset; `off` is the emergency switch                                                                                            |
| `SENTRY_DSN`               | yes    | not set       | not set                                    | recommended: set for both, staging first, after the privacy line (runbook "Before the day", step 4)                                  |
| `BALLBATTLE_ERROR_REPORTS` | no     | not set (off) | not set (off)                              | `1` with `SENTRY_DSN` to take pages' error reports (Builds, Functions; production builds `VITE_ERROR_REPORTS` from it)               |
| `VITE_ERROR_REPORTS`       | no     | not set (off) | not set                                    | staging only: `1` beside the one above (branch deploys build from it); never set for production                                      |

## Supabase: Auth

Public settings (`/auth/v1/settings`) read for both on 28 November:

| Setting                                    | Staging                  | Production       | For launch            |
| ------------------------------------------ | ------------------------ | ---------------- | --------------------- |
| Providers on                               | anonymous, email, Google | anonymous, email | Google on (step 7)    |
| Confirm email (`mailer_autoconfirm` false) | on                       | on               | keep                  |
| Sign-ups allowed                           | yes                      | yes              | keep (guests need it) |
| Phone, SAML                                | off                      | off              | keep                  |

Dashboard-only, **Calvin to check** on both (Authentication in the Supabase dashboard). The values
on the right are what the code and `supabase/config.toml` expect:

| Setting (where)                                             | Expected                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Email OTP length (Providers > Email)                        | 6 (the code, the copy and the hook expect 6)                                                                 |
| Email OTP expiry (Providers > Email)                        | 600 s (the privacy page says 10 minutes)                                                                     |
| Allow manual linking                                        | off                                                                                                          |
| Anonymous sign-ins                                          | on                                                                                                           |
| Secure email change                                         | on                                                                                                           |
| Rate limits: emails sent per hour                           | 100                                                                                                          |
| Rate limits: anonymous sign-ins per hour                    | 150                                                                                                          |
| Rate limits: token verifications (per 5 min, per IP)        | lower than today: 10 (last night's medium; staging first)                                                    |
| Rate limits: token refreshes (per 5 min, per IP)            | at least 1,800 in production: every player refreshes through the functions' few addresses (audit finding S3) |
| Sessions: refresh token rotation, reuse interval            | on, 300 s                                                                                                    |
| SMTP (Emails > SMTP)                                        | Resend, `smtp.resend.com:465`, sender on `play.calvinrdevelopment.com`                                       |
| Templates: Confirm signup, Magic link, Change email         | subject "Your BallBattle code", body `supabase/templates/code.html`                                          |
| Auth Hooks: Before User Created                             | `public.ballbattle_before_user_created`, on                                                                  |
| Auth Hooks: Send Email                                      | `public.ballbattle_send_email`, on                                                                           |
| Vault secret `resend_api_key` and the `game.mail_relay` row | present (runbook steps 5-6)                                                                                  |
| URL configuration: Site URL                                 | the site's own URL                                                                                           |
| JWT signing keys                                            | asymmetric (ES256), legacy secret not in use                                                                 |

## Supabase: database, Realtime and the rest

| Setting                                    | Staging              | Production                                  | For launch                                                                                                                                         |
| ------------------------------------------ | -------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations                                 | all applied          | up to 23 November                           | Publish applies the rest (step 3), all expand only                                                                                                 |
| `game.flags` `poke`                        | on                   | off                                         | on (`poke-switch.ts on production --production`, step 10)                                                                                          |
| RLS on `game.*`                            | on, no client grants | same (migrations)                           | none                                                                                                                                               |
| Extensions (`pg_net`, `pgcrypto`, Vault)   | on                   | **Calvin to check** (Database > Extensions) | `pg_net` must be on for the mail relay                                                                                                             |
| Realtime: "Allow public access" (channels) | on                   | **Calvin to check**                         | Calvin's call, staging first: pokes use listen-only private channels (ADR 0092 addendum), so off works and also refuses strangers' public channels |
| Realtime quotas (connections, messages)    | free plan            | free plan                                   | check weekly in Usage                                                                                                                              |
| Cron jobs (`pg_cron`)                      | none                 | none                                        | none: the sweep is a Netlify scheduled function                                                                                                    |
| Storage buckets                            | none                 | none                                        | none                                                                                                                                               |
| Plan and backups                           | free                 | free: no downloadable backups               | **Pro before launch** (daily backups, 7 days), and one restore drill into staging                                                                  |
| Daily check (`supabase-daily.yml`)         | green                | green                                       | keep; it now also covers the mail watch                                                                                                            |

## Switches, on launch day

| Switch                   | How                                                                      | Check                                |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------ |
| vs Friend                | already on (`friend-switch.ts status`)                                   | `/health` 200                        |
| Accounts and friends     | `node scripts/friend-switch.ts on --accounts`                            | `/health` `"accounts":"ok"`          |
| Pokes (build, functions) | Netlify Production `BALLBATTLE_POKE=1` (with the deploy above)           | `/health` `"pokes"` (after the flag) |
| Pokes (database)         | `node scripts/poke-switch.ts on production --production`                 | `/health` `"pokes":"on"`             |
| Play by turns            | Netlify Production `BALLBATTLE_TURNS=1`, then a deploy                   | `/health` `"turns":"on"`             |
| All of it                | `node scripts/smoke.ts --expect online=on,accounts=on,pokes=on,turns=on` | every line PASS                      |
