// A browser, as far as the API can tell: it sends requests from the site's origin, keeps the
// session cookie the API sets, and calls the route handlers directly (no server in between), as a
// Netlify function would. Each `TestBrowser` is one device; two of them are two players.
import { cookieValue, SESSION_COOKIE } from '../cookie.ts';
import { endpoint, type Deps, type RouteHandler } from '../http.ts';

export const ORIGIN = 'https://ballbattle.test';

export interface Answer {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Headers;
}

/**
 * A network address no other browser in this run has: every test file starts its own count from a
 * random base, so two files never share a network's rate limits by accident (they counted against
 * each other when every file's first player was 10.9.0.1). A test that wants one network for two
 * browsers passes the same address to both (`elsewhere` keeps it).
 */
const ipBase = Math.floor(Math.random() * 0x3fff) * 0x100;
let ips = 0;
export function uniqueIp(): string {
  ips += 1;
  const n = ipBase + ips;
  return `10.${String((n >> 16) & 255)}.${String((n >> 8) & 255)}.${String(n & 255)}`;
}

export class TestBrowser {
  /** The session cookie's value, as the browser holds it. */
  cookie: string | undefined;
  /** Every other cookie it holds (a sign-in's own, ADR 0079), by name. */
  readonly jar = new Map<string, string>();
  readonly ip: string;
  readonly deps: Deps;

  constructor(deps: Deps, ip = uniqueIp()) {
    this.deps = deps;
    this.ip = ip;
  }

  /**
   * The same device served by another function instance, with its own database connection: what
   * two requests at once really meet (one instance's single connection would queue them).
   */
  elsewhere(deps: Deps): TestBrowser {
    const twin = new TestBrowser(deps, this.ip);
    twin.cookie = this.cookie;
    for (const [name, value] of this.jar) twin.jar.set(name, value);
    return twin;
  }

  /** Calls `handler` at `path` the way the page's fetch would. */
  async call(
    handler: RouteHandler,
    method: string,
    path: string,
    body?: unknown,
    headers: Readonly<Record<string, string>> = {},
  ): Promise<Answer> {
    const sent = new Headers({ Origin: ORIGIN, ...headers });
    if (body !== undefined && !sent.has('Content-Type')) {
      sent.set('Content-Type', 'application/json');
    }
    const cookies = [
      ...(this.cookie === undefined ? [] : [`${SESSION_COOKIE}=${this.cookie}`]),
      ...[...this.jar].map(([name, value]) => `${name}=${value}`),
    ];
    if (cookies.length > 0) sent.set('Cookie', cookies.join('; '));
    const request = new Request(`${ORIGIN}${path}`, {
      method,
      headers: sent,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const run = endpoint(
      'test',
      handler,
      () => this.deps,
      () => undefined,
    );
    const response = await run(request, { ip: this.ip });
    this.keep(response.headers.getSetCookie());
    const text = await response.text();
    return {
      status: response.status,
      body: text === '' ? undefined : (JSON.parse(text) as unknown),
      headers: response.headers,
    };
  }

  /** Stores or clears each cookie as a browser would. */
  private keep(setCookies: readonly string[]): void {
    for (const line of setCookies) {
      const pair = line.split(';')[0] ?? '';
      const name = pair.slice(0, pair.indexOf('=')).trim();
      const value = cookieValue(pair, name);
      if (value === undefined) continue;
      const gone = /Max-Age=0\b/.test(line) || value === '';
      if (name === SESSION_COOKIE) this.cookie = gone ? undefined : value;
      else if (gone) this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }
}
