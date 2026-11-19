// PROTOTYPE ONLY (proto/ball-looks-2): each ball's controls in the gallery: play its states at
// double, normal or quarter speed, or hold one and drag the slider through them by hand.
import type { GalleryState, Timeline } from './timelines.ts';

const SPEEDS = [
  ['2×', 2],
  ['1×', 1],
  ['¼×', 0.25],
] as const;

export interface Scrub {
  readonly element: HTMLElement;
  /** The ball's state for this frame, `ms` since the page began. */
  readonly state: (ms: number) => GalleryState;
}

export function scrubFor(name: string, timeline: Timeline, reduced: boolean): Scrub {
  let speed = 1;
  // With reduced motion nothing plays on its own: it starts held.
  let playing = !reduced;
  let position = 0;
  let last: number | undefined;
  const element = document.createElement('div');
  element.className = 'scrub';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(timeline.length - 1);
  slider.step = '1';
  slider.value = '0';
  slider.setAttribute('aria-label', `${name}: moment in its cycle`);
  const play = document.createElement('button');
  play.type = 'button';
  const label = (): void => {
    play.textContent = playing ? 'Hold' : 'Play';
  };
  label();
  slider.addEventListener('input', () => {
    playing = false;
    position = Number(slider.value);
    label();
  });
  play.addEventListener('click', () => {
    playing = !playing;
    label();
  });
  const buttons = SPEEDS.map(([text, value]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.dataset['on'] = String(value === speed);
    button.addEventListener('click', () => {
      speed = value;
      playing = true;
      label();
      for (const other of buttons) other.dataset['on'] = String(other === button);
    });
    return button;
  });
  element.append(play, ...buttons, slider);

  const state = (ms: number): GalleryState => {
    const step = last === undefined ? 0 : ((ms - last) / 1000) * 60 * speed;
    last = ms;
    if (playing) {
      position = (position + step) % timeline.length;
      slider.value = String(Math.floor(position));
    }
    return timeline.at(position);
  };
  return { element, state };
}
