// The player's sound choice, remembered per device like the speed (speed.ts): on or off, and a
// volume. Storage can be missing or throw (private windows, blocked site data), and that only ever
// means the defaults: on, at a moderate volume. Audio still waits for the first tap (engine.ts),
// and on an iPhone it follows the ring/silent switch, so "on" never surprises anyone.

export interface SoundSettings {
  readonly on: boolean;
  /** 0 to 1, as the slider shows it (heard on a curve, `gainOf`). */
  readonly volume: number;
}

export const SOUND_STORAGE_KEY = 'ballbattle.sound';
export const DEFAULT_SOUND: SoundSettings = { on: true, volume: 0.7 };

/** Reads a stored choice ("on:0.7", "off:0.4"); anything unrecognised is the default. */
export function parseSound(raw: string | null | undefined): SoundSettings {
  const match = /^(on|off):(\d(?:\.\d+)?)$/.exec(raw?.trim() ?? '');
  if (match === null) return DEFAULT_SOUND;
  const volume = Number(match[2]);
  if (!(volume >= 0 && volume <= 1)) return DEFAULT_SOUND;
  return { on: match[1] === 'on', volume };
}

export function formatSound(settings: SoundSettings): string {
  return `${settings.on ? 'on' : 'off'}:${String(Math.round(settings.volume * 100) / 100)}`;
}

export function loadSound(storage: () => Pick<Storage, 'getItem'>): SoundSettings {
  try {
    return parseSound(storage().getItem(SOUND_STORAGE_KEY));
  } catch {
    return DEFAULT_SOUND;
  }
}

export function saveSound(storage: () => Pick<Storage, 'setItem'>, settings: SoundSettings): void {
  try {
    storage().setItem(SOUND_STORAGE_KEY, formatSound(settings));
  } catch {
    // Not remembered this time; the choice still holds for this visit.
  }
}

/** The gain a slider position is heard at: a square curve, so the slider's middle sounds half. */
export function gainOf(settings: SoundSettings): number {
  return settings.on ? settings.volume * settings.volume : 0;
}
