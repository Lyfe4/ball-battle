// The settings menu's Sound group (ADR 0040): a switch, and a volume slider that plays a bump at
// the new level as it is let go, so the player hears what they chose. Saved per device by sound.ts.
import { DEFAULT_SOUND } from '../app/sound-settings.ts';
import { cue, setSoundSettings, soundSettings } from '../sound/sound.ts';
import { element } from './dom.ts';
import { createSwitch } from './settings-menu.ts';

const ID = 'settings-sound';

export function createSoundSettings(): { element: HTMLElement; refresh(): void } {
  const group = element('div', 'settings-group settings-sound');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', `${ID}-heading`);
  const heading = element('p', 'settings-heading', 'Sound');
  heading.id = `${ID}-heading`;
  const current = () => soundSettings() ?? DEFAULT_SOUND;

  const toggle = createSwitch('Sound effects', () => {
    const now = current();
    setSoundSettings({ ...now, on: !now.on });
    refresh();
    cue('tap');
  });
  // The switch makes its own tap, after it turns sound on, so turning it on is heard.
  toggle.dataset['soundOwn'] = '';

  const volume = element('input', 'settings-volume');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '100';
  volume.step = '5';
  volume.setAttribute('aria-label', 'Volume');
  volume.addEventListener('input', () => {
    setSoundSettings({ on: true, volume: Number(volume.value) / 100 });
    toggle.setAttribute('aria-checked', 'true');
  });
  volume.addEventListener('change', () => {
    cue('lock');
  });
  const volumeRow = element('label', 'settings-volume-row');
  volumeRow.append(element('span', 'settings-volume-text', 'Volume'), volume);

  group.append(heading, toggle, volumeRow);

  function refresh(): void {
    const { on, volume: level } = current();
    toggle.setAttribute('aria-checked', String(on));
    volume.value = String(Math.round(level * 100));
    volumeRow.toggleAttribute('data-off', !on);
  }
  refresh();
  return { element: group, refresh };
}
