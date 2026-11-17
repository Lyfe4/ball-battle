// The building blocks every sound is made from, in Web Audio: a tone that glides between two
// pitches and a burst of filtered noise, each with a quick attack and a smooth exponential fall.
// Nothing is loaded: every sound is a few nodes made at the moment it plays, and gone after it.

/** Where a sound is made: the context, the node it plays into, and shared white noise. */
export interface Kit {
  readonly ctx: BaseAudioContext;
  readonly out: AudioNode;
  readonly noise: AudioBuffer;
}

/** The quietest level an envelope falls to (exponential ramps can't reach 0). */
const SILENT = 0.0001;

export interface ToneSpec {
  readonly type?: OscillatorType;
  /** Start and end pitch, Hz: it glides exponentially from one to the other over `glide` s. */
  readonly from: number;
  readonly to?: number;
  readonly glide?: number;
  /** Start time and length, s. */
  readonly at: number;
  readonly length: number;
  readonly gain: number;
  readonly attack?: number;
  /** Cents up or down, for a little variety between repeats. */
  readonly detune?: number;
  /** A low-pass that rounds off a bright wave, Hz. */
  readonly soften?: number;
}

/** An envelope on a new gain node: up in `attack`, then an exponential fall to silence. */
function envelope(kit: Kit, at: number, length: number, gain: number, attack: number): GainNode {
  const node = kit.ctx.createGain();
  node.gain.setValueAtTime(SILENT, at);
  node.gain.exponentialRampToValueAtTime(Math.max(gain, SILENT * 2), at + attack);
  node.gain.exponentialRampToValueAtTime(SILENT, at + length);
  node.connect(kit.out);
  return node;
}

export function tone(kit: Kit, spec: ToneSpec): void {
  const { ctx } = kit;
  const osc = ctx.createOscillator();
  osc.type = spec.type ?? 'sine';
  osc.frequency.setValueAtTime(spec.from, spec.at);
  if (spec.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(spec.to, spec.at + (spec.glide ?? spec.length));
  }
  osc.detune.value = spec.detune ?? 0;
  const amp = envelope(kit, spec.at, spec.length, spec.gain, spec.attack ?? 0.004);
  if (spec.soften === undefined) {
    osc.connect(amp);
  } else {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = spec.soften;
    osc.connect(filter).connect(amp);
  }
  osc.start(spec.at);
  osc.stop(spec.at + spec.length + 0.02);
}

export interface NoiseSpec {
  readonly filter: BiquadFilterType;
  /** The filter's start and end frequency, Hz. */
  readonly from: number;
  readonly to?: number;
  readonly q?: number;
  readonly at: number;
  readonly length: number;
  readonly gain: number;
  readonly attack?: number;
}

export function noise(kit: Kit, spec: NoiseSpec): void {
  const { ctx } = kit;
  const source = ctx.createBufferSource();
  source.buffer = kit.noise;
  const filter = ctx.createBiquadFilter();
  filter.type = spec.filter;
  filter.Q.value = spec.q ?? 1;
  filter.frequency.setValueAtTime(spec.from, spec.at);
  if (spec.to !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(spec.to, spec.at + spec.length);
  }
  const amp = envelope(kit, spec.at, spec.length, spec.gain, spec.attack ?? 0.002);
  source.connect(filter).connect(amp);
  // A different stretch of the noise each time, so repeats never sound copied.
  const offset = (spec.at * 7.31) % Math.max(0.01, kit.noise.duration - spec.length - 0.05);
  source.start(spec.at, offset, spec.length + 0.03);
}

/** One second of white noise, the same every time (a small seeded generator, not Math.random). */
export function whiteNoise(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let state = 0x2545f491;
  for (let i = 0; i < data.length; i += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    data[i] = state / 0x80000000 - 1;
  }
  return buffer;
}

/** A small room: a short stereo tail of decaying noise, for a little air behind every sound. */
export function roomImpulse(ctx: BaseAudioContext, seconds = 0.45): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let state = 0x9e3779b9 + channel;
    for (let i = 0; i < length; i += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const fall = 1 - i / length;
      data[i] = (state / 0x80000000 - 1) * fall * fall * fall;
    }
  }
  return buffer;
}
