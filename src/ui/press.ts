// A tap shows on the control it presses (playtest, 2026-11-19): a mouse lights a control by hovering
// it, but a finger gave no sign at all. iOS Safari applies `:active` only under a touchstart
// listener, and a tap is over in under 100 ms, sooner than a press transition even shows; a touch
// `:hover` sticks after the tap. So the control under a finger is marked `data-pressed`, and each
// control's stylesheet gives that mark the look of its hover (press.test.ts checks every one). It is
// installed once by main.ts and found by delegation, so a screen never wires it.
//
// The mark waits PRESS_DELAY_MS, so a finger that starts a scroll over a button doesn't light it,
// shows for at least PRESS_SHOWN_MS, so a quick tap is seen, and always goes: at the end of the
// press, or at once when the browser takes the touch for a scroll (pointercancel). A mouse keeps its
// own hover and `:active`.

/** What a finger presses: the controls of every screen. */
export const PRESSABLE = 'button, a[href], summary, [role="button"], [role="switch"], [role="tab"]';
/** A finger resting this long on a control lights it (a quick tap lights it as it lifts). */
export const PRESS_DELAY_MS = 50;
/** A lit control stays lit at least this long, so the quickest tap is seen. */
export const PRESS_SHOWN_MS = 200;

/** The control a press at `target` lights, or none (disabled, busy, or not a control). */
export function pressableAt(target: EventTarget | null): HTMLElement | undefined {
  if (!(target instanceof Element)) return undefined;
  const control = target.closest<HTMLElement>(PRESSABLE);
  if (control === null) return undefined;
  if (control instanceof HTMLButtonElement && control.disabled) return undefined;
  if (control.getAttribute('aria-disabled') === 'true') return undefined;
  return control;
}

export function installPressFeedback(doc: Document = document): void {
  let pressed: HTMLElement | undefined;
  let litAt = 0;
  let lighting: number | undefined;
  let clearing: number | undefined;

  function stopTimers(): void {
    if (lighting !== undefined) window.clearTimeout(lighting);
    if (clearing !== undefined) window.clearTimeout(clearing);
    lighting = undefined;
    clearing = undefined;
  }

  function light(): void {
    lighting = undefined;
    if (pressed === undefined || pressed.hasAttribute('data-pressed')) return;
    pressed.setAttribute('data-pressed', '');
    litAt = performance.now();
  }

  function unlight(): void {
    stopTimers();
    pressed?.removeAttribute('data-pressed');
    pressed = undefined;
  }

  doc.addEventListener(
    'pointerdown',
    (event) => {
      unlight();
      if (event.pointerType === 'mouse' || !event.isPrimary) return;
      pressed = pressableAt(event.target);
      if (pressed !== undefined) lighting = window.setTimeout(light, PRESS_DELAY_MS);
    },
    { capture: true, passive: true },
  );
  doc.addEventListener(
    'pointerup',
    (event) => {
      if (pressed === undefined || !event.isPrimary) return;
      if (lighting !== undefined) {
        window.clearTimeout(lighting);
        light();
      }
      const left = PRESS_SHOWN_MS - (performance.now() - litAt);
      clearing = window.setTimeout(unlight, Math.max(0, left));
    },
    { capture: true, passive: true },
  );
  // The browser took the touch for a scroll or a gesture: nothing was pressed.
  doc.addEventListener('pointercancel', unlight, { capture: true, passive: true });
  // iOS Safari applies `:active` (the press-down of a slab button) only under a touchstart listener.
  doc.addEventListener('touchstart', () => undefined, { capture: true, passive: true });
}
