// The phone arena flow (phone-arena-flow.ts, ADR 0039) at 390 x 844 with touch, the browsers-iphone project.
import { describe, it } from 'vitest';
import { runPhoneArenaFlow } from './phone-arena-flow.ts';

describe('the phone arena is the screen', () => {
  it('court full width, the fight on one screen, opened parts scroll', async () => {
    await runPhoneArenaFlow();
  }, 600_000);
});
