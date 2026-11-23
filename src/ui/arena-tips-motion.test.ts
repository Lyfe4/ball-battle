// With reduced motion the arena tip only fades (ADR 0036 addendum of 2026-11-23): every animation
// the tip's stylesheet runs under `prefers-reduced-motion: reduce` changes opacity and nothing else,
// and every movement it has otherwise sits under `no-preference`. (The tag's glide between corners
// is switched off in code: tip-place.test.ts.)
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./arena-tips.css', import.meta.url), 'utf8');

/** The body of the block that opens with `opener`, braces balanced. */
function blockAfter(opener: string): string {
  const start = css.indexOf(opener);
  if (start === -1) throw new Error(`no ${opener}`);
  let depth = 0;
  for (let index = css.indexOf('{', start); index < css.length; index++) {
    if (css[index] === '{') depth++;
    if (css[index] === '}' && --depth === 0) return css.slice(start, index + 1);
  }
  throw new Error(`unclosed ${opener}`);
}

/** The properties the keyframes `name` animates. */
function animated(name: string): string[] {
  const body = blockAfter(`@keyframes ${name} `);
  return [...body.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1] ?? '');
}

const animationsIn = (block: string) =>
  [...block.matchAll(/animation:\s*([a-z-]+)/g)].map((match) => match[1] ?? '');

describe('the arena tip with reduced motion', () => {
  it('only fades', () => {
    const reduced = animationsIn(blockAfter('@media (prefers-reduced-motion: reduce)'));
    expect(reduced.length).toBeGreaterThan(0);
    for (const name of reduced) expect(animated(name), name).toStrictEqual(['opacity']);
  });

  it('keeps every movement for players who have not asked for less', () => {
    const outside = css.replace(blockAfter('@media (prefers-reduced-motion: no-preference)'), '');
    const moving = animationsIn(outside).filter((name) =>
      animated(name).some((property) => property !== 'opacity'),
    );
    expect(moving).toStrictEqual([]);
  });
});
