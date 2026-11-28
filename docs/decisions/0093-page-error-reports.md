# 0093: The page's own errors reach Sentry through our API, off until switched on

- Status: Accepted (2026-11-28, launch eve)
- Date: 2026-11-28
- Builds on: ADR 0052 (the server's reports, `monitor.ts`; the CSP), ADR 0084 (the function-call
  budget), the 2026-11-28 audit (list 5, item 2: no error reports from the browser)

## Context

A crash on one phone model was never seen: the page had no `error` or `unhandledrejection`
handler. The launch-eve brief asked for reports to Sentry, off unless a browser DSN is set at
build time, loaded after the first paint, scrubbed as the server's are, and with the CSP allowing
Sentry only when on.

The CSP is one static header in `netlify.toml` for every context (`security-headers.ts`, kept in
step by a test). Netlify can't vary it by a variable, and a second CSP header (a `_headers` file,
a `<meta>`) only narrows the first, never widens it. So "allow Sentry only when on" can't be done by
the page talking to Sentry directly without moving how production's CSP is served, the night
before launch.

## Decision

1. **The page posts to its own origin**: `POST /api/v1/client-error` (`src/server/routes/client-error.ts`),
   which sends the event on with the server's own envelope sender (`monitor.ts`, `reportPage`).
   The CSP stays `connect-src 'self'` (plus Realtime) whether reports are on or off, the page holds
   no DSN, and the server scrubs again what the page scrubbed. Same-origin, so no cookie or header
   leaves for Sentry; the event holds the error's type, scrubbed message and frames (files by path
   only), tagged `route: page`, and nothing about the request or the person.
2. **Off unless switched on, at both ends.** The page's reporter is built only where
   `VITE_ERROR_REPORTS` is 1 with online play (production builds it from
   `BALLBATTLE_ERROR_REPORTS`); `check-bundle.ts` fails a build without it that holds the route
   (`ERROR_REPORT_MARK`). The route answers 404 and counts nothing unless the functions have
   `BALLBATTLE_ERROR_REPORTS=1` and `SENTRY_DSN`.
3. **Nothing on the first load.** Two listeners keep up to 5 early failures; the reporter (its own
   chunk, 0.7 kB gzipped) is fetched 1.5 s after `load`, then sends what was kept. Started from
   `mountOnline` (`main.ts` is at its line limit, and reports need online play anyway).
4. **Scrubbed twice, the same rules** (`src/api/scrub.ts`, shared): `scrubbed` (email addresses,
   database values, 300 characters) plus, for a page, quoted text (a username or anything typed),
   4+ digit runs (codes), 20+ character tokens (ids, keys, sessions) and URL queries and fragments.
5. **Bounded.** At most 5 reports a page load, each failure once; 60 an hour from one network
   (`LIMITS.pageErrors`, an HMAC subject like the others). Errors are rare, so this adds almost no
   function calls to ADR 0084's budget; a broken release that fails on every load costs at most
   one call a load.

## Consequences

- Switching it on is variables only (runbook, "Before the day", step 4): `SENTRY_DSN`,
  `BALLBATTLE_ERROR_REPORTS`, and `VITE_ERROR_REPORTS` for branch deploys. The privacy page gains a
  Sentry line first.
- Errors before `mountOnline` runs, or in a build without online play, go unreported.
- A message that names something unquoted (a username in plain text) would still reach Sentry; the
  page's own error texts don't do that today.
