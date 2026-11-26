// Settings (ADR 0040, 0044): one small menu behind a gear that sits beside every `?` and at the top
// of every screen. There is one panel on the page, opened by whichever gear was pressed, so it
// looks the same everywhere (and like the legend: the shared info panel). It floats over the page
// (never pushing the layout), placed under its gear with its right edge on the gear's row, kept off
// a fight's court where it can and inside the visible screen. One form everywhere (ADR 0081
// addendum of 2026-11-24): the same width, headings, rows and spacing on every screen; when
// nothing keeps it off the court it covers it, and the match waits (`settingsCoverCourt`). A live
// match can't wait (it plays on the server's clock, ADR 0053), so there it never covers the court:
// it takes the room beside it and scrolls inside itself (ADR 0054). The gear toggles it; Close,
// Escape and a tap outside close it, and focus returns to the gear. Everything in it is saved per
// device by the code it calls.
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '../app/speed.ts';
import type { Tips } from '../app/tips.ts';
import { createCloseButton } from './close-button.ts';
import { element } from './dom.ts';
import { createSegmented, type Segmented } from './segmented.ts';
import type { Box } from './tooltip-place.ts';
import { menuMaxHeight, placeClear, placeMenu, type Insets } from './settings-place.ts';

/** What the menu reads and changes, set once by main.ts. */
export interface SettingsHost {
  readonly tips: Tips;
  readonly speed: () => PlaybackSpeed;
  /** The in-fight speed buttons and this menu show the same remembered choice. */
  readonly setSpeed: (speed: PlaybackSpeed) => void;
  /** A match's court on screen, if one shows (not home's demo): the menu keeps off it (ADR 0044). */
  readonly court: () => Box | undefined;
  /**
   * Whether the match on screen may wait while the menu covers its court (ADR 0044). False for a
   * live match, which plays on the server's clock: the menu then never covers the court (ADR 0054).
   */
  readonly mayWait: () => boolean;
  /** The sound group (settings-sound.ts): on or off, and a volume. */
  readonly sound?: { readonly element: HTMLElement; refresh(): void };
  /** Online play's group ("Forget me"), in builds that have it (ADR 0052). */
  readonly online?: { readonly element: HTMLElement; refresh(): void };
}

const PANEL_ID = 'settings-panel';

/** The pages About opens (ADR 0069): the privacy policy and the terms. */
export const ABOUT_LINKS = [
  { text: 'Privacy', href: '/privacy.html' },
  { text: 'Terms', href: '/terms.html' },
] as const;
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
export function createSwitch(text: string, onToggle: () => void): HTMLButtonElement {
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
  const title = element('h2', 'info-panel-title settings-title', 'Settings');
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
  const again = element('button', 'hud-button settings-again', 'Show all tips again');
  again.type = 'button';
  again.addEventListener('click', () => {
    host?.tips.reset();
    render();
    again.textContent = 'All tips will show again';
  });
  const tipsGroup = element('div', 'settings-group');
  tipsGroup.setAttribute('role', 'group');
  tipsGroup.setAttribute('aria-labelledby', `${PANEL_ID}-tips`);
  const tipsHeading = element('p', 'settings-heading', 'Tips');
  tipsHeading.id = `${PANEL_ID}-tips`;
  tipsGroup.append(tipsHeading, hints, cards);
  // Two groups under their headings (ADR 0079 addendum of 2026-11-22): how fights play, and tips.
  const playGroup = element('div', 'settings-group settings-play');
  playGroup.setAttribute('role', 'group');
  playGroup.setAttribute('aria-labelledby', `${PANEL_ID}-play`);
  const playHeading = element('p', 'settings-heading', 'Fights');
  playHeading.id = `${PANEL_ID}-play`;
  playGroup.append(playHeading, speedRow);

  const paused = element('p', 'settings-paused', 'The match waits');
  paused.hidden = true;
  // The one close, last in the head (ADR 0086): the menu still fits whole above its gear on a phone
  // mid-fight (390 x 664), as its target reaches into the padding and the head keeps its height.
  const close = createCloseButton(() => {
    closeMenu(true);
  });
  close.classList.add('settings-close');
  const foot = element('div', 'settings-foot');
  foot.append(again);
  // About, last (ADR 0069 addendum of 2026-11-26): the privacy policy and terms one tap from every
  // screen, each in a tab of its own so nothing here is left (a fight, a live match's clock).
  const about = element('p', 'settings-about');
  about.append(element('span', 'settings-about-label', 'About'));
  for (const { text, href } of ABOUT_LINKS) {
    const link = element('a', 'text-link', text);
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    about.append(link);
  }
  // In the foot, under Show all tips again with no gap of its own (its links' 44 px rows are the
  // room), so the menu still fits whole above its gear on a phone mid-fight (390 x 664).
  foot.append(about);
  // The note that the match waits shares the title's row, so every row sits where it does on any
  // other screen, and it shows even when the menu scrolls inside itself.
  const top = element('div', 'info-panel-head settings-top');
  top.append(title, paused, close);
  panel.append(top, playGroup, tipsGroup, foot);
  if (host?.sound !== undefined) speedRow.after(host.sound.element);
  if (host?.online !== undefined) foot.before(host.online.element);

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
    host.sound?.refresh();
    host.online?.refresh();
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
 * Puts the open panel by its gear, inside the visible screen and off a match's court where it can
 * (ADR 0044), always in its one form: over the court only when no place keeps off it, saying the
 * match waits, or beside it, scrolling, for a live match that can't.
 */
function place(): void {
  if (menu?.opener === undefined) return;
  const view = window.visualViewport;
  const { panel, probe, opener, paused } = menu;
  // Measuring lifts the cap for a moment, which scrolls the menu to its top: kept where it was.
  const scrolled = panel.scrollTop;
  const gear = opener.getBoundingClientRect();
  // Its right edge on the gear's row's (a header with a ? after the gear included), so the menu
  // sits at the same place across the screen wherever the gear is in its row.
  const row = opener.parentElement?.getBoundingClientRect() ?? gear;
  const anchor = {
    left: row.right - gear.width,
    top: gear.top,
    width: gear.width,
    height: gear.height,
  };
  const insets = safeInsets(probe);
  const court = host?.court();
  const screen = {
    width: document.documentElement.clientWidth,
    height: view?.height ?? window.innerHeight,
    top: view?.offsetTop ?? 0,
  };
  panel.style.maxHeight = `${String(menuMaxHeight(screen, insets))}px`;
  paused.hidden = true;
  const size = () => ({ width: panel.offsetWidth, height: panel.offsetHeight });
  let spot = placeMenu(anchor, size(), screen, insets, court);
  if (spot.covers) {
    // Over the court: the note that the match waits shows, at the end of the menu.
    paused.hidden = false;
    spot = placeMenu(anchor, size(), screen, insets, court);
  }
  if (spot.covers && court !== undefined && !(host?.mayWait() ?? true)) {
    // A live match: beside the court, scrolling inside itself if it must.
    paused.hidden = true;
    const clear = placeClear(anchor, size(), screen, court, insets);
    panel.style.maxHeight = `${String(clear.maxHeight)}px`;
    spot = { left: clear.left, top: clear.top, covers: false };
  } else if (spot.maxHeight !== undefined) {
    panel.style.maxHeight = `${String(spot.maxHeight)}px`;
  }
  menu.covers = spot.covers;
  paused.hidden = !spot.covers;
  // Whole pixels: its rows sit the same way on every screen, and its text stays crisp.
  panel.style.left = `${String(Math.round(spot.left))}px`;
  panel.style.top = `${String(Math.round(spot.top))}px`;
  panel.scrollTop = scrolled;
}

/**
 * The page, or a box holding the gear, scrolled: the menu follows its gear. Its own scroll is left
 * alone: re-placing lifts its cap for a moment, which put a scrolled menu back at the top.
 */
function onScroll(event: Event): void {
  if (event.target instanceof Node && menu?.panel.contains(event.target) === true) return;
  place();
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
  window.removeEventListener('scroll', onScroll, true);
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
  window.addEventListener('scroll', onScroll, true);
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
