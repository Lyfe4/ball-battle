# Contributing

How to set up, test and ship a change. The full rules are in [CLAUDE.md](CLAUDE.md); the map of the
system is [ARCHITECTURE.md](ARCHITECTURE.md).

## Set up, by what you are changing

1. **The game only** (sim, rendering, UI, sound): Node 24+, `corepack enable`, `pnpm install`,
   `pnpm dev` (http://localhost:5199). Nothing else.
2. **The API or database**: also Docker, then `pnpm exec supabase start` and `pnpm test:db`.
   A new migration: `pnpm exec supabase migration new <name>`, then `pnpm exec supabase db reset`.
3. **Online play end to end**: also the Netlify CLI. `node scripts/local-env.ts > .env`,
   `pnpm build:online`, `netlify dev` (http://localhost:8888), then `pnpm test:online`. Restart
   `netlify dev` after changing `src/server`.

## Which tests to run

| You changed                        | Run                                                                  |
| ---------------------------------- | -------------------------------------------------------------------- |
| anything                           | `pnpm lint`, `pnpm typecheck`, `pnpm test`                           |
| a screen, CSS or a flow            | `pnpm exec vitest run --project "browsers* (chromium)"`              |
| a ball, an ability or combat rules | `pnpm test:slow`, `pnpm balance`, and the ruleset steps in CLAUDE.md |
| `src/server` or a migration        | `pnpm test:db` (after `supabase db reset` if online tests ran)       |
| online screens or live timing      | `pnpm test:online` against `netlify dev`                             |

Firefox and WebKit run in CI; locally one engine at a time (`--project "browsers* (firefox)"`).
Browser tests play sound in Firefox: mute first.

## Shipping

1. A branch and a pull request into `main`; Conventional Commits, small, the body says why.
2. CI must be green (14 jobs, 11 required). Never `--no-verify`. Fix a red check on the branch.
3. Merge with a merge commit (`gh pr merge --auto --merge --delete-branch`). `main` builds staging.
4. A decision worth keeping is a numbered ADR in `docs/decisions/` and a row in its README.
5. Production is published in batches by the owner (`gh workflow run publish.yml`), never by a
   merge.

## Rules that catch people out

- `src/sim` is pure: no DOM, `Date`, `Math.random`, timers or transcendental maths. Anything that
  can change a fight bumps `RULESET_VERSION` and refreshes the golden results.
- Migrations are expand only and never applied to a hosted project by hand
  (`scripts/supabase-tools.test.ts` fails on a drop, rename or tightening).
- Files stay under 300 lines; a new screen gets a route, a screen key and a history flow.
- Browser tests never use a random seed and never resize the viewport.
