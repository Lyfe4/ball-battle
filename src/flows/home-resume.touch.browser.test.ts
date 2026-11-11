// Home's Resume series (home-resume-flow.ts, ADR 0046) at 375 x 812 with touch, the browsers-touch project.
import { describe, it } from 'vitest';
import { runHomeResumeFlow } from './home-resume-flow.ts';

describe('home resumes a held series in one tap', () => {
  it('says its format and score, survives a reload, and New series starts fresh', async () => {
    await runHomeResumeFlow();
  }, 300_000);
});
