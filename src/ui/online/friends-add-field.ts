// The Friends tab's "Add a friend" field (ADR 0079, PR (c)): the notice's field look, its own Add
// button, and one line under it for what happened.
import { element } from '../dom.ts';

export interface AddField {
  readonly field: HTMLElement;
  readonly input: HTMLInputElement;
  readonly add: HTMLButtonElement;
  readonly said: HTMLElement;
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
  return { field, input, add, said };
}
