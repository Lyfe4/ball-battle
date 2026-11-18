# 0065: Browser jobs run in Playwright's Docker image

- Status: Accepted
- Date: 2026-11-18
- Amends: ADR 0023 (the browser cache and the apt step it named as the risk)

## Context

ADR 0023 cached Playwright's browsers but not their system libraries, which `playwright
install-deps` fetched from the Ubuntu mirror on every run, and named Playwright's Docker image as
the next step "if it becomes a problem". On 2026-11-18 it did: the step that installs those
libraries took 15-65 s on a good run and 6-15 minutes on a slow one (one package of 9 MB took
2.5 minutes), and four browser jobs ran out of their 15 minutes in it before any test ran: WebKit
three times, Chromium once (9 minutes of apt, then its tests finished 4 s after the limit). Each
passed on a re-run, so the cost was whole CI runs and the noise of a red check that meant nothing.

## Decision

The six browser jobs run in `mcr.microsoft.com/playwright:v<version>-noble`, Playwright's image for
the Playwright the lockfile installs. It has that release's browsers and every library they need,
so the jobs install nothing: no browser cache, no apt. The image is pulled from Microsoft's
registry, not the Ubuntu mirror. It is pinned by digest as the actions are pinned by SHA, and runs
as user 1001 (the runner's) as Playwright's docs show for GitHub Actions. `scripts/ci-image.test.ts`
fails when its tag and the installed Playwright differ, so a Playwright update moves both together.

The online flow job stays on the runner: it starts Supabase in Docker beside the page, which a
container job can't do simply. It installs Chromium without `--with-deps`: the runner image ships
Chrome, so Chromium's libraries are already there, and the job no longer waits on apt either.

Rejected: caching apt's downloaded packages (still runs dpkg and its scripts on every job, and
the cache key would need the mirror's package versions); a longer timeout (a slow mirror would
just spend it); retries (the same mirror).

## Consequences

- Positive: browser jobs no longer depend on the Ubuntu mirror; their setup is the image pull
  plus `pnpm install`.
- Positive: every run uses the same browsers and the same fonts and libraries.
- Negative: a Playwright update needs the image tag and digest changed too (the test says so).
- Negative: the image is large; its pull is the setup's main cost: 22-32 s on this PR's first run
  (six jobs), against 15-65 s of apt on a good day before and up to 15 minutes on a bad one.
