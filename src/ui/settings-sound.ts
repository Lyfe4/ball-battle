// The settings menu's Sound row (ADR 0040): one row like Speed, so the menu grows by as little as
// it can: its word, a volume slider, and a switch for on or off. The slider plays a sound at the
// new level as it is let go, so the player hears what they chose. Saved per device by sound.ts.
import { DEFAULT_SOUND } from '../app/sound-settings.ts';
import { cue, setSoundSettings, soundSettings } from '../sound/sound.ts';
import { element } from './dom.ts';

export function createSoundSettings(): { element: HTMLElement; refresh(): void } {
  const row = element('div', 'settings-sound');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Sound');
  const current = () => soundSettings() ?? DEFAULT_SOUND;

  const volume = element('input', 'settings-volume');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '100';
  volume.step = '5';
  volume.setAttribute('aria-label', 'Volume');
  volume.addEventListener('input', () => {
    setSoundSettings({ on: true, volume: Number(volume.value) / 100 });
    refresh();
  });
  volume.addEventListener('change', () => {
    cue('lock');
  });

  // The menu's switch, without its words: the row's word says what it is.
  const toggle = element('button', 'settings-switch settings-sound-switch');
  toggle.type = 'button';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-label', 'Sound effects');
  // It taps once it has switched (below), so turning sound on is heard too.
  toggle.dataset['sound'] = 'own';
  const track = element('span', 'settings-switch-track');
  track.setAttribute('aria-hidden', 'true');
  track.append(element('span', 'settings-switch-thumb'));
  toggle.append(track);
  toggle.addEventListener('click', () => {
    const now = current();
    setSoundSettings({ ...now, on: !now.on });
    refresh();
    cue('tap');
  });

  const label = element('label', 'settings-sound-label', 'Sound');
  label.htmlFor = 'settings-volume';
  volume.id = 'settings-volume';
  row.append(label, volume, toggle);

  function refresh(): void {
    const { on, volume: level } = current();
    toggle.setAttribute('aria-checked', String(on));
    volume.value = String(Math.round(level * 100));
    row.toggleAttribute('data-off', !on);
  }
  refresh();
  return { element: row, refresh };
}
