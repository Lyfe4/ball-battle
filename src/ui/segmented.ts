import { element } from './dom.ts';

export interface SegmentOption<T> {
  readonly value: T;
  /** Visible text. */
  readonly text: string;
  /** Accessible name, when the visible text is terse (e.g. "2×"). */
  readonly label?: string;
}

export interface Segmented<T> {
  /** Marks `value` as the current choice without calling back. */
  select(value: T): void;
}

/**
 * A labelled group of buttons, one pressed (aria-pressed): the speed toggle and the mode choice.
 * It only reports a choice; the caller applies it.
 */
export function createSegmented<T>(
  root: HTMLElement,
  id: string,
  label: string,
  options: readonly SegmentOption<T>[],
  initial: T,
  onChange: (value: T) => void,
): Segmented<T> {
  root.replaceChildren();
  root.classList.add('segmented');
  root.setAttribute('role', 'group');
  const labelId = `${id}-label`;
  root.setAttribute('aria-labelledby', labelId);
  const caption = element('span', 'segmented-label', label);
  caption.id = labelId;
  root.append(caption);

  const buttons = options.map((option) => {
    const button = element('button', 'segmented-button', option.text);
    button.type = 'button';
    if (option.label !== undefined) button.setAttribute('aria-label', option.label);
    button.addEventListener('click', () => {
      select(option.value);
      onChange(option.value);
    });
    root.append(button);
    return { value: option.value, button };
  });

  function select(current: T): void {
    for (const { value, button } of buttons) {
      button.setAttribute('aria-pressed', String(value === current));
    }
  }
  select(initial);
  return { select };
}
