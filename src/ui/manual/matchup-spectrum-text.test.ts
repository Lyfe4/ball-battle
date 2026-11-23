import { describe, expect, it } from 'vitest';
import { BALLS } from '../../sim/balls/index.ts';
import { leanOf, levelOf } from '../balls/matchups.ts';
import { BANDS, bandMark, bandOf, bandTitle, chipLabel } from './matchup-spectrum-text.ts';

const nameOf = (id: string) => BALLS.find((ball) => ball.id === id)?.name ?? id;

describe('the matchup chart’s bands (ADR 0073 addendum of 2026-11-23)', () => {
  it('puts every other ball in the band of the chosen ball’s lean and level against it', () => {
    for (const against of BALLS) {
      for (const ball of BALLS) {
        if (ball.id === against.id) continue;
        const band = bandOf(ball.id, against.id);
        const mark = bandMark(band);
        expect({ pair: `${ball.id}-${against.id}`, ...mark }).toStrictEqual({
          pair: `${ball.id}-${against.id}`,
          lean: leanOf(against.id, ball.id),
          level: leanOf(against.id, ball.id) === 'even' ? undefined : levelOf(against.id, ball.id),
        });
      }
    }
  });

  it('heads each band from the chosen ball’s side, as the pick screens mark it', () => {
    expect(BANDS.map((band) => bandTitle(band, 'Thorns'))).toStrictEqual([
      'Thorns beats',
      'Thorns has the edge',
      'Even',
      'Edge on Thorns',
      'Beats Thorns',
    ]);
    // Green ▲▲ first (the chosen ball strongly favoured), red ▼▼ last.
    expect(BANDS.map((band) => bandMark(band))).toStrictEqual([
      { lean: 'favoured', level: 'strong' },
      { lean: 'favoured', level: 'edge' },
      { lean: 'even', level: undefined },
      { lean: 'unfavoured', level: 'edge' },
      { lean: 'unfavoured', level: 'strong' },
    ]);
    expect(bandOf('brawler', 'thorns')).toBe('beats');
    expect(bandOf('archer', 'thorns')).toBe('edged');
  });

  it('says the level in each ball’s accessible name, never by colour alone', () => {
    expect(chipLabel('archer', 'thorns', nameOf)).toBe(
      'Archer: Thorns slightly unfavoured, Archer wins about 6 in 10',
    );
    expect(chipLabel('brawler', 'thorns', nameOf)).toBe(
      'Brawler: Thorns strongly favoured, Thorns wins about 7 in 10',
    );
    const even = BALLS.find((ball) => bandOf(ball.id, 'thorns') === 'even')?.id ?? '';
    expect(chipLabel(even, 'thorns', nameOf)).toBe(
      `${nameOf(even)}: even with Thorns, about 1 in 2`,
    );
  });
});
