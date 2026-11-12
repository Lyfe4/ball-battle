// The panel's small parts in a real fight (panel-parts-flow.ts, ADR 0047) at 1280 x 800, the browsers-wide project.
import { describe, it } from 'vitest';
import { runPanelPartsFlow } from './panel-parts-flow.ts';

describe('health bars, the series bar and Leave series in a fight', () => {
  it('keeps both health layers in the pill, phrases whole and Stay beside Leave', async () => {
    await runPanelPartsFlow(true);
  }, 60_000);
});
