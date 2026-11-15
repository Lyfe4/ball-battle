// One look for the chosen option (choice.css, ADR 0054): no other stylesheet draws a chosen state,
// so a toggle can't drift back to a shade of its own, and every control that says it is chosen
// (aria-pressed) wears the shared `.choice` look. Settings' switches are switches (role=switch):
// a thumb that moves across a track that lights up, their own on and off.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function files(dir: string, ending: string): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return ['styleguide', 'flows'].includes(entry.name) ? [] : files(path, ending);
    if (!entry.name.endsWith(ending) || entry.name.includes('.test.')) return [];
    return [{ path: relative(SRC, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }];
  });
}

const CHOSEN = /\[aria-(pressed|checked)=['"]true['"]\]/;

describe('the chosen option has one look', () => {
  it('is drawn by choice.css alone (and the settings switch)', () => {
    const drawers = files(SRC, '.css')
      .filter((file) =>
        file.text
          .split('\n')
          .some((line) => CHOSEN.test(line) && !line.includes('.settings-switch')),
      )
      .map((file) => file.path);
    expect(drawers).toStrictEqual(['ui/choice.css']);
  });

  it('is worn by every control that says it is chosen', () => {
    const pressing = files(SRC, '.ts').filter((file) => file.text.includes("'aria-pressed'"));
    expect(pressing.length).toBeGreaterThan(0);
    const without = pressing
      .filter((file) => !/element\('button', '[^']*\bchoice\b/.test(file.text))
      .map((file) => file.path);
    expect(without).toStrictEqual([]);
  });
});
