// One chevron (ADR 0081, requirement 3): the "›" our links draw is `.text-link::after`, so the Play
// tab's status strip, a text link, wears the same arrow at the same size and baseline. The few
// parts that drew a "›" of their own before the shell are pinned here by name; a new one (the
// strip's, say) fails.
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

/** A "›" inside a string the page shows (a comment's is not drawn). */
const TYPED = /['"`][^'"`\n]*›[^'"`\n]*['"`]/;

describe('one chevron', () => {
  it('is drawn by .text-link::after, and by no stylesheet added since', () => {
    const drawers = files(SRC, '.css').flatMap((file) =>
      file.text.includes('›') ? [file.path] : [],
    );
    expect(drawers.sort()).toStrictEqual([
      // Every link's.
      'ui/button.css',
      // The manual's next ball, "How it was won"'s disclosure and Free play's slots: each a
      // control's own mark, not a link's arrow (2026-11-24).
      'ui/manual/manual.css',
      'ui/match-story.css',
      // A person's row on the Friends tab: it opens their sheet (ADR 0086), the row's own mark.
      'ui/online/friends-section.css',
      'ui/quick-setup.css',
    ]);
    const button = readFileSync(join(SRC, 'ui/button.css'), 'utf8');
    expect(button).toContain('.text-link::after {');
  });

  it('is typed into words only by the manual’s next ball: a link takes .text-link instead', () => {
    const typed = files(SRC, '.ts').flatMap((file) =>
      file.text.split('\n').some((line) => !line.trim().startsWith('/') && TYPED.test(line))
        ? [file.path]
        : [],
    );
    expect(typed).toStrictEqual(['ui/manual/manual.ts']);
  });
});
