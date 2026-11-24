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
