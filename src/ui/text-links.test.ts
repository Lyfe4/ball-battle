// A text link only navigates (ADR 0086, 0087, the quality bar's controls line): an action is a
// button or a sheet row. Every `text-link` drawn as a <button> (a link with no URL of its own) is
// named here with where it goes; a new one that does something instead fails. Links (<a>) are
// links already.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NAVIGATING } from './text-links-support.ts';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function files(dir: string): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return ['styleguide', 'flows'].includes(entry.name) ? [] : files(path);
    if (!entry.name.endsWith('.ts') || entry.name.includes('.test.')) return [];
    return [{ path: relative(SRC, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }];
  });
}

describe('a text link only navigates', () => {
  it('is a link, or a named button that goes somewhere', () => {
    const found = files(SRC).flatMap((file) =>
      [...file.text.matchAll(/element\('button', 'text-link ([\w-]+)/g)].map(
        (match) => `${file.path} ${match[1] ?? ''}`,
      ),
    );
    const unknown = found.filter((entry) => !((entry.split(' ')[1] ?? '') in NAVIGATING));
    expect(unknown).toStrictEqual([]);
    // Every name here still exists: the list only shrinks.
    for (const name of Object.keys(NAVIGATING)) {
      expect(
        found.some((entry) => entry.endsWith(` ${name}`)),
        name,
      ).toBe(true);
    }
  });
});
