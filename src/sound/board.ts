// The sound board (dev only, /sounds.html, like the style guide: not in the production build, ADR
// 0064): every sound on a button, each ball's own in turn, and the busiest fights of the roster
// played as sound alone through the same gate a fight uses, at 1x and 2x, so the mix can be judged
// by ear on a phone without waiting for each moment in a match.
import './board.css';
import '../ui/button.css';
import '../ui/settings-menu.css';
import '../ui/settings-sound.css';
import { browserStorage } from '../app/storage.ts';
import { element } from '../ui/dom.ts';
import { createSoundSettings } from '../ui/settings-sound.ts';
import { BALLS, BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { step } from '../sim/step.ts';
import { createWorld } from '../sim/world.ts';
import { BALL_SOUNDS } from './ball-sounds.ts';
import { cuesOf } from './cues.ts';
import { boardCues, boardPlay, hearBall, installSound } from './sound.ts';
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
    'Tap anything; the first tap starts audio. On an iPhone the silent switch mutes it.',
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
for (const ball of BALLS) {
  const sounds = BALL_SOUNDS[ball.id] ?? [];
  section(ball.name, [
    ...sounds.map((name) => [name, one(name)] as const),
    ...(sounds.length > 1
      ? [
          [
            'In turn',
            () => {
              hearBall(ball.id);
            },
          ] as const,
        ]
      : []),
  ]);
}
/** A whole fight as sound alone: every cue through the fight's gate, on its real time at `speed`. */
const fight = (a: string, b: string, seed: number, speed: number) => () => {
  let world = createWorld(seed, [getDefinition(BALL_LOOKUP, a), getDefinition(BALL_LOOKUP, b)]);
  const start = performance.now() + 100;
  while (world.match.status === 'running') {
    const result = step(world, BALL_LOOKUP);
    const cues = cuesOf(result.events, world, result.world);
    const at = Math.floor(result.world.tick / speed) * (1000 / 60);
    if (cues.length > 0) {
      window.setTimeout(
        () => {
          boardCues(cues);
        },
        start + at - performance.now(),
      );
    }
    world = result.world;
  }
};
section('Busiest fights (measured, scripts/sound-density.ts)', [
  ['Quake vs Boomerang 1x', fight('quake', 'boomerang', 1, 1)],
  ['Quake vs Boomerang 2x', fight('quake', 'boomerang', 1, 2)],
  ['Venom vs Quake 2x', fight('venom', 'quake', 1, 2)],
  ['Inferno vs Spartan 1x', fight('inferno', 'spartan', 1, 1)],
  ['Spider vs Archer 2x', fight('spider', 'archer', 1, 2)],
  ['Storm vs Venom 2x', fight('storm', 'venom', 1, 2)],
]);
section('Series', [
  ['Series won', one('seriesWin')],
  ['Series lost', one('seriesLoss')],
]);
const back = element('a', 'text-link', 'Back to the game');
back.setAttribute('href', '/');
board.append(element('p', 'board-note', ''), back);
