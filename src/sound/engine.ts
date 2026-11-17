// The one AudioContext and what every sound plays through: volume, a limiter so a busy moment can
// never clip, and a little room. Browsers only let a page start audio after a tap or a key (iPhone
// Safari most strictly), so the context is made on the first gesture, never before; until then
// every sound is skipped, never queued, so nothing old plays late. A hidden page is suspended and
// resumed on return, and a context iOS left "interrupted" is resumed on the next gesture, or made
// again if it won't. Playing never throws and never waits: a fight can't be held up by sound.
import { roomImpulse, whiteNoise, type Kit } from './synth.ts';
import { VOICES, type Play, type SoundName } from './voices.ts';

/** How loud the room is behind every sound. */
const ROOM_LEVEL = 0.12;
/** Sounds are scheduled this far ahead, so their first milliseconds are never cut. */
const LEAD_S = 0.01;

/** The gestures that let a page start audio. `touchend` and `click` are the ones iOS accepts. */
const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'] as const;

interface Running {
  readonly ctx: AudioContext;
  readonly volume: GainNode;
  readonly kit: Kit;
}

export interface SoundEngine {
  play(name: SoundName, play: Play, pan?: number): void;
  /** 0 is silent, 1 is full. */
  setVolume(volume: number): void;
  /** Whether a sound played now would be heard (the context runs). */
  ready(): boolean;
}

/** iOS: Web Audio follows the ring/silent switch and lets the player's own music keep playing. */
function ambientSession(): void {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session === undefined) return;
  try {
    session.type = 'ambient';
  } catch {
    // An older Safari: ambient is already its default for Web Audio.
  }
}

/**
 * What every sound plays into (`bus`): a little room beside it, the volume, then a limiter, so a
 * busy moment is squeezed rather than clipped.
 */
export function masterChain(
  ctx: BaseAudioContext,
  volumeLevel: number,
): { readonly volume: GainNode; readonly bus: GainNode } {
  const volume = ctx.createGain();
  volume.gain.value = volumeLevel;
  // A limiter: loud moments are squeezed, never clipped.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  const bus = ctx.createGain();
  const room = ctx.createConvolver();
  room.buffer = roomImpulse(ctx);
  const send = ctx.createGain();
  send.gain.value = ROOM_LEVEL;
  bus.connect(volume);
  bus.connect(send).connect(room).connect(volume);
  volume.connect(limiter).connect(ctx.destination);
  return { volume, bus };
}

function build(volumeLevel: number): Running | undefined {
  // Every browser the game supports has it unprefixed (Safari since 14.1); one without stays quiet.
  if (!('AudioContext' in window)) return undefined;
  ambientSession();
  const ctx = new AudioContext({ latencyHint: 'interactive' });
  const { volume, bus } = masterChain(ctx, volumeLevel);
  return { ctx, volume, kit: { ctx, out: bus, noise: whiteNoise(ctx) } };
}

export function createSoundEngine(initialVolume: number): SoundEngine {
  let running: Running | undefined;
  let level = initialVolume;

  function wake(): void {
    try {
      if (running === undefined || running.ctx.state === 'closed') {
        running = build(level);
      } else if (running.ctx.state !== 'running') {
        const stuck = running;
        // Resumed by this gesture; iOS sometimes leaves it interrupted, so it is made again then.
        stuck.ctx.resume().catch(() => {
          if (running === stuck) {
            void stuck.ctx.close().catch(() => undefined);
            running = undefined;
          }
        });
      }
    } catch {
      running = undefined;
    }
  }

  for (const gesture of GESTURES) {
    document.addEventListener(gesture, wake, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (running === undefined) return;
    // Hidden: stop the clock so nothing plays to an empty room. Back: carry on (a gesture also
    // resumes it where Safari refuses without one).
    if (document.hidden) void running.ctx.suspend().catch(() => undefined);
    else void running.ctx.resume().catch(() => undefined);
  });

  return {
    play(name, play, pan = 0) {
      if (running?.ctx.state !== 'running' || play.gain <= 0) return;
      try {
        const { ctx, kit } = running;
        let out: AudioNode = kit.out;
        if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
          const panner = ctx.createStereoPanner();
          panner.pan.value = pan;
          panner.connect(kit.out);
          out = panner;
        }
        VOICES[name]({ ...kit, out }, ctx.currentTime + LEAD_S, play);
      } catch {
        // A sound that can't be made is skipped; the game goes on.
      }
    },
    setVolume(volume) {
      level = volume;
      if (running === undefined) return;
      running.volume.gain.setTargetAtTime(volume, running.ctx.currentTime, 0.02);
    },
    ready: () => running?.ctx.state === 'running',
  };
}
