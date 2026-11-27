// Error reporting (ADR 0052): unexpected errors in the functions go to Sentry. Only errors we didn't
// expect are sent (an `ApiError` is an answer, not a fault), and only what is built here: the
// error's type, message and stack, the route and the request id. No request, cookie, header, IP,
// body or user is ever in an event, so personal data stays off whatever an SDK's defaults become.
// It speaks Sentry's documented envelope protocol with `fetch`, rather than the Node SDK, whose
// OpenTelemetry instrumentation a function has no use for and Netlify's bundler can't trace.

/** Where events go, read from a DSN: `https://<key>@<host>/<project>`. */
export interface SentryTarget {
  readonly url: string;
  readonly key: string;
  readonly dsn: string;
}

export function targetOf(dsn: string): SentryTarget | undefined {
  let parsed: URL;
  try {
    parsed = new URL(dsn);
  } catch {
    return undefined;
  }
  const project = parsed.pathname.split('/').filter(Boolean).at(-1);
  if (parsed.protocol !== 'https:' || parsed.username === '' || project === undefined) {
    return undefined;
  }
  return {
    url: `https://${parsed.host}/api/${project}/envelope/`,
    key: parsed.username,
    dsn,
  };
}

interface Frame {
  readonly function?: string;
  readonly filename?: string;
  readonly lineno?: number;
  readonly colno?: number;
}

/** A V8 stack's frames, oldest first as Sentry wants them. Lines it can't read are skipped. */
export function framesOf(stack: string | undefined): Frame[] {
  const frames: Frame[] = [];
  for (const line of (stack ?? '').split('\n').slice(1)) {
    const match = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line);
    if (match === null) continue;
    const [, name, file, row, column] = match;
    frames.push({
      ...(name === undefined ? {} : { function: name }),
      ...(file === undefined ? {} : { filename: file }),
      lineno: Number(row),
      colno: Number(column),
    });
  }
  return frames.reverse();
}

/**
 * An error's message as it leaves for the error service (2026-11-28 audit): an email address or a
 * `(key)=(value)` pair (a database detail) is replaced, and it is cut at 300 characters, so a
 * message that quotes what a player sent (a JSON parse error, say) carries none of it.
 */
export function scrubbed(message: string): string {
  return message
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
    .replace(/\)=\([^)]*\)/g, ')=(…)')
    .slice(0, 300);
}

/** The one event sent for an error: nothing about the request or the person. */
export function eventOf(
  error: unknown,
  tags: Readonly<Record<string, string>>,
  eventId: string,
  timestamp: number,
): Record<string, unknown> {
  const known = error instanceof Error ? error : new Error(String(error));
  return {
    event_id: eventId,
    timestamp,
    platform: 'node',
    level: 'error',
    tags,
    exception: {
      values: [
        {
          type: known.name,
          value: scrubbed(known.message),
          stacktrace: { frames: framesOf(known.stack) },
        },
      ],
    },
  };
}

let target: SentryTarget | undefined;

/** Starts reporting for this function instance, when a valid DSN is configured. */
export function startMonitor(dsn: string | undefined): void {
  target = dsn === undefined ? undefined : targetOf(dsn);
}

/** Reports an unexpected error and waits (briefly) for it to be sent; never throws. */
export async function report(
  error: unknown,
  tags: { readonly route: string; readonly requestId: string },
  send: typeof fetch = fetch,
): Promise<void> {
  if (target === undefined) return;
  const eventId = crypto.randomUUID().replaceAll('-', '');
  const event = eventOf(error, tags, eventId, Date.now() / 1000);
  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: target.dsn }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');
  try {
    await send(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=ballbattle/1`,
      },
      body: envelope,
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Reporting must never turn an answer into a second failure.
  }
}
