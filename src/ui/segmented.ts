import { element } from './dom.ts';

export interface SegmentOption<T> {
  readonly value: T;
  /** Visible text. */
  readonly text: string;
  /** Accessible name, when the visible text is terse (e.g. "2×"). */
  readonly label?: string;
  /** A few quiet words under the text (a format's way of playing), heard after it. */
  readonly hint?: string;
  /** A short tag beside the text ("New", ADR 0090), heard after it. */
  readonly tag?: string;
}

export interface Segmented<T> {
  /** Marks `value` as the current choice without calling back. */
  select(value: T): void;
  /** Puts `tag` beside `value`'s text, or takes it away: in place, so focus stays put. */
  retag(value: T, tag: string | undefined): void;
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

  /** The button's text, its tag and its name, as `option` says with `tag`. */
  function draw(button: HTMLButtonElement, option: SegmentOption<T>, tag: string | undefined) {
    const text = button.querySelector('.segmented-text');
    text?.replaceChildren(
      option.text,
      ...(tag === undefined ? [] : [' ', element('span', 'segmented-tag', tag)]),
    );
    const words = [option.text, option.hint, tag?.toLowerCase()].filter(
      (word) => word !== undefined,
    );
    const name = option.label ?? (words.length > 1 ? words.join(', ') : undefined);
    if (name === undefined) button.removeAttribute('aria-label');
    else button.setAttribute('aria-label', name);
  }

  const buttons = options.map((option) => {
    const button = element('button', 'segmented-button choice');
    button.type = 'button';
    button.append(element('span', 'segmented-text'));
    if (option.hint !== undefined) button.append(element('span', 'segmented-hint', option.hint));
    draw(button, option, option.tag);
    button.addEventListener('click', () => {
      select(option.value);
      onChange(option.value);
    });
    root.append(button);
    return { value: option.value, button, option };
  });

  function select(current: T): void {
    for (const { value, button } of buttons) {
      button.setAttribute('aria-pressed', String(value === current));
    }
  }
  select(initial);
  return {
    select,
    retag(value, tag) {
      const found = buttons.find((one) => one.value === value);
      if (found !== undefined) draw(found.button, found.option, tag);
    },
  };
}
