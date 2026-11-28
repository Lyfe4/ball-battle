import { describe, expect, it } from 'vitest';
import type { StartView } from '../api/start.ts';
import { startLine, startMadeLine, startWaiting } from './start-text.ts';

const T = 1_700_000_000_000;
const start = (over: Partial<StartView> = {}): StartView => ({
  id: 'start',
  you: 'a',
  format: 'reveal',
  bestOf: 3,
  they: 'Jo',
  deadline: T + 42_000,
  now: T,
  draft: [],
  seq: 0,
  locked: false,
  theirsLocked: false,
  seriesId: null,
  filled: [],
  missed: [],
  rematchOf: null,
  ...over,
});

describe('the lineups picked together (ADR 0080)', () => {
  it('say whether the other is choosing or ready, never which balls', () => {
    expect(startLine(start(), 42)).toBe('Jo is choosing · 42 s');
    // A rematch says it is on the match before's rules (ADR 0089 addendum of 2026-11-28).
    expect(startLine(start({ rematchOf: 's1' }), 42)).toBe(
      'Rematch, same rules · Jo is choosing · 42 s',
    );
    expect(startLine(start({ theirsLocked: true }), 7)).toBe('Jo is ready · 7 s');
    expect(startLine(start({ they: null }), 3)).toBe('Your friend is choosing · 3 s');
  });

  it('tell both phones what the clock decided, from each side', () => {
    const made = { seriesId: 'series' };
    expect(startMadeLine(start({ ...made }))).toBeUndefined();
    expect(startMadeLine(start({ ...made, filled: ['b'] }))).toBe(
      'Time ran out: Jo’s lineup was finished at random.',
    );
    expect(startMadeLine(start({ ...made, filled: ['b'], you: 'b' }))).toBe(
      'Time ran out: your lineup was finished at random.',
    );
    expect(startMadeLine(start({ ...made, filled: ['a', 'b'] }))).toBe(
      'Time ran out: both lineups were finished at random.',
    );
    expect(startMadeLine(start({ ...made, missed: ['b'] }))).toBe(
      'Time ran out: Jo never opened their lineup.',
    );
    expect(startMadeLine(start({ ...made, missed: ['a'] }))).toBe(
      'Time ran out before you opened your lineup.',
    );
    expect(startMadeLine(start({ ...made, missed: ['a', 'b'] }))).toBe(
      'Time ran out: neither lineup was opened.',
    );
  });

  it('always offer a way on: Home while waiting, Go to match on the way in', () => {
    const home = () => undefined;
    const waiting = startWaiting(start({ locked: true }), { seconds: 12, home });
    expect(waiting.waiting).toStrictEqual({
      title: 'Waiting for Jo’s lineup',
      line: 'The match starts when it’s in · 12 s left',
    });
    // The way out, never the main action (ADR 0087 addendum of 2026-11-28).
    expect(waiting.buttons).toStrictEqual([{ text: 'Home', onClick: home, plain: true }]);
    expect(waiting.quiet).toBeUndefined();
    const going = startWaiting(start(), { made: 'Time ran out', home, go: home });
    expect(going.buttons.map((button) => button.text)).toStrictEqual(['Go to match']);
  });
});
