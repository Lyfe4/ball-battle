// Motion comes from the tokens (ADR 0087): outside the arena, every transition and animation takes
// its duration and easing from tokens.css (--motion-quick, --motion-base, --motion-slow, --ease-out,
// --ease-in), so the platform screens move alike and a restyle changes one file. The arena's own
// moments (the tips, the ready card and its 3-2-1, the Winner sticker, the toss, the pick clock) are
// energy by design (ADR 0032) and keep their literals. Today's other literals are listed below; the
// list only shrinks (a literal it names that is gone fails too, so the list stays true) and is
// empty once screen motion is built (ADR 0087, the plan's PR 19).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

/** Where literals belong: the tokens themselves and the arena's own moments. */
const EXEMPT = new Set([
  'styles/tokens.css',
  'ui/arena-tips.css',
  'ui/ready-card.css',
  'ui/winner-sticker.css',
  'ui/series/coin-toss.css',
  'ui/series/pick-clock.css',
]);

/** Today's literals outside the arena, per file, sorted: to be moved onto tokens, never added to. */
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  'styles/layout.css': ['0.4s', 'ease-out'],
  'ui/busy-button.css': [
    '560ms',
    '560ms',
    'cubic-bezier(0.5, 0, 0.5, 1)',
    'cubic-bezier(0.5, 0, 0.5, 1)',
  ],
  'ui/button.css': ['120ms', '80ms', '80ms', 'ease-out', 'ease-out', 'ease-out'],
  'ui/hud.css': ['0.3s', '300ms', '450ms', 'ease-out'],
  'ui/manual/manual.css': ['0.15s'],
  'ui/notice.css': [
    '900ms',
    '900ms',
    'cubic-bezier(0.5, 0, 0.5, 1)',
    'cubic-bezier(0.5, 0, 0.5, 1)',
  ],
  'ui/quick-setup.css': ['0.15s'],
  'ui/series/leave-confirm.css': ['160ms', 'ease-out'],
  'ui/skeleton.css': ['1.6s', 'ease-in-out'],
};

/** The game's stylesheets (not the dev pages: the style guide, the brand page, the test flows). */
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

const DECLARATION = /(?<![\w-])(?:transition|animation)(?:-[\w-]+)?\s*:\s*([^;{}]+)/g;
const TIME = /(?<![\w.-])\d*\.?\d+m?s(?![\w-])/g;
const EASING =
  /cubic-bezier\([^)]*\)|steps\([^)]*\)|(?<![\w-])(?:ease-in-out|ease-in|ease-out|ease|linear)(?![\w-])/g;

/** Every duration, delay and easing written as a literal in a transition or animation. */
function motionLiteralsOf(text: string): string[] {
  const source = text.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...source.matchAll(DECLARATION)]
    .flatMap((match) => {
      const value = match[1] ?? '';
      return [...value.matchAll(TIME), ...value.matchAll(EASING)].map((one) =>
        one[0].replace(/\s+/g, ' '),
      );
    })
    .sort();
}

describe('motion literals', () => {
  it('reads durations, delays and easings, and nothing from a token or a name', () => {
    expect(
      motionLiteralsOf(
        '.a { transition: opacity 0.4s ease-out, transform var(--motion-base) var(--ease-in); }\n' +
          '.b { animation: ease-pop 320ms cubic-bezier(0.2, 1.6, 0.4, 1) 1.2s infinite; }\n' +
          '/* transition: 9s linear; */ .c { animation-delay: 200ms; background: linear-gradient(red, blue); }',
      ),
    ).toStrictEqual([
      '0.4s',
      '1.2s',
      '200ms',
      '320ms',
      'cubic-bezier(0.2, 1.6, 0.4, 1)',
      'ease-out',
    ]);
  });

  it('come only from the tokens outside the arena, apart from today’s list', () => {
    const found = Object.fromEntries(
      sheets(SRC)
        .filter((sheet) => !EXEMPT.has(sheet.path))
        .map((sheet) => [sheet.path, motionLiteralsOf(sheet.text)] as const)
        .filter(([, literals]) => literals.length > 0),
    );
    expect(found).toStrictEqual(ALLOWED);
  });

  it('are named in tokens.css', () => {
    const tokens = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8');
    for (const name of ['quick', 'base', 'slow']) expect(tokens).toContain(`--motion-${name}:`);
    for (const name of ['out', 'in']) expect(tokens).toContain(`--ease-${name}:`);
  });
});
