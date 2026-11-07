// Settings (ADR 0040): one small menu behind a gear that sits beside every `?` and at the top of
// every screen. There is one panel on the page, opened by whichever gear was pressed, so it looks
// the same everywhere. It floats over the page (never pushing the layout), placed by its gear and
// kept inside the visible screen. The gear toggles it; Close, Escape and a tap outside close it,
// and focus returns to the gear. Everything in it is saved per device by the code it calls.
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '../app/speed.ts';
import type { Tips } from '../app/tips.ts';
import { element } from './dom.ts';
import { createSegmented, type Segmented } from './segmented.ts';
import { placeMenu, type Insets } from './settings-place.ts';

/** What the menu reads and changes, set once by main.ts. */
export interface SettingsHost {
  readonly tips: Tips;
  readonly speed: () => PlaybackSpeed;
  /** The in-fight speed buttons and this menu show the same remembered choice. */
  readonly setSpeed: (speed: PlaybackSpeed) => void;
}

const PANEL_ID = 'settings-panel';
const SVG = 'http://www.w3.org/2000/svg';

/** A chunky eight-tooth gear with a round hole, drawn as a path so it is the same on every device. */
const GEAR =
  'M10.17 4.62L10.28 1.64L13.72 1.64L13.83 4.62L15.92 5.49L18.1 3.46L20.54 5.9L18.51 8.08' +
  'L19.38 10.17L22.36 10.28L22.36 13.72L19.38 13.83L18.51 15.92L20.54 18.1L18.1 20.54' +
  'L15.92 18.51L13.83 19.38L13.72 22.36L10.28 22.36L10.17 19.38L8.08 18.51L5.9 20.54L3.46 18.1' +
  'L5.49 15.92L4.62 13.83L1.64 13.72L1.64 10.28L4.62 10.17L5.49 8.08L3.46 5.9L5.9 3.46L8.08 5.49Z' +
  'M12 8.6a3.4 3.4 0 1 0 0 6.8a3.4 3.4 0 1 0 0-6.8Z';

function gearIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'settings-gear');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', GEAR);
  path.setAttribute('fill-rule', 'evenodd');
  svg.append(path);
  return svg;
}

let host: SettingsHost | undefined;
let menu: Menu | undefined;

/** Called once by main.ts, before any gear can be pressed. */
export function installSettings(next: SettingsHost): void {
  host = next;
}

interface Menu {
  readonly panel: HTMLElement;
  /** A hidden box on the safe-area insets, measured to place the panel. */
  readonly probe: HTMLElement;
  /** The gear the panel is open for, if it is open. */
  opener: HTMLButtonElement | undefined;
  readonly render: () => void;
}

/** A switch: its words, and a pill that shows on or off (role=switch, aria-checked). */
function createSwitch(text: string, onToggle: () => void): HTMLButtonElement {
  const toggle = element('button', 'settings-switch');
  toggle.type = 'button';
  toggle.setAttribute('role', 'switch');
  const track = element('span', 'settings-switch-track');
  track.setAttribute('aria-hidden', 'true');
  track.append(element('span', 'settings-switch-thumb'));
  toggle.append(element('span', 'settings-switch-text', text), track);
  toggle.addEventListener('click', onToggle);
  return toggle;
}

function buildMenu(): Menu {
  const panel = element('section', 'settings-panel');
  panel.id = PANEL_ID;
  panel.setAttribute('aria-labelledby', `${PANEL_ID}-title`);
  panel.hidden = true;
  const title = element('h2', 'settings-title', 'Settings');
  title.id = `${PANEL_ID}-title`;

  const speedRow = element('div', 'settings-speed');
  let speed: Segmented<PlaybackSpeed> | undefined;
  const hints = createSwitch('Ability hints', () => {
    host?.tips.setEnabled(!host.tips.enabled());
    render();
  });
  const cards = createSwitch('What to watch cards', () => {
    host?.tips.setReadyCards(!host.tips.readyCards());
    render();
  });
  const again = element('button', 'text-link settings-again', 'Show all tips again');
  again.type = 'button';
  again.addEventListener('click', () => {
    host?.tips.reset();
    render();
    again.textContent = 'All tips will show again';
  });
  const tipsGroup = element('div', 'settings-group');
  tipsGroup.setAttribute('role', 'group');
  tipsGroup.setAttribute('aria-labelledby', `${PANEL_ID}-tips`);
  const tipsHeading = element('p', 'settings-heading', 'Tips in the arena');
  tipsHeading.id = `${PANEL_ID}-tips`;
  tipsGroup.append(tipsHeading, hints, cards);

  const close = element('button', 'text-link settings-close', 'Close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close settings');
  close.addEventListener('click', () => {
    closeMenu(true);
  });
  const foot = element('div', 'settings-foot');
  foot.append(again, close);
  panel.append(title, speedRow, tipsGroup, foot);

  function render(): void {
    if (host === undefined) return;
    speed ??= createSegmented(
      speedRow,
      'settings-speed',
      'Speed',
      PLAYBACK_SPEEDS.map((value) => ({
        value,
        text: `${String(value)}×`,
        label: `${String(value)} times speed`,
      })),
      host.speed(),
      (value) => host?.setSpeed(value),
    );
    speed.select(host.speed());
    hints.setAttribute('aria-checked', String(host.tips.enabled()));
    cards.setAttribute('aria-checked', String(host.tips.readyCards()));
  }
  const probe = element('div', 'settings-safe-probe');
  probe.setAttribute('aria-hidden', 'true');
  document.body.append(probe);
  return { panel, probe, opener: undefined, render };
}

/** The safe-area insets, read from a fixed probe whose edges sit on them (settings-menu.css). */
function safeInsets(probe: HTMLElement): Insets {
  const box = probe.getBoundingClientRect();
  return {
    top: box.top,
    left: box.left,
    right: window.innerWidth - box.right,
    bottom: window.innerHeight - box.bottom,
  };
}

/** Puts the open panel by its gear, inside the visible screen. */
function place(): void {
  if (menu?.opener === undefined) return;
  const view = window.visualViewport;
  const { panel, probe } = menu;
  const spot = placeMenu(
    menu.opener.getBoundingClientRect(),
    { width: panel.offsetWidth, height: panel.offsetHeight },
    {
      width: document.documentElement.clientWidth,
      height: view?.height ?? window.innerHeight,
      top: view?.offsetTop ?? 0,
    },
    safeInsets(probe),
  );
  panel.style.left = `${String(spot.left)}px`;
  panel.style.top = `${String(spot.top)}px`;
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMenu(true);
}

/** A press anywhere but the panel and its gear closes it, without taking the press away. */
function onPointer(event: PointerEvent): void {
  const target = event.target;
  if (!(target instanceof Node) || menu === undefined) return;
  if (menu.panel.contains(target) || menu.opener?.contains(target) === true) return;
  closeMenu(false);
}

function closeMenu(refocus: boolean): void {
  const opener = menu?.opener;
  if (menu === undefined || opener === undefined) return;
  menu.panel.hidden = true;
  menu.opener = undefined;
  opener.setAttribute('aria-expanded', 'false');
  document.removeEventListener('keydown', onKey);
  document.removeEventListener('pointerdown', onPointer, true);
  window.removeEventListener('resize', place);
  window.removeEventListener('scroll', place, true);
  window.visualViewport?.removeEventListener('resize', place);
  if (refocus) opener.focus();
}

function openMenu(gear: HTMLButtonElement): void {
  menu ??= buildMenu();
  if (menu.opener !== undefined) closeMenu(false);
  menu.opener = gear;
  // Right after its gear, so Tab goes from the gear into the menu.
  gear.after(menu.panel);
  menu.render();
  menu.panel.hidden = false;
  gear.setAttribute('aria-expanded', 'true');
  place();
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onPointer, true);
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);
  window.visualViewport?.addEventListener('resize', place);
}

/** A gear that opens the page's one settings menu (and closes it when it is open for this gear). */
export function createSettingsToggle(): HTMLButtonElement {
  const gear = element('button', 'settings-toggle');
  gear.type = 'button';
  gear.setAttribute('aria-label', 'Settings');
  gear.setAttribute('aria-expanded', 'false');
  gear.setAttribute('aria-controls', PANEL_ID);
  gear.append(gearIcon());
  gear.addEventListener('click', () => {
    if (menu?.opener === gear) closeMenu(false);
    else openMenu(gear);
  });
  return gear;
}

/** Shows the in-fight speed's change in an open menu. */
export function refreshSettings(): void {
  if (menu?.opener !== undefined) menu.render();
}
