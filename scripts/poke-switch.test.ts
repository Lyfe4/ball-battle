// The poke's instant switch (ADR 0082): what it accepts, the one statement it runs, and what it
// says. Production is never switched on by accident.
import { describe, expect, it } from 'vitest';
import { commandOf, statementOf, verdictOf } from './poke-switch.ts';

describe('the poke switch', () => {
  it('reads status, on and off for a named database', () => {
    expect(commandOf(['status', 'staging'])).toStrictEqual({ action: 'status', target: 'staging' });
    expect(commandOf(['on', 'local'])).toStrictEqual({ action: 'on', target: 'local' });
    expect(commandOf(['off', 'production'])).toStrictEqual({
      action: 'off',
      target: 'production',
    });
  });

  it('refuses anything else, and a database left unnamed', () => {
    for (const args of [[], ['flip', 'staging'], ['on'], ['on', 'prod'], ['on', 'staging', 'x']]) {
      expect(typeof commandOf(args)).toBe('string');
    }
  });

  it('switches production on only with --production, and off always', () => {
    expect(commandOf(['on', 'production'])).toMatch(/needs --production/);
    expect(commandOf(['on', 'production', '--production'])).toStrictEqual({
      action: 'on',
      target: 'production',
    });
    expect(commandOf(['off', 'production'])).toStrictEqual({
      action: 'off',
      target: 'production',
    });
  });

  it('runs one fixed statement on the poke row alone', () => {
    expect(statementOf('status')).toBe(
      "select enabled, changed_at from game.flags where name = 'poke'",
    );
    expect(statementOf('on')).toContain('set enabled = true, changed_at = now()');
    expect(statementOf('off')).toContain('set enabled = false, changed_at = now()');
    for (const action of ['on', 'off'] as const) {
      expect(statementOf(action)).toMatch(/where name = 'poke' returning enabled, changed_at$/);
    }
  });

  it('says on, off, or that the migration is missing', () => {
    expect(verdictOf([{ enabled: true, changed_at: '2026-11-24T06:00:00Z' }])).toBe(
      'Pokes are on (since 2026-11-24T06:00:00Z)',
    );
    expect(verdictOf([{ enabled: 'false', changed_at: 'x' }])).toBe('Pokes are off (since x)');
    expect(verdictOf([])).toMatch(/migration 20261124120000_poke\.sql/);
  });
});
