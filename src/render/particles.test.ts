import { describe, expect, it } from 'vitest';
import { burst, burstSeed, particleAt, shardAt, shardPieces } from './particles.ts';
import { theme } from './theme.ts';

describe('impact particles', () => {
  const point = { x: 400, y: 300 };

  it('spawns a few for a light hit and more for a hard one, within the theme range', () => {
    expect(burst(point, 0, 1, 0)).toHaveLength(theme.particleMin);
    expect(burst(point, 1, 1, 0)).toHaveLength(theme.particleMax);
  });

  it('bursts the same way for the same tick and ball, and differently otherwise', () => {
    const seed = burstSeed(120, 'ball-1');
    expect(burst(point, 0.5, seed, 0)).toStrictEqual(burst(point, 0.5, seed, 0));
    expect(burst(point, 0.5, burstSeed(121, 'ball-1'), 0)).not.toStrictEqual(
      burst(point, 0.5, seed, 0),
    );
  });

  it('flies out, slows, fades and is gone at the end of its life', () => {
    const [particle] = burst(point, 1, 7, 1000);
    if (particle === undefined) throw new Error('expected a particle');
    expect(particleAt(particle, 1000)).toStrictEqual({
      position: point,
      radius: theme.particleRadius,
      alpha: 1,
    });
    const half = particleAt(particle, 1000 + theme.particleMs / 2);
    expect(half?.alpha).toBeCloseTo(0.5, 9);
    expect(half?.position).not.toStrictEqual(point);
    expect(particleAt(particle, 1000 + theme.particleMs)).toBeUndefined();
  });
});

describe('knockout shards', () => {
  it('breaks a ball into the theme’s number of wedges covering the whole circle', () => {
    const pieces = shardPieces(3);
    expect(pieces).toHaveLength(theme.shardCount);
    const span = pieces.reduce((sum, piece) => sum + (piece.to - piece.from), 0);
    expect(span).toBeCloseTo(Math.PI * 2, 9);
    expect(shardPieces(3)).toStrictEqual(pieces);
  });

  it('moves each wedge outwards and fades it out', () => {
    const [piece] = shardPieces(5);
    if (piece === undefined) throw new Error('expected a shard');
    const center = { x: 500, y: 500 };
    const start = shardAt(piece, center, 50, 0, 0);
    expect(start?.points[0]).toStrictEqual(center);
    expect(start?.alpha).toBe(1);
    const later = shardAt(piece, center, 50, 0, theme.shardMs / 2);
    const moved = later?.points[0];
    if (moved === undefined) throw new Error('expected a shard outline');
    const outward =
      (moved.x - center.x) * piece.direction.x + (moved.y - center.y) * piece.direction.y;
    expect(outward).toBeGreaterThan(0);
    expect(shardAt(piece, center, 50, 0, theme.shardMs)).toBeUndefined();
  });
});
