// Every route's frame (ADR 0052, section 7): a request id, the online switch, error answers in the
// API's shape, one log line, and unexpected errors to the monitor. A Netlify function file is just
// `export default endpoint('health', health)`; tests call the same handler with their own deps.
import type { ErrorBody } from '../api/errors.ts';
import { ApiError } from './http-error.ts';
import { configOf, type Config } from './config.ts';
import { databaseFor, type Sql } from './db.ts';
import { failureOf, type Stage } from './failure.ts';
import { log, type LogSink } from './log.ts';
import { report, startMonitor } from './monitor.ts';

/** What a route works with: the configuration and the database. */
export interface Deps {
  readonly config: Config;
  readonly sql: Sql;
  /**
   * The time access tokens are checked against: the host's clock (with a tolerance) unless a test
   * moves it. Game rules never read it; they use database time.
   */
  readonly tokenClock?: () => Date;
}

export interface RouteContext {
  readonly deps: Deps;
  readonly requestId: string;
  /** The client's IP as Netlify saw it; used only as a rate-limit key, never logged or stored. */
  readonly ip: string | undefined;
  /** Names the player in the log line, once the request is authenticated. */
  setUser(id: string): void;
  /** Adds a `Set-Cookie` to the answer, whether the route succeeds or fails. */
  setCookie(value: string): void;
  /** A failure the route answered for itself (a health check): logged by stage and kind. */
  readonly noteFailure: (error: unknown, stage: Stage) => void;
}

export type RouteHandler = ((request: Request, context: RouteContext) => Promise<Response>) & {
  /**
   * The requests this route still answers with online play switched off: deleting players only
   * (Forget me, the sweep), so that never waits on the vs Friend switch (ADR 0078).
   */
  readonly whileOff?: (request: Request) => boolean;
};

/** `handler`, answering `when` it asks even with online play switched off (ADR 0078). */
export function alsoWhileOff(
  handler: (request: Request, context: RouteContext) => Promise<Response>,
  when: (request: Request) => boolean = () => true,
): RouteHandler {
  return Object.assign(handler, { whileOff: when });
}

export { ApiError } from './http-error.ts';

/** API answers are never cached by a browser or a CDN, except as a route says (an ETag). */
const NO_STORE = { 'Cache-Control': 'no-store' };

export function json(
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): Response {
  return new Response(status === 204 || status === 304 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...NO_STORE, ...headers },
  });
}

export function problem(error: ApiError): Response {
  const body: ErrorBody = { error: { code: error.code, message: error.message } };
  return json(error.status, body, error.headers);
}

/** The process's own dependencies: read once per function instance, reused while it is warm. */
let shared: Deps | undefined;
function processDeps(): Deps | undefined {
  if (shared !== undefined) return shared;
  const config = configOf(process.env);
  if (config === undefined) return undefined;
  startMonitor(config.sentryDsn);
  shared = { config, sql: databaseFor(config.databaseUrl) };
  return shared;
}

/** Netlify's own per-invocation details, as far as a route uses them. */
interface PlatformContext {
  readonly ip?: string;
  readonly requestId?: string;
}

/**
 * A route as a function handler. `depsOf` is the process's own unless a test gives its own;
 * `sink` is where the log line goes.
 */
export function endpoint(
  name: string,
  handler: RouteHandler,
  depsOf: () => Deps | undefined = processDeps,
  sink?: LogSink,
): (request: Request, platform?: PlatformContext) => Promise<Response> {
  return async (request, platform) => {
    const started = performance.now();
    const requestId = platform?.requestId ?? crypto.randomUUID();
    let userId: string | undefined;
    const cookies: string[] = [];
    const failures: string[] = [];
    let errorCode: string | undefined;
    let response: Response;
    try {
      const deps = depsOf();
      if (deps === undefined || (!deps.config.online && handler.whileOff?.(request) !== true)) {
        throw new ApiError(404, 'online_off', 'Online play is not switched on here');
      }
      response = await handler(request, {
        deps,
        requestId,
        ip: platform?.ip,
        setUser: (id) => {
          userId = id;
        },
        setCookie: (value) => {
          cookies.push(value);
        },
        noteFailure: (error, stage) => {
          failures.push(failureOf(error, stage));
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        errorCode = error.code;
        if (error.status >= 500) failures.push(failureOf(error));
        response = problem(error);
      } else {
        failures.push(failureOf(error));
        errorCode = 'internal';
        await report(error, { route: name, requestId });
        response = problem(new ApiError(500, 'internal', 'Something went wrong on our side'));
      }
    }
    response.headers.set('X-Request-Id', requestId);
    for (const cookie of cookies) response.headers.append('Set-Cookie', cookie);
    const entry = {
      requestId,
      route: name,
      method: request.method,
      status: response.status,
      durationMs: performance.now() - started,
      userId,
      error: errorCode,
      failure: failures.length === 0 ? undefined : failures.join('; '),
    };
    log(entry, sink);
    return response;
  };
}
