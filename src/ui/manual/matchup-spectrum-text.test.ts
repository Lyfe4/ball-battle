import { describe, expect, it } from 'vitest';
import { BALLS } from '../../sim/balls/index.ts';
import { leanOf, levelOf } from '../balls/matchups.ts';
import { BANDS, bandMark, bandOf, bandTitle, chipLabel } from './matchup-spectrum-text.ts';

const nameOf = (id: string) => BALLS.find((ball) => ball.id === id)?.name ?? id;

describe('the matchup chart’s bands (ADR 0073 addendum of 2026-11-23)', () => {
  it('puts every other ball in exactly the band of its own lean and level', () => {
    for (const against of BALLS) {
      for (const ball of BALLS) {
        if (ball.id === against.id) continue;
        const band = bandOf(ball.id, against.id);
        const mark = bandMark(band);
        expect({ pair: `${ball.id}-${against.id}`, ...mark }).toStrictEqual({
          pair: `${ball.id}-${against.id}`,
          lean: leanOf(ball.id, against.id),
          level: leanOf(ball.id, against.id) === 'even' ? undefined : levelOf(ball.id, against.id),
        });
      }
    }
  });

  it('heads each band from the point of view of the balls in it', () => {
    expect(BANDS.map((band) => bandTitle(band, 'Thorns'))).toStrictEqual([
      'Beats Thorns',
      'Edge on Thorns',
      'Even',
      'Thorns has the edge',
      'Thorns beats',
    ]);
  });

  it('says the level in each ball’s accessible name, never by colour alone', () => {
    expect(chipLabel('archer', 'thorns', nameOf)).toBe(
      'Archer: slightly favoured against Thorns, wins about 6 in 10',
    );
    expect(chipLabel('brawler', 'thorns', nameOf)).toBe(
      'Brawler: strongly unfavoured against Thorns, Thorns wins about 7 in 10',
    );
    const even = BALLS.find((ball) => bandOf(ball.id, 'thorns') === 'even')?.id ?? '';
    expect(chipLabel(even, 'thorns', nameOf)).toBe(
      `${nameOf(even)}: even with Thorns, about 1 in 2`,
    );
  });
});
