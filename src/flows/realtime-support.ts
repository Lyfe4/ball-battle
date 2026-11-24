// The Realtime poke in the online flows (ADR 0082): every phone may reach the local stack's
// Realtime under netlify dev's CSP (`realtime-policy.ts`), a flow can block the socket to play on
// today's polling, and a page's socket can be watched (joined, and each poke it hears).
import type { BrowserContext, Page } from 'playwright';
import { withLocalRealtime } from './realtime-policy.ts';

/** Gives `context`'s pages from `base` the local Realtime in their connect-src (documents only). */
export async function allowLocalRealtime(context: BrowserContext, base: string): Promise<void> {
  const origin = new URL(base).origin;
  // A page this route fulfils has no address of its own, so Chromium counts it as public and its
  // Local Network Access check refuses the loopback socket: allowed for this origin only.
  await context.grantPermissions(['local-network-access'], { origin });
  await context.route(
    (url) =>
      url.origin === origin &&
      !url.pathname.startsWith('/api/') &&
      !url.pathname.startsWith('/assets/'),
    async (route) => {
      if (route.request().resourceType() !== 'document') {
        await route.fallback();
        return;
      }
      const response = await route.fetch();
      const headers = response.headers();
      const policy = headers['content-security-policy'];
      if (policy !== undefined) headers['content-security-policy'] = withLocalRealtime(policy);
      await route.fulfill({ response, headers });
    },
  );
}

/** Blocks every Realtime socket of `context`: each closes as it opens, so its pages poll as before. */
export async function blockRealtime(context: BrowserContext): Promise<void> {
  await context.routeWebSocket('**/realtime/**', (socket) => {
    void socket.close();
  });
}

export interface PokeWatch {
  /** Whether the page's socket has joined its topic and not closed since. */
  up(): boolean;
  /** Waits for the socket to be joined. */
  waitUp(timeoutMs?: number): Promise<void>;
  /** Every poke the page heard: its event and when, by this process's clock. */
  readonly pokes: { readonly event: string; readonly at: number }[];
  /** How many sockets the page opened. */
  opened(): number;
}

interface Frame {
  readonly topic?: string;
  readonly event?: string;
  readonly payload?: { readonly status?: string; readonly event?: string };
}

/** Watches `page`'s poke socket from now on (attach before the page opens it). */
export function watchPokes(page: Page): PokeWatch {
  let joined = false;
  let opened = 0;
  const pokes: { event: string; at: number }[] = [];
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/realtime/')) return;
    opened += 1;
    socket.on('framereceived', ({ payload }) => {
      let frame: Frame;
      try {
        frame = JSON.parse(String(payload)) as Frame;
      } catch {
        return;
      }
      if (!frame.topic?.startsWith('realtime:p:')) return;
      if (frame.event === 'phx_reply' && frame.payload?.status === 'ok') joined = true;
      if (frame.event === 'broadcast' && frame.payload?.event !== undefined) {
        pokes.push({ event: frame.payload.event, at: Date.now() });
      }
    });
    socket.on('close', () => {
      joined = false;
    });
  });
  return {
    up: () => joined,
    async waitUp(timeoutMs = 15_000) {
      const deadline = Date.now() + timeoutMs;
      while (!joined) {
        if (Date.now() > deadline) throw new Error('The poke socket never joined');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    },
    pokes,
    opened: () => opened,
  };
}

/** Each time `page` asked for `path` (`/api/v1/…`), by this process's clock. */
export function watchReads(page: Page, path: string): number[] {
  const times: number[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === path) times.push(Date.now());
  });
  return times;
}

/** One API read a watched page made: its path, when it went out and when its answer was in. */
interface Read {
  readonly path: string;
  readonly at: number;
  done?: number;
}

/** Each watched page's socket and API reads (`watchPage`). */
const watched = new WeakMap<Page, { readonly socket: PokeWatch; readonly reads: Read[] }>();

/** Watches `page`'s poke socket and every API read it makes, from now on. */
export function watchPage(page: Page): void {
  const reads: Read[] = [];
  const out = new Map<object, Read>();
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (request.method() === 'GET' && pathname.startsWith('/api/v1/')) {
      const read: Read = { path: pathname, at: Date.now() };
      reads.push(read);
      out.set(request, read);
    }
  });
  const finish = (request: object) => {
    const read = out.get(request);
    if (read === undefined) return;
    read.done = Date.now();
    out.delete(request);
  };
  page.on('requestfinished', finish);
  page.on('requestfailed', finish);
  watched.set(page, { socket: watchPokes(page), reads });
}

/** The poke socket of a page `watchPage` watches. */
export function socketOf(page: Page): PokeWatch {
  const found = watched.get(page);
  if (found === undefined) throw new Error('This page is not watched (watchPage)');
  return found.socket;
}

/** How many reads `page` made of a path starting `prefix`, from `from` to `to` (this clock). */
export function readsBetween(page: Page, prefix: string, from: number, to = Date.now()): number {
  const found = watched.get(page);
  if (found === undefined) throw new Error('This page is not watched (watchPage)');
  return found.reads.filter(
    (read) => read.path.startsWith(prefix) && read.at >= from && read.at <= to,
  ).length;
}

/**
 * Over `ms` from now, how many times `page` read a path starting `prefix`: with the socket up a
 * screen reads only on pokes and its safety read; blocked, on today's cadence.
 */
export async function readsOver(page: Page, prefix: string, ms: number): Promise<number> {
  const from = Date.now();
  await new Promise((resolve) => setTimeout(resolve, ms));
  return readsBetween(page, prefix, from);
}

/**
 * Waits until `page` has read a path starting `prefix` since `since` (this clock), then made no such
 * read for `quietMs` with none out: the reads a screen makes on arriving (and on a poke still on its
 * way) are over, so what follows is its steady pace.
 */
export async function quietFor(
  page: Page,
  prefix: string,
  since: number,
  quietMs: number,
  timeoutMs = 15_000,
): Promise<void> {
  const found = watched.get(page);
  if (found === undefined) throw new Error('This page is not watched (watchPage)');
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ours = found.reads.filter((read) => read.path.startsWith(prefix) && read.at >= since);
    const last = ours.at(-1);
    const out = ours.some((read) => read.done === undefined);
    if (last?.done !== undefined && !out && Date.now() - last.done >= quietMs) return;
    if (Date.now() > deadline) {
      throw new Error(`${prefix} reads never went quiet for ${String(quietMs)} ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * Over `ms` from now, how long `page` waited between one read of a path starting `prefix` and the
 * next (from an answer to the next request), each wait: what the page chose, whatever a read took.
 */
export async function waitsOver(page: Page, prefix: string, ms: number): Promise<number[]> {
  const found = watched.get(page);
  if (found === undefined) throw new Error('This page is not watched (watchPage)');
  const from = Date.now();
  await new Promise((resolve) => setTimeout(resolve, ms));
  const ours = found.reads.filter((read) => read.path.startsWith(prefix));
  const waits: number[] = [];
  for (let i = 1; i < ours.length; i += 1) {
    const [before, read] = [ours[i - 1], ours[i]];
    if (before?.done === undefined || read === undefined || read.at < from) continue;
    waits.push(read.at - before.done);
  }
  return waits;
}
