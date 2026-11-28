// Error reporting (ADR 0052): unexpected errors in the functions go to Sentry. Only errors we didn't
// expect are sent (an `ApiError` is an answer, not a fault), and only what is built here: the
// error's type, message and stack, the route and the request id. No request, cookie, header, IP,
// body or user is ever in an event, so personal data stays off whatever an SDK's defaults become.
// It speaks Sentry's documented envelope protocol with `fetch`, rather than the Node SDK, whose
// OpenTelemetry instrumentation a function has no use for and Netlify's bundler can't trace.
// A page's own errors (launch eve) come through POST /api/v1/client-error and leave here too
// (`pageEventOf`), scrubbed again by `pageScrubbed`.
import type { ClientErrorReport } from '../api/client-error.ts';
import { pageScrubbed, pageStackScrubbed, scrubbed } from '../api/scrub.ts';

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
    const match =
      /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line) ??
      // Firefox and Safari: `name@file:line:column`, the name possibly empty.
      /^\s*(?:([^@\s]*)@)?(\S+?):(\d+):(\d+)$/.exec(line);
    if (match === null) continue;
    const [, rawName, file, row, column] = match;
    const name = rawName === '' ? undefined : rawName;
    frames.push({
      ...(name === undefined ? {} : { function: name }),
      ...(file === undefined ? {} : { filename: file }),
      lineno: Number(row),
      colno: Number(column),
    });
  }
  return frames.reverse();
}

export { scrubbed };

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
  await sendEvent(eventOf(error, tags, eventId, Date.now() / 1000), eventId, send);
}

/** The one event sent for a page's error: what the page sent, scrubbed again, and nothing else. */
export function pageEventOf(
  page: ClientErrorReport,
  eventId: string,
  timestamp: number,
): Record<string, unknown> {
  // Frames' files lose their origin: the page's own assets, by path.
  const frames = framesOf(`\n${pageStackScrubbed(page.stack)}`).map((frame) =>
    frame.filename === undefined
      ? frame
      : { ...frame, filename: frame.filename.replace(/^[a-z][\w+.-]*:\/\/[^/]*/i, '') },
  );
  return {
    event_id: eventId,
    timestamp,
    platform: 'javascript',
    level: 'error',
    tags: { route: 'page', kind: page.kind },
    exception: {
      values: [{ type: page.type, value: pageScrubbed(page.message), stacktrace: { frames } }],
    },
  };
}

/** Reports a page's error, as `report` does; false when reporting is off here. Never throws. */
export async function reportPage(
  page: ClientErrorReport,
  send: typeof fetch = fetch,
): Promise<boolean> {
  if (target === undefined) return false;
  const eventId = crypto.randomUUID().replaceAll('-', '');
  await sendEvent(pageEventOf(page, eventId, Date.now() / 1000), eventId, send);
  return true;
}

async function sendEvent(
  event: Record<string, unknown>,
  eventId: string,
  send: typeof fetch,
): Promise<void> {
  if (target === undefined) return;
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
