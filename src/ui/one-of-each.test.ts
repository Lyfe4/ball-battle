// One component for each part a screen state shares (ADR 0038): a second "How it was won", pick
// row, pick banner, series bar, pairing or ready card built anywhere else would let the same state
// look different by mode, format or round, as two versions once seemed to. Each class name and
// each label is written by its one module alone (tests, test flows and the style guide aside).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return ['styleguide', 'flows'].includes(entry.name) ? [] : sources(path);
    return entry.name.endsWith('.ts') && !entry.name.includes('.test.') ? [path] : [];
  });
}

const files = sources(SRC).map((path) => ({
  path: relative(SRC, path).split(sep).join('/'),
  text: readFileSync(path, 'utf8'),
}));

/** What only one module may write, as it appears in a string literal there. */
const OWNERS: readonly (readonly [string, string])[] = [
  ["'How it was won'", 'ui/match-story.ts'],
  ["'match-story'", 'ui/match-story.ts'],
  ["'pick-rows'", 'ui/series/pick-rows.ts'],
  ["'pick-row'", 'ui/series/pick-rows.ts'],
  ["'series-banner'", 'ui/series/pick-banner.ts'],
  ["'series-bar'", 'ui/series/series-bar.ts'],
  ["'pairing'", 'ui/balls/pairing.ts'],
  ["'ready-card'", 'ui/ready-card.ts'],
  ["'settings-panel'", 'ui/settings-menu.ts'],
  ["'settings-toggle'", 'ui/settings-menu.ts'],
  ["'series-bar-score'", 'ui/series/series-bar.ts'],
];

describe('one component per shared part', () => {
  it.each(OWNERS)('%s is written only by %s', (literal, owner) => {
    const writers = files.filter((file) => file.text.includes(literal)).map((file) => file.path);
    expect(writers).toStrictEqual([owner]);
  });
});
