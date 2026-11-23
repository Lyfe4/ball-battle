import { describe, expect, it } from 'vitest';
import { SHELL_VIEWS } from '../app/route.ts';
import { PLACEHOLDERS } from './shell-placeholder-text.ts';

describe('the shell’s placeholders (ADR 0081)', () => {
  it('give each screen its title and one way on, so none is a dead end', () => {
    expect(
      SHELL_VIEWS.map((view) => [PLACEHOLDERS[view].title, PLACEHOLDERS[view].to]),
    ).toStrictEqual([
      ['Friends', 'send'],
      ['Profile', 'signin'],
      ['Ranks', 'home'],
    ]);
    for (const view of SHELL_VIEWS) {
      expect(PLACEHOLDERS[view].body.length).toBeGreaterThan(0);
      expect(PLACEHOLDERS[view].button.length).toBeGreaterThan(0);
    }
  });
});
