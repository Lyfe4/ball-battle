import { afterEach, describe, expect, it } from 'vitest';
import { eventOf, scrubbed, framesOf, report, startMonitor, targetOf } from './monitor.ts';

afterEach(() => {
  startMonitor(undefined);
});

describe('error reports', () => {
  it('go to the envelope endpoint the DSN names', () => {
    expect(targetOf('https://abc123@o1.ingest.sentry.io/456')).toStrictEqual({
      url: 'https://o1.ingest.sentry.io/api/456/envelope/',
      key: 'abc123',
      dsn: 'https://abc123@o1.ingest.sentry.io/456',
    });
    expect(targetOf('not a dsn')).toBeUndefined();
    expect(targetOf('http://abc@insecure.example/1')).toBeUndefined();
  });

  it('carry the error and the tags only', () => {
    const error = new Error('boom');
    const event = eventOf(error, { route: 'series.pick', requestId: 'r1' }, 'e1', 1);
    expect(Object.keys(event).sort()).toStrictEqual(
      ['event_id', 'exception', 'level', 'platform', 'tags', 'timestamp'].sort(),
    );
    expect(JSON.stringify(event)).toMatch(/"value":"boom"/);
  });

  it('carry no email address, database value or long quote a player sent (2026-11-28 audit)', () => {
    expect(scrubbed('No user for sam@example.co.uk here')).toBe('No user for <email> here');
    expect(scrubbed('Key (lower(username))=(robin_b) already exists')).toBe(
      'Key (lower(username))=(…) already exists',
    );
    expect(scrubbed('x'.repeat(500))).toHaveLength(300);
    const event = eventOf(new Error('Unexpected token in jo@x.io'), {}, 'e1', 1);
    expect(JSON.stringify(event)).not.toContain('jo@x.io');
  });

  it('read a V8 stack oldest frame first', () => {
    const frames = framesOf('Error: x\n    at inner (/a.js:1:2)\n    at /b.js:3:4\n    nonsense');
    expect(frames).toStrictEqual([
      { filename: '/b.js', lineno: 3, colno: 4 },
      { function: 'inner', filename: '/a.js', lineno: 1, colno: 2 },
    ]);
  });

  it('send nothing without a DSN, and never throw when sending fails', async () => {
    const sent: string[] = [];
    const send: typeof fetch = (url) => {
      sent.push(url instanceof Request ? url.url : url.toString());
      return Promise.reject(new Error('offline'));
    };
    await report(new Error('x'), { route: 'r', requestId: 'q' }, send);
    expect(sent).toStrictEqual([]);
    startMonitor('https://abc@o1.ingest.sentry.io/9');
    await expect(
      report(new Error('x'), { route: 'r', requestId: 'q' }, send),
    ).resolves.toBeUndefined();
    expect(sent).toStrictEqual(['https://o1.ingest.sentry.io/api/9/envelope/']);
  });
});
