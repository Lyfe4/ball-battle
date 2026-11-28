import { describe, expect, it } from 'vitest';
import { BUDGET, budgetProblems, firstScriptOf } from './bundle-budget.ts';

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

  it('holds the first script, the one index.html loads, to a budget of its own', () => {
    const page = {
      name: 'index.html',
      text: '<script type="module" crossorigin src="/assets/main-Ab1.js"></script>',
    };
    const chunk = { name: 'assets/online-mount-Cd2.js', text: noise(5_000) };
    // Windows' separator, as check-bundle.ts names the files there.
    const small = { name: 'assets\\main-Ab1.js', text: noise(BUDGET.firstScript * 0.5) };
    expect(firstScriptOf([page, chunk, small])).toBe(small);
    expect(budgetProblems([page, chunk, small])).toStrictEqual([]);
    const big = { name: 'assets/main-Ab1.js', text: noise(BUDGET.firstScript * 1.4) };
    const over = budgetProblems([page, chunk, big]);
    expect(over).toHaveLength(1);
    expect(over[0]).toMatch(/^the first script is .* over its 140\.0 kB budget$/);
  });
});
