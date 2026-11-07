// Settings (ADR 0040, 0044): one small menu behind a gear that sits beside every `?` and at the top
// of every screen. There is one panel on the page, opened by whichever gear was pressed, so it
// looks the same everywhere (and like the legend: the shared info panel). It floats over the page
// (never pushing the layout), placed by its gear, kept off the court and inside the visible
// screen; on a short phone it first tries a compact form, and only when nothing keeps it off the
// court does it cover it, and the match waits (`settingsCoverCourt`). The gear toggles it; Close,
// Escape and a tap outside close it, and focus returns to the gear. Everything in it is saved per
// device by the code it calls.
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '../app/speed.ts';
import type { Tips } from '../app/tips.ts';
import { element } from './dom.ts';
import { createSegmented, type Segmented } from './segmented.ts';
import type { Box } from './tooltip-place.ts';
import { menuMaxHeight, menuWidth, placeMenu, type Insets } from './settings-place.ts';

/** What the menu reads and changes, set once by main.ts. */
export interface SettingsHost {
  readonly tips: Tips;
  readonly speed: () => PlaybackSpeed;
  /** The in-fight speed buttons and this menu show the same remembered choice. */
  readonly setSpeed: (speed: PlaybackSpeed) => void;
  /** The court on screen, if one shows: the menu keeps off it (ADR 0044). */
  readonly court: () => Box | undefined;
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
  /** True while the open panel covers the court: the match waits (ADR 0044). */
  covers: boolean;
  /** Says the match waits, shown only while the panel covers the court. */
  readonly paused: HTMLElement;
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
  const panel = element('section', 'info-panel settings-panel');
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

  const paused = element('p', 'settings-paused', 'The match waits while this is open.');
  paused.hidden = true;
  const close = element('button', 'text-link panel-close settings-close', 'Close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close settings');
  close.addEventListener('click', () => {
    closeMenu(true);
  });
  const foot = element('div', 'settings-foot');
  foot.append(again, close);
  panel.append(title, paused, speedRow, tipsGroup, foot);

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
  return { panel, probe, opener: undefined, covers: false, paused, render };
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

/**
 * Puts the open panel by its gear, inside the visible screen and off the court (ADR 0044): at its
 * own size if that keeps off the court, else in its compact form, else at its own size over the
 * court, saying the match waits.
 */
function place(): void {
  if (menu?.opener === undefined) return;
  const view = window.visualViewport;
  const { panel, probe, opener, paused } = menu;
  const gear = opener.getBoundingClientRect();
  const insets = safeInsets(probe);
  const court = host?.court();
  const screen = {
    width: document.documentElement.clientWidth,
    height: view?.height ?? window.innerHeight,
    top: view?.offsetTop ?? 0,
  };
  const at = () =>
    placeMenu(
      gear,
      { width: panel.offsetWidth, height: panel.offsetHeight },
      screen,
      insets,
      court,
    );
  panel.style.maxHeight = `${String(menuMaxHeight(screen, insets))}px`;
  panel.style.width = '';
  delete panel.dataset['compact'];
  paused.hidden = true;
  const width = menuWidth(gear, panel.offsetWidth, screen, insets, court);
  if (width !== undefined) panel.style.width = `${String(width)}px`;
  let spot = at();
  if (spot.covers) {
    panel.dataset['compact'] = '';
    spot = at();
  }
  if (spot.covers) {
    delete panel.dataset['compact'];
    paused.hidden = false;
    spot = at();
  }
  menu.covers = spot.covers;
  paused.hidden = !spot.covers;
  panel.style.left = `${String(spot.left)}px`;
  panel.style.top = `${String(spot.top)}px`;
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMenu(true);
}

/** What a press can move focus to: a press on one of these keeps its own focus. */
const FOCUSABLE = 'a[href], button, input, select, textarea, summary, label, [tabindex], canvas';

/** Keeps focus where it is through one press's mousedown (a press on nothing focusable). */
function keepFocus(event: MouseEvent): void {
  event.preventDefault();
}

/** Drops keepFocus at the next press, if the last one never sent a mousedown (a touch scroll). */
function dropKeepFocus(): void {
  document.removeEventListener('mousedown', keepFocus, true);
}

/**
 * A press anywhere but the panel and its gear closes it, without taking the press away. A press on
 * a control does what it does (and takes focus); a press on nothing focusable returns focus to the
 * gear, as Close and Escape do, rather than leaving it on the page.
 */
function onPointer(event: PointerEvent): void {
  const target = event.target;
  if (!(target instanceof Element) || menu === undefined) return;
  const opener = menu.opener;
  if (menu.panel.contains(target) || opener?.contains(target) === true) return;
  closeMenu(false);
  if (opener === undefined || target.closest(FOCUSABLE) !== null) return;
  opener.focus({ preventScroll: true });
  // A touch's mousedown comes after its touchend, so this waits for it; the next press drops it.
  document.addEventListener('mousedown', keepFocus, { capture: true, once: true });
  document.addEventListener('pointerdown', dropKeepFocus, { capture: true, once: true });
}

function closeMenu(refocus: boolean): void {
  const opener = menu?.opener;
  if (menu === undefined || opener === undefined) return;
  menu.panel.hidden = true;
  menu.opener = undefined;
  menu.covers = false;
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

/** True while the open menu covers the court: the match waits until it closes (ADR 0044). */
export function settingsCoverCourt(): boolean {
  return menu?.opener !== undefined && menu.covers;
}

/** Shows the in-fight speed's change in an open menu. */
export function refreshSettings(): void {
  if (menu?.opener !== undefined) menu.render();
}
