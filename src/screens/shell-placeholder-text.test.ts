import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_VIEWS, PLACEHOLDERS } from './shell-placeholder-text.ts';

describe('the shell’s placeholders (ADR 0081)', () => {
  it('give each screen its title and one way on, so none is a dead end', () => {
    expect(
      PLACEHOLDER_VIEWS.map((view) => [PLACEHOLDERS[view].title, PLACEHOLDERS[view].to]),
    ).toStrictEqual([['Ranks', 'home']]);
    for (const view of PLACEHOLDER_VIEWS) {
      expect(PLACEHOLDERS[view].body.length).toBeGreaterThan(0);
      expect(PLACEHOLDERS[view].button.length).toBeGreaterThan(0);
    }
  });
});
