// The first five minutes (first-visit-flow.ts, ADR 0090) at 390 x 664, what Safari leaves of an
// iPhone.
import { describe, it } from 'vitest';
import { runFirstVisitFlow } from './first-visit-flow.ts';

describe('the first five minutes on a phone', () => {
  it('guides the first series, then shows everything, once', { timeout: 300_000 }, async () => {
    await runFirstVisitFlow();
  });
});
