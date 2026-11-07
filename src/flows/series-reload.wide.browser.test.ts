// The reload-safe series flow (series-reload-flow.ts, ADR 0042) at 1280 x 800, the browsers-wide project.
import { describe, it } from 'vitest';
import { runSeriesReloadFlow } from './series-reload-flow.ts';

describe('a reload puts a Best of 3 back exactly where it was', () => {
  it('at every step, in every format, keeping the bot hidden', async () => {
    await runSeriesReloadFlow();
  }, 900_000);
});
