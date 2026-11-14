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

export class TestBrowser {
  /** The session cookie's value, as the browser holds it. */
  cookie: string | undefined;
  readonly ip: string;
  readonly deps: Deps;

  constructor(deps: Deps, ip = '203.0.113.10') {
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
    if (this.cookie !== undefined) sent.set('Cookie', `${SESSION_COOKIE}=${this.cookie}`);
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

  /** Stores or clears the session cookie as a browser would. */
  private keep(setCookies: readonly string[]): void {
    for (const line of setCookies) {
      const value = cookieValue(line.split(';')[0] ?? '', SESSION_COOKIE);
      if (value === undefined) continue;
      this.cookie = /Max-Age=0\b/.test(line) || value === '' ? undefined : value;
    }
  }
}
