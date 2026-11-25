// Three layouts, each named by one media query used verbatim (ADR 0031, 0067): the phone column
// (the default, no query, or `not all and` the beside query where a rule is for phones only), the
// beside layout (any landscape screen, a phone turned sideways included: the court beside the
// panel) and the desktop layout (at least 1024 px wide and landscape, refining beside). A query of
// any other shape would be a fourth layout no browser project checks; this fails on one.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BESIDE_LAYOUT, DESKTOP_LAYOUT } from '../app/layout-query.ts';

const SRC = fileURLToPath(new URL('..', import.meta.url));

const BESIDE = '(min-aspect-ratio: 5/4)';
const DESKTOP = '(min-width: 64rem) and (min-aspect-ratio: 5/4)';

const ALLOWED = new Set([
  DESKTOP,
  BESIDE,
  `not all and ${BESIDE}`,
  `${BESIDE} and (prefers-reduced-motion: no-preference)`,
  // Not layouts: how the player points and whether things move.
  '(hover: hover)',
  // Classic scrollbars reserve their gutter beside and on a desktop with a mouse (base.css).
  `${BESIDE} and (pointer: fine)`,
  '(prefers-reduced-motion: reduce)',
  '(prefers-reduced-motion: no-preference)',
]);

function stylesheets(dir: string): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return stylesheets(path);
    if (!entry.name.endsWith('.css')) return [];
    return [{ path: relative(SRC, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }];
  });
}

describe('layout media queries', () => {
  const queries = stylesheets(SRC).flatMap((file) =>
    [...file.text.matchAll(/@media\s+([^{]+?)\s*\{/g)].map((match) => ({
      file: file.path,
      query: (match[1] ?? '').replace(/\s+/g, ' '),
    })),
  );

  it('match the script copy of the beside query', () => {
    expect(BESIDE_LAYOUT).toBe(BESIDE);
    expect(DESKTOP_LAYOUT).toBe(DESKTOP);
  });

  it('are found', () => {
    expect(queries.length).toBeGreaterThan(20);
  });

  it('are only the phone, beside and desktop queries, verbatim', () => {
    expect(queries.filter(({ query }) => !ALLOWED.has(query))).toStrictEqual([]);
  });
});
