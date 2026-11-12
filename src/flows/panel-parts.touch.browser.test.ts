// The panel's small parts in a real fight (panel-parts-flow.ts, ADR 0047) at 375 x 812 with touch, the browsers-touch project.
import { describe, it } from 'vitest';
import { runPanelPartsFlow } from './panel-parts-flow.ts';

describe('health bars, the series bar and Leave series in a fight', () => {
  it('keeps both health layers in the pill, phrases whole and Stay beside Leave', async () => {
    await runPanelPartsFlow(false);
  }, 60_000);
});
