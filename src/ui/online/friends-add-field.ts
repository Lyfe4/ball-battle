// The Friends tab's "Add a friend" field (ADR 0079, PR (c)): the notice's field look, its own Add
// button, and one line under it for what happened.
import { element } from '../dom.ts';

export interface AddField {
  readonly field: HTMLElement;
  readonly input: HTMLInputElement;
  readonly add: HTMLButtonElement;
  readonly said: HTMLElement;
  /** Says `text` under the field; `error` marks the field invalid too. */
  readonly say: (text: string, error?: boolean) => void;
}

export function addField(): AddField {
  const field = element('div', 'notice-field friends-add');
  const label = element('label', 'notice-field-label', 'Add a friend');
  const input = element('input', 'notice-field-input');
  input.id = 'friends-add-input';
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.autocapitalize = 'off';
  input.setAttribute('autocorrect', 'off');
  input.placeholder = 'Username or friend code';
  label.htmlFor = input.id;
  const add = element('button', 'hud-button friends-add-button', 'Add');
  add.type = 'button';
  const said = element('p', 'friends-said');
  said.setAttribute('role', 'status');
  const row = element('div', 'friends-add-row');
  row.append(input, add);
  field.append(label, row, said);
  // Enter adds, as the button does.
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add.click();
    }
  });
  const say = (text: string, error = false): void => {
    said.textContent = text;
    said.toggleAttribute('data-error', error);
    input.setAttribute('aria-invalid', String(error));
  };
  return { field, input, add, said, say };
}
