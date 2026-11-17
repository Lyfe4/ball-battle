// No two balls sound alike (ADR 0064): every ball's own sounds rendered offline in a real engine,
// each reduced to a coarse picture of its sound (loudness in 24 pitch bands, over 12 slices of
// time), and every pair of sounds that belong to different balls compared. Two sounds whose
// pictures are nearly the same shape would be heard as the same hit; each pair must stay apart.
import { describe, expect, it } from 'vitest';

import { BALL_SOUNDS } from './ball-sounds.ts';
import type { FightCue } from './cue-names.ts';
import { whiteNoise } from './synth.ts';
import { VOICES } from './voices.ts';

/** Playwright's WebKit on Linux and Windows is built without Web Audio: rendered in Chromium and Firefox. */
const noAudio = !('OfflineAudioContext' in globalThis);

const RATE = 22_050;
const SLICES = 12;
const SLICE = 1024;
const BANDS = 24;
/** Band centres, log-spaced from 60 Hz to 8 kHz. */
const CENTRES = Array.from({ length: BANDS }, (_, i) => 60 * (8000 / 60) ** (i / (BANDS - 1)));
/** The most alike two balls' sounds may be (cosine similarity of their pictures). */
const MOST_ALIKE = 0.9;

/** Loudness of `samples[from, from + SLICE)` at `hz` (Goertzel). */
function bandLevel(samples: Float32Array, from: number, hz: number): number {
  const k = (2 * Math.PI * hz) / RATE;
  const coefficient = 2 * Math.cos(k);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < SLICE; i += 1) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (SLICE - 1));
    const s0 = (samples[from + i] ?? 0) * window + coefficient * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coefficient * s1 * s2));
}

async function picture(name: FightCue): Promise<number[]> {
  const ctx = new OfflineAudioContext(1, SLICES * SLICE, RATE);
  VOICES[name]({ ctx, out: ctx.destination, noise: whiteNoise(ctx) }, 0, { gain: 0.8, detune: 0 });
  const samples = (await ctx.startRendering()).getChannelData(0);
  const values: number[] = [];
  for (let slice = 0; slice < SLICES; slice += 1) {
    for (const hz of CENTRES) values.push(Math.log1p(bandLevel(samples, slice * SLICE, hz) * 50));
  }
  return values;
}

function similarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  a.forEach((value, i) => {
    const other = b[i] ?? 0;
    dot += value * other;
    aa += value * value;
    bb += other * other;
  });
  return aa === 0 || bb === 0 ? 0 : dot / Math.sqrt(aa * bb);
}

describe.skipIf(noAudio)('every ball sounds like itself', () => {
  it('keeps every pair of different balls’ sounds apart', async () => {
    const owners = Object.entries(BALL_SOUNDS).flatMap(([ball, sounds]) =>
      ball === 'brawler' ? [] : sounds.map((sound) => ({ ball, sound })),
    );
    const pictures = new Map<FightCue, number[]>();
    for (const { sound } of owners) pictures.set(sound, await picture(sound));
    const pairs: { pair: string; alike: number }[] = [];
    owners.forEach((a, i) => {
      for (const b of owners.slice(i + 1)) {
        if (a.ball === b.ball) continue;
        const alike = similarity(pictures.get(a.sound) ?? [], pictures.get(b.sound) ?? []);
        pairs.push({ pair: `${a.ball} ${a.sound} / ${b.ball} ${b.sound}`, alike });
      }
    });
    pairs.sort((x, y) => y.alike - x.alike);
    console.log(
      'most alike:',
      pairs
        .slice(0, 8)
        .map(({ pair, alike }) => `${pair} ${alike.toFixed(3)}`)
        .join('; '),
    );
    expect(pairs.filter(({ alike }) => alike > MOST_ALIKE)).toStrictEqual([]);
  });
});
