// The legal pages' copy of the game's font faces (legal-font.css): the same files and ranges as
// @fontsource-variable declares, so an upgrade can't leave them apart, with `font-display: fallback`
// so a page that runs no script is drawn once in its font, never swapped a moment after.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface Face {
  readonly file: string;
  readonly range: string;
  readonly display: string;
}

function facesOf(css: string): Face[] {
  return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body = '']) => ({
    file: /files\/([\w-]+\.woff2)/.exec(body)?.[1] ?? '',
    range: (/unicode-range:([^;]*);/.exec(body)?.[1] ?? '').replace(/\s+/g, ''),
    display: /font-display:\s*(\w+)/.exec(body)?.[1] ?? '',
  }));
}

const require = createRequire(import.meta.url);
const theirs = facesOf(
  readFileSync(require.resolve('@fontsource-variable/bricolage-grotesque'), 'utf8'),
);
const ours = facesOf(readFileSync(new URL('./legal-font.css', import.meta.url), 'utf8'));

describe("the legal pages' font", () => {
  it('declares the same files and ranges as the package', () => {
    expect(theirs.length).toBeGreaterThan(0);
    const without = (faces: Face[]) => faces.map(({ file, range }) => ({ file, range }));
    expect(without(ours)).toStrictEqual(without(theirs));
  });

  it('waits briefly for the font rather than swapping it in', () => {
    expect(ours.map((face) => face.display)).toStrictEqual(ours.map(() => 'fallback'));
  });
});
