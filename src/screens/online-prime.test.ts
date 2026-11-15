import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPrimer } from './online-prime.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const answering = (status: number) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json({ id: 's1' }, { status }))),
  );

describe('reading the next screen first', () => {
  it('hands the read series to its screen once', async () => {
    answering(200);
    const primer = createPrimer();
    await primer.series('s1');
    expect(primer.takeSeries('s2')).toBeUndefined();
    await primer.series('s1');
    expect(primer.takeSeries('s1')).toMatchObject({ ok: true, body: { id: 's1' } });
    expect(primer.takeSeries('s1')).toBeUndefined();
  });

  it('keeps no failure: the screen reads again and says what failed', async () => {
    answering(503);
    const primer = createPrimer();
    await primer.series('s1');
    expect(primer.takeSeries('s1')).toBeUndefined();
  });

  it('drops an answer not shown soon', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    answering(200);
    const primer = createPrimer();
    await primer.series('s1');
    vi.setSystemTime(Date.now() + 10_001);
    expect(primer.takeSeries('s1')).toBeUndefined();
  });
});
