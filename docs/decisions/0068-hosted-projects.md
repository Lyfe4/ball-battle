# 0068: The hosted projects: a production database, a daily check, migrations on publish, and the vs Friend switch

- Status: Accepted
- Date: 2026-11-18
- Builds on: ADR 0052 ("Environments", "Before its public launch", section 11's forwarding)
- Amends: ADR 0052 "Environments" (production is migrated by Publish, not the Netlify build;
  staging by a workflow, not a CI job per pull request)

## Context

ADR 0052 planned a production Supabase project, migrations run from the Netlify production build,
and staging migrated by a CI job. Neither was built: staging was migrated by hand, and production
had no database. Before a small beta of vs Friend on the live site, production needs its own
project set up like staging, a way to keep both free projects from pausing (Supabase pauses a free
project after 7 days without activity), proof that Auth still counts each player's own IP, and
migrations that reach each database before the code that needs them.

## Decision

### The production project

- `ballbattle-production` (`wtqmptuhonbtjwxjwtwl`), free plan, Sydney (`ap-southeast-2`), made
  with the CLI on 2026-11-18. The account's two free projects are now staging and production.
- Set up as staging: every migration; `game_api_v2`'s password set before anything connected as it
  (ADR 0052, "a fresh login role"); its own seed key; anonymous sign-ins on, 150 an hour; IP Address
  Forwarding on. The production `DATABASE_URL` uses the transaction pooler on
  `aws-1-ap-southeast-2` (staging's is `aws-0`).
- `scripts/anon-limit-probe.ts` against it (2026-11-18): without a forwarded IP, 150 accepted then
  429; with `Sb-Forwarded-For`, 3 of 3 accepted. Every guest it made was deleted (0 users after).
- Its Netlify settings (production context) are set; `BALLBATTLE_ONLINE` is not, so online play
  stays off (the switch is below).

### One token, no database passwords in GitHub

The workflows use the Supabase CLI with `SUPABASE_ACCESS_TOKEN`, a token the owner scoped to the two
BallBattle projects: database read-write, API keys read, API key secrets read, project read. It
**expires 2027-11-17**: replace it before then (Supabase: Account > Access Tokens; GitHub:
Settings > Environments > `supabase`). The daily check fails on the day it lapses.

- It lives in the GitHub environment `supabase`, whose deployment branches are `main` only, so a
  workflow from any other branch (or a fork) can't read it.
- Not taken: a database URL per project. That needs each project's `postgres` password in GitHub,
  and staging's was never kept; the CLI's login role (made per run through the API) needs none.

### The daily check (`.github/workflows/supabase-daily.yml`)

Every day at 20:17 UTC, for staging and production, `scripts/project-check.ts`:

1. runs `select 1` on the database (activity, so the free project never pauses);
2. signs up one guest as `signUpGuest` does (secret key, `Sb-Forwarded-For` a documentation
   address, 198.51.100.x) and reads the IP Auth recorded on its session (`auth.sessions.ip`);
3. deletes that guest, whatever happened.

The forwarded address on the session means forwarding works. Shown both ways on production
(2026-11-18): with forwarding off, Auth recorded the machine's own address and the check failed;
with it on, the check passed. A failure fails the run, and GitHub emails whoever last changed the
schedule.

- **Cost:** nothing. The repository is public, so Actions minutes are free (about 2 minutes a day
  anyway). Each project gets one sign-up and three small queries a day.
- **What it can't see:** the anonymous limit's number (the token can't read Auth's settings). The
  probe is still run by hand after any change to Auth's rate limits.
- GitHub turns off a public repository's scheduled workflows after 60 days without a commit, and
  emails before it does.

### Migrations reach each database before its code

- **Production, in Publish.** Before `release` moves, the Publish workflow applies the published
  commit's `supabase/migrations` (`scripts/migrate.ts production`: `supabase db push`, then a check
  that production holds exactly the checkout's versions). Any failure stops the run before
  `release` moves: nothing is published. Applying (not refusing) is safe because migrations are
  expand only: the deploy still live works on the new schema for the minutes Netlify takes to build.
  Not taken: migrating in the Netlify build (ADR 0052's plan). It would put an all-powerful token
  in every production build's environment, and a build that fails after migrating is the same
  state as this anyway.
- **Staging, in Migrate staging** (`.github/workflows/migrate-staging.yml`): on every push to `main`
  that changes a migration, and by hand for a pull request whose preview needs its migration first:
  `gh workflow run migrate-staging.yml -f ref=<branch>`. The workflow's code always comes from main;
  `ref` picks only the migrations.
- `supabase db push` refuses a database holding a migration the checkout lacks.
  `scripts/supabase-tools.test.ts` pins every migration file's hash: an applied migration is never
  edited (it would never run again), a change is a new migration.
- Neither workflow runs on pull requests, so the `main` ruleset's required checks are unchanged.

### Guests nobody has seen for 90 days are deleted

ADR 0052 promised this ("Guests") but it wasn't built, and Supabase Auth keeps the IP it records on
each guest's session (`auth.sessions.ip`, the player's own since forwarding) for as long as the
guest exists. The scheduled sweep now deletes up to 25 guests a run whose `last_seen_at` (any
request of theirs, written at most daily) is over 90 days old (`src/server/inactive.ts`), through
Auth, exactly as Forget me: sessions and profile go, open series are forfeited, finished series stay
as "Deleted player". Netlify runs scheduled functions on production only, and with vs Friend off
the sweep does nothing, so this runs from the day the switch is on.

### The vs Friend switch: one variable, one redeploy

vs Friend on the live site is `BALLBATTLE_ONLINE` in Netlify's production context: `1` is on,
unset is off (it starts off). Production's build command (`netlify.toml`, `[context.production]`)
builds the client with `VITE_ONLINE` from that same variable, and the functions read it too, so the
page and the API switch together in one deploy and can never disagree. Off, the production bundle
holds no online code at all (`check-bundle.ts`), and the offline game is the same either way.

- **Flip it:** `node scripts/friend-switch.ts on` (or `off`; `status` reads the live API). It sets
  the variable, starts a production deploy of `release` and waits until `/api/v1/health` answers
  200 (on) or 404 `online_off` (off). By hand: Netlify > battle-ball > Project configuration >
  Environment variables > `BALLBATTLE_ONLINE` > Edit > Production `1` or empty > Save, then Deploys
  > Trigger deploy > Deploy project.
- **Cost and time:** one production deploy, 15 of the Free plan's 300 monthly credits, about 3 to
  5 minutes. The script refuses to switch on while `release` predates this switch.
- Switched off mid-match, live matches stop answering; the players' pages show the failure with
  Try again, and the new build drops vs Friend from home.
- Not taken: a runtime flag in the database. It is faster (seconds, no deploy), but needs either a
  read on every request (about 200 ms from Ohio to Sydney) or a cache that differs per function
  instance, and the client would still be built with online play. For a beta of ten friends, 3 to
  5 minutes is fast enough.

## Consequences

- Nobody applies a migration by hand. A migration that fails on production blocks publishing until
  it is fixed in a new migration.
- Two scheduled failures to expect, both emailed: the token expiring (2027-11-17), and a project
  paused anyway (resume it in the dashboard).
- Supabase Pro for production (backups, no pausing) is still the launch decision ADR 0052 left
  open; the daily check covers pausing until then.
