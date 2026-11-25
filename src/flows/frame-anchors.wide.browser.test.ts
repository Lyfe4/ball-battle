// One frame at 1280 x 800 (ADR 0087, frame-anchors-flow.ts): every screen where nothing fights has the
// header row, its parts on the same pixels on every screen.
import { describe, it } from 'vitest';
import { checkFrameAnchors } from './frame-anchors-flow.ts';

describe('one frame', () => {
  it('gives every screen where nothing fights the same header row', async () => {
    await checkFrameAnchors({ play: 'frame' });
  });
});
