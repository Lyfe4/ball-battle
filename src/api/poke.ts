// GET /api/v1/me/poke (ADR 0082): where this player's page may listen for pokes, or that it may not.
// A poke is an empty broadcast (`inbox` or `match`) on a public Realtime channel whose topic is the
// player's own unguessable key; on one, the page does the read it would have done anyway.

/** The events a poke can carry; anything else on the channel is ignored. */
export const POKE_EVENTS = ['inbox', 'match'] as const;
export type PokeEvent = (typeof POKE_EVENTS)[number];

/** Pokes are off (switched off, or this build's functions have none): poll as always. */
export interface PokeOff {
  readonly off: true;
}

/** Where to listen: Realtime's socket, the browser key it needs and the player's own topic. */
export interface PokeOn {
  /** `wss://<project>.supabase.co/realtime/v1/websocket` (`ws://` locally). */
  readonly url: string;
  /** The browser's own publishable key (`SUPABASE_BROWSER_KEY`), revocable alone. */
  readonly key: string;
  /** `p:` and 32 hex characters. */
  readonly topic: string;
}

export type PokeResponse = PokeOff | PokeOn;

const TOPIC = /^p:[0-9a-f]{32}$/;
const SOCKET = /^wss?:\/\/[^/\s]+\/realtime\/v1\/websocket$/;

/** The answer of GET /me/poke, if it is one; anything else reads as off. */
export function decodePoke(body: unknown): PokeResponse {
  if (typeof body !== 'object' || body === null) return { off: true };
  const { url, key, topic } = body as Record<string, unknown>;
  if (typeof url !== 'string' || typeof key !== 'string' || typeof topic !== 'string') {
    return { off: true };
  }
  if (!SOCKET.test(url) || !TOPIC.test(topic) || key === '') return { off: true };
  return { url, key, topic };
}

/** Realtime's socket for a Supabase project URL: `https://x` → `wss://x/realtime/v1/websocket`. */
export function socketUrlOf(supabaseUrl: string): string {
  const base = supabaseUrl.replace(/\/+$/, '');
  return `${base.replace(/^http/, 'ws')}/realtime/v1/websocket`;
}
