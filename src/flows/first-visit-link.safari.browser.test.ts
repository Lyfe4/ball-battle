// A friend's link as a brand-new device's first visit (ADR 0090, D4), at 390 x 664: it opens the
// challenge at once, never gated or detoured by the guided first series, which stays ahead.
import { describe, expect, it } from 'vitest';
import { FIRST_SERIES_STORAGE_KEY } from '../app/first-series.ts';
import { openAsNewDevice } from './first-visit-flow.ts';
import { until } from './page-support.ts';
import { screenOn } from './shell-routes-support.ts';

describe('a friend’s link as a first visit', () => {
  it('opens the challenge at once, and leaves the first series ahead', async () => {
    await openAsNewDevice('?challenge=AbCdEfGhIjKlMnOpQrStUv');
    await until(() => screenOn() === 'challenge', 5_000, 'the challenge', false);
    expect(location.search).toBe('?challenge=AbCdEfGhIjKlMnOpQrStUv');
    // The page never asked: the first series is still ahead when they come to Play.
    expect(localStorage.getItem(FIRST_SERIES_STORAGE_KEY)).not.toBe('done');
    expect(localStorage.getItem(FIRST_SERIES_STORAGE_KEY)).not.toBe('graduated');
  });
});
