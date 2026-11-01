import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../sim/definitions.ts';
import { blue, red } from '../sim/test-support.ts';
import type { MatchState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { describeResult } from './result-text.ts';

const world = createWorld(1, [red, blue]);
const definitions = indexDefinitions([red, blue]);

function finished(
  result: Extract<MatchState, { status: 'finished' }>['result'],
  reason: 'knockout' | 'timeLimit',
): MatchState {
  return { status: 'finished', result, reason, endTick: 100 };
}

describe('describeResult', () => {
  it('is empty while running', () => {
    expect(describeResult(world.match, world, definitions)).toBe('');
  });

  it('names the winner by definition name and says how they won', () => {
    const win = { kind: 'win', winnerId: 'ball-1' } as const;
    expect(describeResult(finished(win, 'knockout'), world, definitions)).toBe(
      'Blue wins by knockout',
    );
    expect(describeResult(finished(win, 'timeLimit'), world, definitions)).toBe(
      'Blue wins on time',
    );
  });

  it('distinguishes a mutual knockout from a draw on time', () => {
    const draw = { kind: 'draw' } as const;
    expect(describeResult(finished(draw, 'knockout'), world, definitions)).toBe(
      'Draw: both knocked out',
    );
    expect(describeResult(finished(draw, 'timeLimit'), world, definitions)).toBe('Draw on time');
  });
});
