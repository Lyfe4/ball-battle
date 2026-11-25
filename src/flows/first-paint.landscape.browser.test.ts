// A first visit paints its real frame once, at 812 x 375 (a phone turned sideways) (ADR 0087, first-paint-flow.ts): Play,
// Balls and Friends each show in the font, the canvas at its laid-out size, and nothing moves.
import { describe, it } from 'vitest';
import { checkFirstPaint } from './first-paint-flow.ts';

describe('the first paint', () => {
  it('shows Play once, in its place', async () => {
    await checkFirstPaint('', 'Play');
  });

  it('shows Balls once, in its place', async () => {
    await checkFirstPaint('?view=manual', 'Balls');
  });

  it('shows Friends once, in its place', async () => {
    await checkFirstPaint('?view=friends', 'Friends');
  });
});
