// PROTOTYPE (proto/sound): every sound on a button, and the bursts a fight makes (through the same
// gate), so the style can be judged on a phone without waiting for each moment in a match.
import './board.css';
import '../ui/button.css';
import '../ui/settings-menu.css';
import '../ui/settings-sound.css';
import { browserStorage } from '../app/storage.ts';
import { element } from '../ui/dom.ts';
import { createSoundSettings } from '../ui/settings-sound.ts';
import { boardPlay, installSound } from './sound.ts';
import type { SoundName } from './voices.ts';

installSound(browserStorage);
const board = document.getElementById('board');
if (board === null) throw new Error('No board');
board.className = 'board';

function button(text: string, onPress: () => void): HTMLButtonElement {
  const press = element('button', 'hud-button', text);
  press.type = 'button';
  press.dataset['soundOwn'] = '';
  press.addEventListener('click', onPress);
  return press;
}

function section(title: string, items: readonly (readonly [string, () => void])[]): void {
  const grid = element('div', 'board-grid');
  grid.append(...items.map(([text, onPress]) => button(text, onPress)));
  board?.append(element('h2', 'board-heading', title), grid);
}

/** `count` plays of `name`, `everyMs` apart, at falling strength like a real stream. */
const burst =
  (name: SoundName, count: number, everyMs: number, strength = 0.6) =>
  () => {
    for (let i = 0; i < count; i += 1) {
      window.setTimeout(() => {
        boardPlay(name, strength - (i % 3) * 0.1);
      }, i * everyMs);
    }
  };
const one =
  (name: SoundName, strength = 1) =>
  () => {
    boardPlay(name, strength);
  };
const after = (steps: readonly (readonly [SoundName, number])[]) => () => {
  for (const [name, at] of steps)
    window.setTimeout(() => {
      boardPlay(name);
    }, at);
};

board.append(
  element('h1', 'board-title', 'Sound board'),
  element(
    'p',
    'board-note',
    'Prototype. Tap anything; the first tap starts audio. On an iPhone the silent switch mutes it.',
  ),
  createSoundSettings().element,
);
section('Countdown and coin', [
  [
    'Get ready, 3-2-1, Fight!',
    after([
      ['getReady', 0],
      ['count', 2000],
      ['count', 3000],
      ['count', 4000],
      ['fight', 5000],
    ]),
  ],
  [
    'Coin toss',
    after([
      ['coinFlip', 0],
      ['coinLand', 2000],
    ]),
  ],
  ['Button tap', one('tap')],
  ['Pick locked in', one('lock')],
]);
section('Fight', [
  ['Light bump', one('bump', 0.2)],
  ['Heavy bump', one('bump', 1)],
  ['Knockout', one('knockout')],
  ['Bump rally (2x speed)', burst('bump', 12, 45, 0.7)],
]);
section('Abilities', [
  ['Archer: shot', one('arrowFire')],
  ['Archer: arrow hits', one('arrowHit')],
  ['Archer: volley', burst('arrowHit', 10, 40)],
  ['Hex: curse', one('curse')],
  ['Hex: burst', one('curseBurst')],
  [
    'Hex: curse, 3 s, burst',
    after([
      ['curse', 0],
      ['curseBurst', 3000],
    ]),
  ],
  ['Battery: store', one('store', 0.5)],
  ['Battery: release', one('release', 1)],
  ['Slime: split', one('split')],
]);
section('Series', [
  ['Series won', one('seriesWin')],
  ['Series lost', one('seriesLoss')],
]);
const back = element('a', 'text-link', 'Back to the game');
back.setAttribute('href', '/');
board.append(element('p', 'board-note', ''), back);
