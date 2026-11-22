// The matchup chart at 1920 x 1080 (matchup-spectrum-desktop.ts).
import { describe, it } from 'vitest';
import { checkDesktopChart } from './matchup-spectrum-desktop.ts';

describe('the matchup chart on a full HD screen', () => {
  it('lays the bands out as five columns under the reason’s strip', async () => {
    await checkDesktopChart('1920 x 1080');
  }, 60_000);
});
