import { describe, expect, it } from 'vitest';
import type { FailureKind } from '../app/api.ts';
import { failureLine, failureText } from './online-failure-text.ts';

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

  it('show a refusal’s own reason', () => {
    expect(said('refused')).toContain('Finish one of your open series first');
    expect(failureLine('refused', 'Slow down')).toBe('Slow down');
  });
});
