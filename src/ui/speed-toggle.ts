import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '../app/speed.ts';
import { element } from './dom.ts';

/**
 * The 1x / 2x playback speed toggle: a labelled group of two buttons, the current one pressed.
 * It only reports the choice; the frame loop applies it and remembers it.
 */
export function createSpeedToggle(
  root: HTMLElement,
  initial: PlaybackSpeed,
  onChange: (speed: PlaybackSpeed) => void,
): void {
  root.replaceChildren();
  root.className = 'speed-toggle';
  root.setAttribute('role', 'group');
  const labelId = 'speed-toggle-label';
  root.setAttribute('aria-labelledby', labelId);
  const label = element('span', 'speed-toggle-label', 'Speed');
  label.id = labelId;
  root.append(label);

  const buttons = PLAYBACK_SPEEDS.map((speed) => {
    const button = element('button', 'speed-toggle-button', `${String(speed)}×`);
    button.type = 'button';
    button.setAttribute('aria-label', `${String(speed)} times speed`);
    button.addEventListener('click', () => {
      select(speed);
      onChange(speed);
    });
    root.append(button);
    return { speed, button };
  });

  function select(current: PlaybackSpeed): void {
    for (const { speed, button } of buttons) {
      button.setAttribute('aria-pressed', String(speed === current));
    }
  }
  select(initial);
}
