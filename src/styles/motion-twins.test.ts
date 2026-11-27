// The game's own Reduce motion (src/app/motion.ts, ADR 0087 addendum of 2026-11-28) works only if
// every stylesheet honours `data-motion="reduce"` on the root as it honours the device's setting:
// a `prefers-reduced-motion: no-preference` block moves only where the root has not asked for less,
// and a `prefers-reduced-motion: reduce` block has a twin under `:root[data-motion='reduce']`.
// A new rule without its twin would move for a player who switched motion off.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const GUARD = ":where(:root:not([data-motion='reduce']))";
const TWIN = ":root[data-motion='reduce']";
const TWIN_WRAPPED = ":root:where([data-motion='reduce'])";

function sheets(dir: string): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return ['styleguide', 'flows', 'brand'].includes(entry.name) ? [] : sheets(path);
    }
    if (!entry.name.endsWith('.css')) return [];
    return [{ path: relative(SRC, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }];
  });
}

/** The body of each `@media` block whose query mentions `query`, comments removed. */
function blocks(text: string, query: string): string[] {
  const plain = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const found: string[] = [];
  let from = 0;
  for (;;) {
    const at = plain.indexOf('@media', from);
    if (at < 0) return found;
    const open = plain.indexOf('{', at);
    let depth = 1;
    let end = open + 1;
    while (depth > 0 && end < plain.length) {
      if (plain[end] === '{') depth += 1;
      else if (plain[end] === '}') depth -= 1;
      end += 1;
    }
    if (plain.slice(at, open).includes(query)) found.push(plain.slice(open + 1, end - 1));
    from = end;
  }
}

/** The selectors of a block's top-level rules (keyframes and nested at-rules skipped). */
function selectors(body: string): string[] {
  const found: string[] = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < body.length; at += 1) {
    if (body[at] === '{') {
      if (depth === 0) {
        const prelude = body.slice(start, at).trim();
        if (!prelude.startsWith('@')) found.push(...prelude.split(',').map((part) => part.trim()));
      }
      depth += 1;
    } else if (body[at] === '}') {
      depth -= 1;
      if (depth === 0) start = at + 1;
    }
  }
  return found;
}

describe('stylesheets honour the game’s own Reduce motion', () => {
  const all = sheets(SRC);

  it('moves in a no-preference block only where the root has not asked for less', () => {
    const unguarded = all.flatMap(({ path, text }) =>
      blocks(text, 'prefers-reduced-motion: no-preference').flatMap((body) =>
        selectors(body)
          .filter((selector) => !selector.startsWith(GUARD) && !selector.startsWith('::view'))
          .map((selector) => `${path}: ${selector}`),
      ),
    );
    expect(unguarded).toStrictEqual([]);
  });

  it('gives every reduce block a twin under the root’s attribute', () => {
    const missing = all
      .filter(({ text }) => blocks(text, 'prefers-reduced-motion: reduce').length > 0)
      .filter(({ text }) => !text.includes(TWIN) && !text.includes(TWIN_WRAPPED))
      .map(({ path }) => path);
    expect(missing).toStrictEqual([]);
  });

  it('finds the blocks it checks', () => {
    const count = all.reduce(
      (sum, { text }) => sum + blocks(text, 'prefers-reduced-motion').length,
      0,
    );
    expect(count).toBeGreaterThan(20);
  });
});
