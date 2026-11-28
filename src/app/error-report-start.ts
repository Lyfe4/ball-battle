// Starts the page's error reports (launch eve) without growing the first load: two listeners keep
// what fails early, and the reporter itself (`error-report.ts`, its own chunk) is fetched only
// after the page has loaded and painted, then sent what was kept. Called only where
// ERROR_REPORT_BUILD, so a build without it holds none of this.

export type ErrorKind = 'error' | 'rejection';

/** What the reporter module offers: one call a failure. */
export interface Reporter {
  readonly report: (kind: ErrorKind, reason: unknown) => void;
}

/** The window's parts this uses (a fake in tests). */
export interface ErrorWindow {
  // The events' parts it reads, structurally: an ErrorEvent and a PromiseRejectionEvent.
  addEventListener(
    type: 'error',
    listener: (event: { readonly error?: unknown; readonly message: string }) => void,
  ): void;
  addEventListener(
    type: 'unhandledrejection',
    listener: (event: { readonly reason: unknown }) => void,
  ): void;
  addEventListener(type: 'load', listener: () => void): void;
  readonly document: { readonly readyState: string };
  setTimeout(handler: () => void, ms: number): unknown;
}

/** How long after `load` the reporter is fetched: past the first paint and the first frames. */
export const REPORTER_AFTER_LOAD_MS = 1500;

/** At most this many failures are kept before the reporter arrives. */
const KEPT = 5;

export function startErrorReports(win: ErrorWindow, loadReporter: () => Promise<Reporter>): void {
  const kept: [ErrorKind, unknown][] = [];
  let reporter: Reporter | undefined;
  const take = (kind: ErrorKind, reason: unknown) => {
    if (reporter !== undefined) reporter.report(kind, reason);
    else if (kept.length < KEPT) kept.push([kind, reason]);
  };
  win.addEventListener('error', (event) => {
    take('error', event.error ?? event.message);
  });
  win.addEventListener('unhandledrejection', (event) => {
    take('rejection', event.reason);
  });
  const fetchReporter = () => {
    win.setTimeout(() => {
      loadReporter().then(
        (loaded) => {
          reporter = loaded;
          for (const [kind, reason] of kept.splice(0)) loaded.report(kind, reason);
        },
        () => {
          // Offline, or a deploy replaced the chunk: errors go unreported, never a new one.
        },
      );
    }, REPORTER_AFTER_LOAD_MS);
  };
  if (win.document.readyState === 'complete') fetchReporter();
  else win.addEventListener('load', fetchReporter);
}
