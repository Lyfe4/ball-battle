// Fair seeds, checked by anyone (ADR 0051 option B, ADR 0052 "Seeds"). When a server series
// starts, the server publishes a commitment to every seed it will use: SHA-256 of the seed's four
// bytes (big-endian) followed by a random 16-byte salt of its own. A seed is only 32 bits, so the
// salt is what keeps a commitment from being searched. After its lock the server reveals the seed
// and salt, and the player's browser (WebCrypto, here) checks them against the commitment, so the
// server could not have chosen a seed after seeing the picks. Hex on the wire, lowercase.

/** A seed as revealed: the seed, its salt and the commitment published at the start. */
export interface RevealedSeed {
  readonly seed: number;
  /** 16 bytes as 32 lowercase hex digits. */
  readonly salt: string;
  /** SHA-256 as 64 lowercase hex digits. */
  readonly commitment: string;
}

export const SALT_BYTES = 16;
const HEX = /^[0-9a-f]*$/;

const isSeed = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;

const isHex = (value: unknown, bytes: number): value is string =>
  typeof value === 'string' && value.length === 2 * bytes && HEX.test(value);

/** Bytes as lowercase hex. */
export const hexOf = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

function bytesOf(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return bytes;
}

/** The commitment to `seed` under `salt`. Throws on a seed or salt not of that form. */
export async function commitmentOf(seed: number, salt: string): Promise<string> {
  if (!isSeed(seed)) throw new Error('The seed is not a 32-bit unsigned integer');
  if (!isHex(salt, SALT_BYTES)) throw new Error(`The salt is not ${String(SALT_BYTES)} hex bytes`);
  const message = new Uint8Array(4 + SALT_BYTES);
  new DataView(message.buffer).setUint32(0, seed);
  message.set(bytesOf(salt), 4);
  return hexOf(new Uint8Array(await crypto.subtle.digest('SHA-256', message)));
}

/** True when a revealed seed and salt are the ones committed to. Anything malformed is false. */
export async function isCommitted(revealed: unknown): Promise<boolean> {
  if (typeof revealed !== 'object' || revealed === null) return false;
  const { seed, salt, commitment } = revealed as Partial<Record<keyof RevealedSeed, unknown>>;
  if (!isSeed(seed) || !isHex(salt, SALT_BYTES) || !isHex(commitment, 32)) return false;
  return (await commitmentOf(seed, salt)) === commitment;
}
