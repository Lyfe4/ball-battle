// The first five minutes (first-visit-flow.ts, ADR 0090) at 1920 x 1080, beside the court.
import { describe, it } from 'vitest';
import { runFirstVisitFlow } from './first-visit-flow.ts';

describe('the first five minutes on a desktop', () => {
  it('guides the first series, then shows everything, once', { timeout: 300_000 }, async () => {
    await runFirstVisitFlow();
  });
});
