// PROTOTYPE ONLY (proto/ball-looks): the Titan's growth controls in the gallery: play it at full,
// normal or quarter speed, or drag the slider through every size by hand, so a jump would show.
import { MAX_RADIUS, titanRadius } from '../sim/balls/titan.ts';
import { STANDARD_BALL_RADIUS } from '../sim/constants.ts';
import type { GalleryState } from './timelines.ts';

const GROW_TICKS = 667;
const HOLD_TICKS = 180;
const SPEEDS = [
  ['2×', 2],
  ['1×', 1],
  ['¼×', 0.25],
] as const;

export interface Scrub {
  readonly element: HTMLElement;
  /** The Titan's state for this frame, `ms` since the page began. */
  readonly state: (ms: number) => GalleryState;
}

export function titanScrub(): Scrub {
  let speed = 2;
  let playing = true;
  let growth = 0;
  let last: number | undefined;
  const element = document.createElement('div');
  element.className = 'scrub';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(STANDARD_BALL_RADIUS);
  slider.max = String(MAX_RADIUS);
  slider.step = '0.1';
  slider.value = slider.min;
  slider.setAttribute('aria-label', 'Titan size');
  slider.addEventListener('input', () => {
    playing = false;
    play.textContent = 'Play';
  });
  const play = document.createElement('button');
  play.type = 'button';
  play.textContent = 'Hold';
  play.addEventListener('click', () => {
    playing = !playing;
    play.textContent = playing ? 'Hold' : 'Play';
  });
  const buttons = SPEEDS.map(([label, value]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset['on'] = String(value === speed);
    button.addEventListener('click', () => {
      speed = value;
      playing = true;
      play.textContent = 'Hold';
      for (const other of buttons) other.dataset['on'] = String(other === button);
    });
    return button;
  });
  element.append(play, ...buttons, slider);

  const state = (ms: number): GalleryState => {
    const step = last === undefined ? 0 : ((ms - last) / 1000) * 60 * speed;
    last = ms;
    let radius = Number(slider.value);
    if (playing) {
      growth = (growth + step) % (GROW_TICKS + HOLD_TICKS);
      radius = titanRadius(Math.min(growth, GROW_TICKS));
      slider.value = radius.toFixed(1);
    }
    const seconds = (radius - STANDARD_BALL_RADIUS) / 0.06 / 60;
    const how = playing ? `playing at ${SPEEDS.find(([, v]) => v === speed)?.[0] ?? ''}` : 'held';
    return {
      caption: `Radius ${radius.toFixed(1)} (${seconds.toFixed(1)} s into a fight), ${how}. Drag to scrub.`,
      radius,
      tick: Math.floor((ms / 1000) * 60),
    };
  };
  return { element, state };
}
