// POST /api/v1/client-error (launch eve): a page's uncaught error or unhandled rejection, scrubbed
// on the page (`scrub.ts`) and again on the server, which forwards it to the error service. Built
// into the page only where `VITE_ERROR_REPORTS` is 1 (`src/app/error-report-build.ts`), answered
// only where the functions have `BALLBATTLE_ERROR_REPORTS` and `SENTRY_DSN`.

export interface ClientErrorReport {
  /** An `error` event, or an `unhandledrejection`. */
  readonly kind: 'error' | 'rejection';
  /** The error's type, `Error` or `TypeError` (`Error` when unknown). */
  readonly type: string;
  readonly message: string;
  /** The stack as the browser wrote it, scrubbed; empty when none. */
  readonly stack: string;
}

/** A report from outside, or undefined: never throws. Anything over its length is refused. */
export function decodeClientError(raw: unknown): ClientErrorReport | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { kind, type, message, stack } = raw as Record<string, unknown>;
  if (kind !== 'error' && kind !== 'rejection') return undefined;
  if (typeof type !== 'string' || !/^\w{1,40}$/.test(type)) return undefined;
  if (typeof message !== 'string' || message.length > 2000) return undefined;
  if (typeof stack !== 'string' || stack.length > 2500) return undefined;
  return { kind, type, message, stack };
}
