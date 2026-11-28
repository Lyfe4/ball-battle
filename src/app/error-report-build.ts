// Whether this build reports the page's own errors (launch eve, `error-report.ts`): only with
// online play, and only where `VITE_ERROR_REPORTS` is 1 (production builds it from
// `BALLBATTLE_ERROR_REPORTS`, netlify.toml). Vite writes the value in, so without it the reporter
// and its listeners are left out of the bundle (`scripts/check-bundle.ts`, ERROR_REPORT_MARK).
import { ONLINE_BUILD } from './online-build.ts';
import { startErrorReports } from './error-report-start.ts';

export const ERROR_REPORT_BUILD: boolean =
  ONLINE_BUILD && import.meta.env.VITE_ERROR_REPORTS === '1';

/** Starts the reports where this build has them: the reporter is its own chunk, fetched late. */
export function installErrorReports(): void {
  // The condition is written out, not ERROR_REPORT_BUILD: the bundler drops a dynamic import
  // (and its chunk) only behind a condition it can read here.
  if (import.meta.env.VITE_ONLINE === '1' && import.meta.env.VITE_ERROR_REPORTS === '1') {
    startErrorReports(window, () => import('./error-report.ts').then((m) => m.reporter));
  }
}
