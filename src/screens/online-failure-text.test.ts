import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FailureKind } from '../app/api.ts';
import { CHALLENGE_REFUSALS, failureLine, failureText } from './online-failure-text.ts';

const FAILURES: readonly FailureKind[] = ['offline', 'timeout', 'error', 'refused'];
const said = (kind: FailureKind) => {
  const { title, body } = failureText(kind, 'Finish one of your open series first');
  return `${title} ${body}`;
};

describe('online failures', () => {
  it('say "offline" only when the device is offline', () => {
    for (const kind of FAILURES) {
      expect(said(kind).includes('offline'), kind).toBe(kind === 'offline');
      expect(failureLine(kind).includes('offline'), kind).toBe(kind === 'offline');
    }
  });

  it('each say something of their own', () => {
    expect(new Set(FAILURES.map((kind) => failureText(kind).title)).size).toBe(FAILURES.length);
  });

  it('say every refusal the challenge flow can get in the game’s words (ADR 0086)', () => {
    const services = ['challenges.ts', 'friend-challenge.ts', 'start.ts'].map((file) =>
      readFileSync(new URL(`../server/${file}`, import.meta.url), 'utf8'),
    );
    const codes = new Set(
      services.flatMap((text) =>
        [...text.matchAll(/new ApiError\(4\d\d, '([a-z_]+)'/g)].map((match) => match[1] ?? ''),
      ),
    );
    expect(codes.size).toBeGreaterThan(5);
    expect([...codes].filter((code) => !(code in CHALLENGE_REFUSALS))).toStrictEqual([]);
    expect(
      failureText('refused', 'You are in a match already: finish it first', 'in_a_match'),
    ).toStrictEqual({ title: 'You’re in a match already', body: 'One live match at a time.' });
  });

  it('show a refusal’s own reason', () => {
    expect(said('refused')).toContain('Finish one of your open series first');
    expect(failureLine('refused', 'Slow down')).toBe('Slow down');
  });
});
