// The server's secret seeds (ADR 0051 option B, ADR 0052 "Seeds"). Every seed of a server series
// is HMAC-SHA256 under the secret key K of (series id, purpose, index), cut to its first 32 bits
// (big-endian). HMAC is deterministic, so any host holding K derives the same seed and a retried
// request gets the same answer; its outputs are independent, so revealing one seed gives nothing
// about another; and without K no one can compute a seed before it is revealed. Only salts are
// stored (`newSalt`); seeds are re-derived from K. WebCrypto, so it runs in Node and on any
// web-standard runtime alike. No I/O here: reading K from the environment comes with the server.
import { hexOf, SALT_BYTES } from '../api/fairness.ts';
import type { BestOf, Format, SeriesSeeds } from '../sim/index.ts';

/** K, imported (`importSeedKey`). Named from WebCrypto itself, so no runtime's own types leak in. */
export type SeedKey = Awaited<ReturnType<typeof crypto.subtle.importKey>>;

/** What a seed is for: a round's seed (index 0-4), the Reveal toss, the bot's lineup or choices. */
export type SeedPurpose = 'round' | 'toss' | 'lineup' | 'bot';

/** Versions the message, so a later scheme can never produce the same input. */
const DOMAIN = 'ballbattle/seed/v1';
/** A series id as Postgres prints a uuid: lowercase, so one series has one message. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** HMAC-SHA256's own block of strength: a shorter key is weaker than the hash. */
export const MIN_KEY_BYTES = 32;
/** The most rounds a series takes (Best of 5, ADR 0048). */
const MOST_ROUNDS = 5;

/** K as a WebCrypto key that can only sign (never be read back). */
export async function importSeedKey(raw: Uint8Array<ArrayBuffer>): Promise<SeedKey> {
  if (raw.length < MIN_KEY_BYTES) {
    throw new Error(`A seed key needs at least ${String(MIN_KEY_BYTES)} bytes`);
  }
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

/**
 * The seed for `purpose` in series `seriesId`: HMAC-SHA256(K, "ballbattle/seed/v1" NUL id NUL
 * purpose NUL index), first four bytes big-endian. `index` is the round (0-based) for a round
 * seed, else 0. Throws on an id that is not a lowercase UUID or an index out of range, so no two
 * inputs share a message.
 */
export async function seedFor(
  key: SeedKey,
  seriesId: string,
  purpose: SeedPurpose,
  index: number,
): Promise<number> {
  if (!UUID.test(seriesId)) throw new Error('A series id is a lowercase UUID');
  const most = purpose === 'round' ? MOST_ROUNDS - 1 : 0;
  if (!Number.isInteger(index) || index < 0 || index > most) {
    throw new Error(`A ${purpose} seed has no index ${String(index)}`);
  }
  const message = new TextEncoder().encode([DOMAIN, seriesId, purpose, String(index)].join('\0'));
  const mac = await crypto.subtle.sign('HMAC', key, message);
  return new DataView(mac).getUint32(0);
}

/** The shape of a series, as far as its seeds go. */
export interface SeedPlan {
  readonly bestOf: BestOf;
  readonly format: Format;
  /** True for a bot opponent. */
  readonly bot: boolean;
}

/**
 * Exactly the seeds a series uses, as `decodeSeriesSetup` requires them: one per round, the toss
 * for Reveal, the bot's choice seed for a bot that chooses (any format but Blind), and the bot's
 * lineup seed (`Opponent.lineupSeed`) for any bot.
 */
export async function seriesSeeds(
  key: SeedKey,
  seriesId: string,
  plan: SeedPlan,
): Promise<{ readonly seeds: SeriesSeeds; readonly lineupSeed?: number }> {
  const seed = (purpose: SeedPurpose, index = 0) => seedFor(key, seriesId, purpose, index);
  const rounds = await Promise.all(Array.from({ length: plan.bestOf }, (_, r) => seed('round', r)));
  const chooses = plan.bot && plan.format !== 'blind';
  return {
    seeds: {
      rounds,
      ...(plan.format === 'reveal' ? { toss: await seed('toss') } : {}),
      ...(chooses ? { bot: await seed('bot') } : {}),
    },
    ...(plan.bot ? { lineupSeed: await seed('lineup') } : {}),
  };
}

/** A fresh random salt for one seed's commitment, as hex (`commitmentOf`). */
export const newSalt = (): string => hexOf(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
