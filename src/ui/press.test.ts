// Every control gives the same sign to a finger as to a mouse (press.ts, playtest 2026-11-19): a
// control (anything a stylesheet gives a pointer or a help cursor) has a hover look, only where a
// pointer can hover (a touch hover sticks after the tap on iOS), and a pressed look that is exactly
// its hover look. A new control without one fails here.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

interface Rule {
  readonly file: string;
  readonly media: string;
  readonly selectors: readonly string[];
  readonly body: string;
}

/** The game's stylesheets (not the dev pages, nor the legal pages, which run no script). */
function sheets(dir: string): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return ['styleguide', 'flows', 'legal', 'sound', 'brand'].includes(entry.name)
        ? []
        : sheets(path);
    }
    if (!entry.name.endsWith('.css')) return [];
    return [{ path: relative(SRC, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }];
  });
}

/** Every style rule with the `@media` it sits in ('' for none). Enough of CSS for these files. */
function rulesOf(file: string, text: string): Rule[] {
  const source = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let at = 0; at < source.length; at += 1) {
    const char = source[at];
    if (char === '{') {
      stack.push(source.slice(start, at).trim());
      start = at + 1;
    } else if (char === '}') {
      const head = stack.pop() ?? '';
      if (!head.startsWith('@') && !stack.some((one) => one.startsWith('@keyframes'))) {
        rules.push({
          file,
          media: stack.filter((one) => one.startsWith('@media')).join(' '),
          selectors: head.split(',').map((one) => one.replace(/\s+/g, ' ').trim()),
          body: source.slice(start, at).replace(/\s+/g, ' ').trim(),
        });
      }
      start = at + 1;
    } else if (char === ';' && stack.length === 0) start = at + 1;
  }
  return rules;
}

/** The volume slider: a finger drags its thumb, which moves under it (its own feedback). */
const OWN_FEEDBACK = ['.settings-volume'];

const RULES = sheets(SRC).flatMap((sheet) => rulesOf(sheet.path, sheet.text));
const declarations = (body: string) =>
  body
    .split(';')
    .map((one) => one.trim())
    .filter((one) => one !== '')
    .sort();

describe('a tap shows on every control', () => {
  it('hovers only where a pointer can hover', () => {
    const sticky = RULES.filter(
      (rule) =>
        rule.selectors.some((one) => one.includes(':hover')) &&
        !rule.media.includes('(hover: hover)'),
    ).map((rule) => `${rule.file}: ${rule.selectors.join(', ')}`);
    expect(sticky).toStrictEqual([]);
  });

  it('looks pressed under a finger exactly as it looks pointed at', () => {
    const hovers = RULES.flatMap((rule) =>
      rule.selectors
        .filter((one) => one.includes(':hover'))
        .map((selector) => ({ rule, selector })),
    );
    expect(hovers.length).toBeGreaterThan(10);
    const missing = hovers
      .filter(({ rule, selector }) => {
        const pressed = selector.replace(':hover', '[data-pressed]');
        return !RULES.some(
          (other) =>
            other.file === rule.file &&
            other.selectors.includes(pressed) &&
            JSON.stringify(declarations(other.body)) === JSON.stringify(declarations(rule.body)),
        );
      })
      .map(({ rule, selector }) => `${rule.file}: ${selector}`);
    expect(missing).toStrictEqual([]);
  });

  it('gives every control a hover look', () => {
    const controls = RULES.filter((rule) => /cursor: (pointer|help)/.test(rule.body))
      .flatMap((rule) => rule.selectors.map((selector) => ({ file: rule.file, selector })))
      .filter(({ selector }) => !OWN_FEEDBACK.includes(selector));
    expect(controls.length).toBeGreaterThan(15);
    const hovered = RULES.flatMap((rule) => rule.selectors).filter((one) => one.includes(':hover'));
    const bare = controls
      .filter(({ selector }) => {
        const name = /\.[\w-]+/.exec(selector)?.[0];
        return name === undefined || !hovered.some((one) => new RegExp(`\\${name}\\b`).test(one));
      })
      .map(({ file, selector }) => `${file}: ${selector}`);
    expect(bare).toStrictEqual([]);
  });
});
