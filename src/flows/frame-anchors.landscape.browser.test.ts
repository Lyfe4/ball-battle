// One frame at 812 x 375 and, in landscape-small, 667 x 320 (a phone sideways) (ADR 0087, frame-anchors-flow.ts): every screen where nothing fights has the
// header row.
import { describe, it } from 'vitest';
import { checkFrameAnchors } from './frame-anchors-flow.ts';

describe('one frame', () => {
  it('gives every screen where nothing fights the same header row', async () => {
    await checkFrameAnchors({ across: false });
  });
});
