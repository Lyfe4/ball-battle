import { describe, expect, it } from 'vitest';
import { argsOf, reportLines, reportsQuery } from './reports.ts';

describe('the reported names script (ADR 0079, 2026-11-25)', () => {
  it('takes a target and up to 90 days, 30 by default', () => {
    expect(argsOf(['staging'])).toStrictEqual({ target: 'staging', days: 30 });
    expect(argsOf(['production', '--days', '7'])).toStrictEqual({ target: 'production', days: 7 });
    expect(argsOf([])).toBe('Say local, staging or production');
    expect(argsOf(['staging', '--days', '91'])).toBe('--days takes 1 to 90');
    expect(argsOf(['staging', '--days', 'x'])).toBe('--days takes 1 to 90');
  });

  it('only reads, and only a whole number of days goes into the query', () => {
    const query = reportsQuery(7);
    expect(query).toContain("interval '7 days'");
    expect(query).not.toMatch(/\b(insert|update|delete)\b/i);
    expect(() => reportsQuery(1.5)).toThrow();
  });

  it('counts reporters without naming them, and names the reported id to act on', () => {
    expect(reportLines([], 30)).toStrictEqual(['No names reported in the last 30 days.']);
    const lines = reportLines(
      [
        {
          id: 'u-1',
          now: 'Rude_Name',
          reporters: 2,
          names: 'Rude_Name',
          reasons: 'offensive, other',
          latest: '2026-11-25 09:10:11.123+00',
        },
      ],
      30,
    );
    expect(lines).toStrictEqual([
      '1 reported in the last 30 days, most reported first:',
      '- Rude_Name (offensive, other) by 2 players; now "Rude_Name", last 2026-11-25 09:10, id u-1',
    ]);
  });
});
