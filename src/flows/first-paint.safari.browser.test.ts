// A first visit paints its real frame once, at 390 x 664 (a phone in Safari) (ADR 0087, first-paint-flow.ts): Play,
// Balls and Friends each show in the font, the canvas at its laid-out size, and nothing moves.
import { describe, it } from 'vitest';
import { checkFirstPaint, checkNewDeviceFirstPaint } from './first-paint-flow.ts';

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

  // Last: it leaves this file's device new (ADR 0090).
  it('shows a brand-new device’s Play once, in its place, and leaves it new', async () => {
    await checkNewDeviceFirstPaint();
  });
});
