import { describe, expect, it } from 'vitest';
import { logLine } from './log.ts';

describe('the request log line', () => {
  it('holds only the fixed fields, whatever else the entry carries', () => {
    const entry = {
      requestId: 'r1',
      route: 'series.pick',
      method: 'POST',
      status: 200,
      durationMs: 12.6,
      userId: 'u1',
      cookie: '__Host-bb_session=secret',
      authorization: 'Bearer secret',
    };
    const line = JSON.parse(logLine(entry)) as Record<string, unknown>;
    expect(line).toStrictEqual({
      level: 'info',
      requestId: 'r1',
      route: 'series.pick',
      method: 'POST',
      status: 200,
      durationMs: 13,
      userId: 'u1',
    });
  });

  it('marks server errors as errors and names the code', () => {
    const line = JSON.parse(
      logLine({
        requestId: 'r',
        route: 'h',
        method: 'GET',
        status: 500,
        durationMs: 1,
        error: 'internal',
      }),
    ) as Record<string, unknown>;
    expect(line['level']).toBe('error');
    expect(line['error']).toBe('internal');
    expect(line).not.toHaveProperty('userId');
  });
});
