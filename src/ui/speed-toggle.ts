import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '../app/speed.ts';
import { createSegmented, type Segmented } from './segmented.ts';

/** The 1x / 2x playback speed toggle. The frame loop applies the choice and remembers it. */
export function createSpeedToggle(
  root: HTMLElement,
  initial: PlaybackSpeed,
  onChange: (speed: PlaybackSpeed) => void,
): Segmented<PlaybackSpeed> {
  const segmented = createSegmented(
    root,
    'speed-toggle',
    'Speed',
    PLAYBACK_SPEEDS.map((speed) => ({
      value: speed,
      text: `${String(speed)}×`,
      label: `${String(speed)} times speed`,
    })),
    initial,
    onChange,
  );
  // The in-match toggle carries the game's energy (ADR 0032); other segmented choices stay calm.
  root.classList.add('speed-toggle');
  return segmented;
}
