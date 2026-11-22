// The switch's CLI calls must survive cmd.exe on Windows, where the CLI is a .cmd shim: JSON in an
// argument lost its quotes there and left vs Friend switched halfway (2026-11-21).
import { describe, expect, it } from 'vitest';
import { SITE_ID, isPlainArgument, netlify, switchCalls } from './netlify-cli.ts';

describe('the Netlify CLI calls of the vs Friend switch', () => {
  it.each(['on', 'off'] as const)('switching %s passes only plain arguments', (wanted) => {
    for (const call of switchCalls(wanted)) {
      for (const arg of call) expect(isPlainArgument(arg), arg).toBe(true);
    }
  });

  it.each(['on', 'off'] as const)('switching %s sets the variable, then builds', (wanted) => {
    const [setVariable, triggerBuild] = switchCalls(wanted);
    expect(setVariable).toContain('BALLBATTLE_ONLINE');
    expect(setVariable.slice(-2)).toEqual(['--context', 'production']);
    expect(triggerBuild).toEqual(['deploy', '--trigger', '--site', SITE_ID]);
  });

  it('switches accounts by their own variable (ADR 0079)', () => {
    const [setVariable] = switchCalls('on', 'BALLBATTLE_ACCOUNTS');
    expect(setVariable).toEqual(['env:set', 'BALLBATTLE_ACCOUNTS', '1', '--context', 'production']);
  });

  it('calls anything a shell could change not plain', () => {
    for (const arg of [
      JSON.stringify({ site_id: SITE_ID }),
      'a b',
      'a&b',
      'a|b',
      '%PATH%',
      '^',
      '(x)',
      "'x'",
      '',
    ]) {
      expect(isPlainArgument(arg), arg).toBe(false);
    }
  });

  it('refuses to run a call with one, before reaching the CLI', () => {
    expect(() => netlify(['api', 'createSiteBuild', '--data', '{"site_id":"x"}'])).toThrow(
      /Not a plain argument/,
    );
  });
});
