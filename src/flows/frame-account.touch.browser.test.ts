// One frame for an account (frame-account-flow.ts, ADR 0087, 0089): Profile and All matches signed
// in, their header rows on the same pixels as the tabs'.
import { describe, it } from 'vitest';
import { checkAccountFrame } from './frame-account-flow.ts';

describe('one frame, signed in', () => {
  it('puts Profile’s and All matches’ header rows where the tabs’ are', async () => {
    await checkAccountFrame();
  });
});
