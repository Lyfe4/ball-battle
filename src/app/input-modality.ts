// Focus rings for the keyboard only (ADR 0086). A screen moves focus by script (Play on arrival, a
// sheet's title, the gear when settings close) so the keyboard carries on from the right place,
// but WebKit matches `:focus-visible` on script focus when nothing had keyboard focus before, and
// iOS Safari never focuses a tapped button, so after a tap an iPhone rang whatever script focused.
// So the page says how it was last used: `<html data-input="pointer">` after a press (mouse, finger
// or pen), `data-input="key"` after a key that moves or acts. Every ring rule is guarded by
// `:root:not([data-input='pointer'])` (focus-ring.test.ts), so a ring shows only for the keyboard.
// The page starts as `pointer`: no ring round what is focused on arrival until a key is pressed.

/** How the page was last used. */
export type InputKind = 'pointer' | 'key';

/** What the flag needs of the page: its root's data set and its events. */
export interface ModalityDocument {
  readonly documentElement: { readonly dataset: Record<string, string | undefined> };
  addEventListener(
    type: 'pointerdown' | 'keydown',
    listener: (event: ModalityEvent) => void,
    options: { capture: boolean },
  ): void;
}

/** What the flag reads of a key or pointer event. */
export interface ModalityEvent {
  readonly key?: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  /** Whether the event's target takes typing (a text field), from `typesText` below. */
  readonly target: unknown;
}

/** Keys that are only modifiers: pressing Shift alone is not keyboard use. */
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph', 'Fn']);

/**
 * Whether a key says the keyboard is moving or acting: not a modifier alone or a shortcut, and not
 * a character typed into a field (a phone's own keyboard sends keys too, while the finger still
 * taps everything else).
 */
export function isKeyboardUse(event: ModalityEvent, typesText: (target: unknown) => boolean) {
  const key = event.key ?? '';
  if (key === '' || MODIFIERS.has(key)) return false;
  if (event.ctrlKey === true || event.metaKey === true || event.altKey === true) return false;
  return !(key.length === 1 && typesText(event.target));
}

/** True for a field that takes typing: a text input, a text area, or editable content. */
export function typesText(target: unknown): boolean {
  if (typeof target !== 'object' || target === null) return false;
  const node = target as { tagName?: string; type?: string; isContentEditable?: boolean };
  if (node.isContentEditable === true) return true;
  if (node.tagName === 'TEXTAREA') return true;
  return (
    node.tagName === 'INPUT' &&
    !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file'].includes(
      node.type ?? 'text',
    )
  );
}

/** Starts the flag on `doc`: `pointer` until a key says otherwise. Installed once, by main.ts. */
export function installInputModality(doc: ModalityDocument): void {
  const { dataset } = doc.documentElement;
  const set = (kind: InputKind) => {
    if (dataset['input'] !== kind) dataset['input'] = kind;
  };
  set('pointer');
  doc.addEventListener(
    'pointerdown',
    () => {
      set('pointer');
    },
    { capture: true },
  );
  doc.addEventListener(
    'keydown',
    (event) => {
      if (isKeyboardUse(event, typesText)) set('key');
    },
    { capture: true },
  );
}

/** Whether focus on `target` is the keyboard's: it matches `:focus-visible` and no press came last. */
export function keyboardFocused(
  target: { matches(selector: string): boolean },
  doc: { readonly documentElement: { readonly dataset: Record<string, string | undefined> } },
): boolean {
  return doc.documentElement.dataset['input'] !== 'pointer' && target.matches(':focus-visible');
}
