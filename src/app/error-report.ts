// The page's error reporter (launch eve), loaded on its own after the first paint
// (`error-report-start.ts`): each uncaught error or unhandled rejection, scrubbed here
// (`pageScrubbed`) and again on the server, is posted to the game's own API, which sends it on to
// the error service. The page never talks to the error service itself, so the CSP stays
// `connect-src 'self'` and no DSN is in the bundle. At most 5 a page load, each failure once.
import type { ClientErrorReport } from '../api/client-error.ts';
import { pageScrubbed, pageStackScrubbed } from '../api/scrub.ts';
import type { ErrorKind, Reporter } from './error-report-start.ts';

export const ENDPOINT = '/api/v1/client-error';
const MAX_A_LOAD = 5;

/** The report for a failure, scrubbed: undefined for what tells nothing (a cross-origin script). */
export function reportOf(kind: ErrorKind, reason: unknown): ClientErrorReport | undefined {
  const error = reason instanceof Error ? reason : undefined;
  const message = error?.message ?? (typeof reason === 'string' ? reason : String(reason));
  if (error === undefined && /^Script error\.?$/.test(message)) return undefined;
  const type = error !== undefined && /^\w{1,40}$/.test(error.name) ? error.name : 'Error';
  return {
    kind,
    type,
    message: pageScrubbed(message),
    stack: pageStackScrubbed(error?.stack ?? ''),
  };
}

/** A reporter that posts through `send`; the same failure twice is sent once. */
export function createReporter(send: (body: string) => Promise<unknown>): Reporter {
  const sent = new Set<string>();
  return {
    report(kind, reason) {
      const report = reportOf(kind, reason);
      if (report === undefined || sent.size >= MAX_A_LOAD) return;
      const key = `${report.type}:${report.message}`;
      if (sent.has(key)) return;
      sent.add(key);
      send(JSON.stringify(report)).catch(() => {
        // A report that can't be sent is dropped: it must never become a failure of its own.
      });
    },
  };
}

/** The reporter the page uses: same-origin, kept alive past a page being closed. */
export const reporter: Reporter = createReporter((body) =>
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    credentials: 'same-origin',
    keepalive: true,
  }),
);
