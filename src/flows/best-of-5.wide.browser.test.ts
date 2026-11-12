// The Best of 5 flow (best-of-5-flow.ts, ADR 0048) at 1280 x 800, the browsers-wide project.
import { describe, it } from 'vitest';
import { runBestOf5Flow } from './best-of-5-flow.ts';

describe('a Best of 5 from Other modes', () => {
  it('plays each format to three wins, reloads and resumes mid-series', async () => {
    await runBestOf5Flow();
  }, 900_000);
});
