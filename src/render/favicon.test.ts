import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { brawler } from '../sim/balls/brawler.ts';
import { theme } from './theme.ts';

describe('favicon', () => {
  it('is drawn in the Brawler’s own colours, so it changes when the ball does', () => {
    const svg = readFileSync(new URL('../../public/favicon.svg', import.meta.url), 'utf8');
    expect(svg).toContain(`fill="${brawler.color}"`);
    expect(svg).toContain(`fill="${theme.ballAccents['brawler'] ?? ''}"`);
  });
});
