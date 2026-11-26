import { describe, expect, it } from 'vitest';
import { BUDGET, budgetProblems } from './bundle-budget.ts';

/** Text that gzips to about `bytes`: random letters barely compress. */
function noise(bytes: number): string {
  let seed = 7;
  let text = '';
  while (text.length < bytes) {
    seed = (seed * 16807) % 2147483647;
    text += String.fromCharCode(33 + (seed % 90));
  }
  return text;
}

describe('the bundle budget', () => {
  it('passes a build inside it and names each kind over it, by how much', () => {
    expect(budgetProblems([{ name: 'assets/main.js', text: noise(10_000) }])).toStrictEqual([]);
    const over = budgetProblems([
      { name: 'assets/main.js', text: noise(BUDGET.scripts * 1.5) },
      { name: 'assets/main.css', text: noise(BUDGET.styles * 1.5) },
      { name: 'index.html', text: noise(BUDGET.scripts * 2) },
    ]);
    expect(over).toHaveLength(2);
    expect(over[0]).toMatch(/^scripts are \d+\.\d kB gzipped, over the 180\.0 kB budget$/);
    expect(over[1]).toMatch(/^stylesheets are .* over the 28\.0 kB budget$/);
  });
});
