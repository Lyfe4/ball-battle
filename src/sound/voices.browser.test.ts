// Every sound rendered offline in a real engine: none clips on its own (the limiter is for many at
// once), none is silent, and none outstays its moment.
import { describe, expect, it } from 'vitest';

import { TOSS_FLIP_MS } from '../api/live.ts';
import { masterChain } from './engine.ts';
import { whiteNoise } from './synth.ts';
import { VOICES, type SoundName } from './voices.ts';

/** Playwright's WebKit on Linux and Windows is built without Web Audio: rendered in Chromium and Firefox. */
const noAudio = !('OfflineAudioContext' in globalThis);

const RATE = 44_100;
/** The series result is the longest sound; everything else is far shorter. */
const LONGEST_S = 1.4;
/** The coin's flutter lasts while it is in the air, and stops before it lands. */
const longestOf = (name: SoundName): number =>
  name === 'coinFlip' ? TOSS_FLIP_MS / 1000 : LONGEST_S;

async function render(name: SoundName): Promise<{ peak: number; lastLoudS: number }> {
  const ctx = new OfflineAudioContext(1, RATE * 3, RATE);
  VOICES[name]({ ctx, out: ctx.destination, noise: whiteNoise(ctx) }, 0.01, {
    gain: 1,
    detune: 0,
  });
  const data = (await ctx.startRendering()).getChannelData(0);
  let peak = 0;
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const level = Math.abs(data[i] ?? 0);
    peak = Math.max(peak, level);
    if (level > 0.003) last = i;
  }
  return { peak, lastLoudS: last / RATE };
}

describe.skipIf(noAudio)('every sound', () => {
  for (const name of Object.keys(VOICES) as SoundName[]) {
    it(`${name}: heard, below full scale and short`, async () => {
      const { peak, lastLoudS } = await render(name);
      expect(peak).toBeGreaterThan(0.03);
      expect(peak).toBeLessThan(1);
      expect(lastLoudS).toBeLessThan(longestOf(name));
    });
  }
});

describe.skipIf(noAudio)('the busiest moment', () => {
  it('stays under full scale through the limiter at full volume', async () => {
    const ctx = new OfflineAudioContext(2, RATE * 2, RATE);
    const { bus } = masterChain(ctx, 1);
    const kit = { ctx, out: bus, noise: whiteNoise(ctx) };
    // Worse than any fight can be (the gate lets at most 4 sounds through in 120 ms): the loudest
    // sounds of the roster at once, the final blow among them.
    const loud = { gain: 1, detune: 0 };
    const names = [
      'knockout',
      'release',
      'bombBlast',
      'thunder',
      'rageHit',
      'curseBurst',
      'snipeHit',
      'bump',
    ] as const;
    for (const name of names) {
      VOICES[name](kit, 0.01, loud);
    }
    const out = await ctx.startRendering();
    let peak = 0;
    for (let channel = 0; channel < out.numberOfChannels; channel += 1) {
      for (const sample of out.getChannelData(channel)) peak = Math.max(peak, Math.abs(sample));
    }
    expect(peak).toBeLessThan(1);
  });
});
