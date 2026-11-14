// Commitments (ADR 0051 option B): the server commits to every seed before any pick, and a player
// checks each revealed seed afterwards. The vectors were made with Node's `crypto.createHash`, a
// different implementation from the WebCrypto one under test, so both sides agree on the bytes.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { commitmentOf, isCommitted } from './fairness.ts';

const ZERO_SALT = '00'.repeat(16);
const COUNTING_SALT = '000102030405060708090a0b0c0d0e0f';
const VECTORS = [
  {
    seed: 0,
    salt: ZERO_SALT,
    commitment: 'de47c9b27eb8d300dbb5f2c353e632c393262cf06340c4fa7f1b40c4cbd36f90',
  },
  {
    seed: 0xdead_beef,
    salt: COUNTING_SALT,
    commitment: '14e5222257218e90fe929a45f2697c0d37735ffd48fd7e502e5aa152908bc67e',
  },
  {
    seed: 0xffff_ffff,
    salt: 'ff'.repeat(16),
    commitment: '9a8dcd3f9ff7aa3114e141f03c12989d363ea81fd74c02eea63c5f41489cb17a',
  },
];

/** SHA-256 of the seed's 4 bytes, big-endian, then the salt's 16, with Node's crypto. */
function nodeCommitment(seed: number, salt: string): string {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(seed);
  return createHash('sha256')
    .update(Buffer.concat([bytes, Buffer.from(salt, 'hex')]))
    .digest('hex');
}

describe('commitments', () => {
  it('match the published vectors and Node crypto', async () => {
    for (const { seed, salt, commitment } of VECTORS) {
      expect(nodeCommitment(seed, salt)).toBe(commitment);
      expect(await commitmentOf(seed, salt)).toBe(commitment);
      expect(await isCommitted({ seed, salt, commitment })).toBe(true);
    }
  });

  it('refuse a revealed seed or salt that is not the one committed to', async () => {
    const { seed, salt, commitment } = VECTORS[1] ?? { seed: 0, salt: '', commitment: '' };
    expect(await isCommitted({ seed: seed + 1, salt, commitment })).toBe(false);
    expect(await isCommitted({ seed, salt: ZERO_SALT, commitment })).toBe(false);
    expect(await isCommitted({ seed, salt, commitment: VECTORS[0]?.commitment })).toBe(false);
  });

  // A seed is only 32 bits: without a salt of its own it could be found from its commitment.
  it('read only a 32-bit seed, a 16-byte hex salt and a SHA-256 hex commitment, never throwing', async () => {
    const good = VECTORS[1] ?? { seed: 0, salt: '', commitment: '' };
    const bad: unknown[] = [
      null,
      'seed',
      {},
      { ...good, seed: -1 },
      { ...good, seed: 0x1_0000_0000 },
      { ...good, seed: 1.5 },
      { ...good, seed: '3735928559' },
      { ...good, salt: '' },
      { ...good, salt: good.salt.slice(2) },
      { ...good, salt: `${good.salt}00` },
      { ...good, salt: `zz${good.salt.slice(2)}` },
      { ...good, commitment: good.commitment.slice(1) },
      { ...good, commitment: good.commitment.toUpperCase() },
    ];
    for (const revealed of bad) expect(await isCommitted(revealed)).toBe(false);
    await expect(commitmentOf(1, 'abc')).rejects.toThrow('salt');
    await expect(commitmentOf(-1, ZERO_SALT)).rejects.toThrow('seed');
  });
});
