// One JSON line per request (ADR 0052, "Logging, monitoring, backups"): request id, route, status,
// duration and user id. Never tokens, cookies, emails or full IPs: the entry is built field by
// field from this fixed shape, so nothing else can slip in by spreading a request or an error.

export interface RequestLog {
  /** Ours, per request (also sent back as `X-Request-Id`). */
  readonly requestId: string;
  /** The route's name, e.g. `series.pick`, never the URL (it can hold a challenge token). */
  readonly route: string;
  readonly method: string;
  readonly status: number;
  readonly durationMs: number;
  /** The player's id, once the request is authenticated. */
  readonly userId?: string | undefined;
  /** An error code we chose (`ApiError`), or `internal`. Never an error's own message. */
  readonly error?: string | undefined;
}

/** Where log lines go: stdout in a function (Netlify collects it), a list in tests. */
export type LogSink = (line: string) => void;

const stdout: LogSink = (line) => {
  process.stdout.write(`${line}\n`);
};

/** The line for one request: exactly these fields, in this order. */
export function logLine(entry: RequestLog): string {
  return JSON.stringify({
    level: entry.status >= 500 ? 'error' : 'info',
    requestId: entry.requestId,
    route: entry.route,
    method: entry.method,
    status: entry.status,
    durationMs: Math.round(entry.durationMs),
    ...(entry.userId === undefined ? {} : { userId: entry.userId }),
    ...(entry.error === undefined ? {} : { error: entry.error }),
  });
}

export function log(entry: RequestLog, sink: LogSink = stdout): void {
  sink(logLine(entry));
}
