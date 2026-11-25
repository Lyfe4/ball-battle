// Focus rings for the keyboard only (ADR 0086, input-modality.ts): every rule that draws a focus
// ring (the --focus-ring halo, an outline, or the focus colour) on `:focus-visible` is guarded by
// the input flag, `:where(:root:not([data-input='pointer']))`, so a page last used by a press
// shows none, even where WebKit calls a script's focus visible after a tap. A new ring rule
// without the guard fails here. Text fields keep their ring whatever the input: a field focused by
// a tap is where the typing goes (the browser's own rule for fields). The legal pages run no
// script, so they have no flag and keep the plain rule.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const GUARD = ":where(:root:not([data-input='pointer']))";

/** Rings that show for any input: fields that take typing. */
const FIELD_RINGS = new Set(['.notice-field-input:focus-visible']);

/** The game's stylesheets (not the dev pages, nor the legal pages, which run no script). */
function sheets(dir: string): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return ['styleguide', 'flows', 'legal', 'brand'].includes(entry.name) ? [] : sheets(path);
    }
    if (!entry.name.endsWith('.css')) return [];
    return [{ path: relative(SRC, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }];
  });
}

/** A selector list's selectors: its commas outside `:where()`, `:not()` and the like. */
function splitSelectors(head: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < head.length; at += 1) {
    if (head[at] === '(') depth += 1;
    else if (head[at] === ')') depth -= 1;
    else if (head[at] === ',' && depth === 0) {
      parts.push(head.slice(start, at));
      start = at + 1;
    }
  }
  return [...parts, head.slice(start)];
}

/** Each `:focus-visible` selector of a rule whose body draws a ring, as `file: selector`. */
function ringSelectorsOf(file: string, text: string): string[] {
  const source = text.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap((match) => {
    const body = match[2] ?? '';
    const draws =
      body.includes('var(--focus-ring)') ||
      /(?<![\w-])outline\s*:(?!\s*none)/.test(body) ||
      /(?<![\w-])color\s*:\s*var\(--color-focus\)/.test(body);
    if (!draws) return [];
    return splitSelectors(match[1] ?? '')
      .map((one) => one.replace(/\s+/g, ' ').trim())
      .filter((one) => one.includes(':focus-visible'))
      .map((selector) => `${file}: ${selector}`);
  });
}

const SHEETS = sheets(SRC);
const RINGS = SHEETS.flatMap((sheet) => ringSelectorsOf(sheet.path, sheet.text));

describe('focus rings', () => {
  it('reads a ring rule, guarded or not, and nothing else', () => {
    expect(
      ringSelectorsOf(
        'x.css',
        `${GUARD} .a:focus-visible, .b:focus-visible { box-shadow: var(--focus-ring); }
         .c:focus-visible { outline: none; } .d:focus-visible { outline: 2px solid; }
         .e:focus-visible { color: var(--color-focus); } .f:hover { box-shadow: var(--focus-ring); }`,
      ),
    ).toStrictEqual([
      `x.css: ${GUARD} .a:focus-visible`,
      'x.css: .b:focus-visible',
      'x.css: .d:focus-visible',
      'x.css: .e:focus-visible',
    ]);
  });

  it('show for the keyboard only', () => {
    expect(RINGS.length).toBeGreaterThan(15);
    const bare = RINGS.filter((ring) => {
      const selector = ring.slice(ring.indexOf(': ') + 2);
      return !selector.startsWith(`${GUARD} `) && !FIELD_RINGS.has(selector);
    });
    expect(bare).toStrictEqual([]);
  });

  it('need no one-off quiet mark any more', () => {
    const quiet = SHEETS.filter((sheet) => sheet.text.includes('quiet-focus')).map(
      (sheet) => sheet.path,
    );
    expect(quiet).toStrictEqual([]);
  });
});
