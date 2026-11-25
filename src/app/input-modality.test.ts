import { describe, expect, it } from 'vitest';
import {
  installInputModality,
  isKeyboardUse,
  keyboardFocused,
  typesText,
  type ModalityDocument,
  type ModalityEvent,
} from './input-modality.ts';

/** A page whose events the test sends, capture listeners only (as installed). */
function fakeDocument() {
  const listeners = new Map<string, ((event: ModalityEvent) => void)[]>();
  const doc: ModalityDocument = {
    documentElement: { dataset: {} },
    addEventListener: (type, listener, options) => {
      expect(options.capture).toBe(true);
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
  };
  const send = (type: 'pointerdown' | 'keydown', event: Partial<ModalityEvent> = {}) => {
    for (const listener of listeners.get(type) ?? []) listener({ target: null, ...event });
  };
  return { doc, send, input: () => doc.documentElement.dataset['input'] };
}

const field = { tagName: 'INPUT', type: 'email' };
const button = { tagName: 'BUTTON' };

describe('the input modality flag', () => {
  it('starts as a pointer, so nothing focused on arrival rings', () => {
    const { doc, input } = fakeDocument();
    installInputModality(doc);
    expect(input()).toBe('pointer');
  });

  it('follows the last press or key', () => {
    const { doc, send, input } = fakeDocument();
    installInputModality(doc);
    send('keydown', { key: 'Tab', target: button });
    expect(input()).toBe('key');
    send('pointerdown');
    expect(input()).toBe('pointer');
    send('keydown', { key: 'Enter', target: button });
    expect(input()).toBe('key');
  });

  it('ignores a modifier alone, a shortcut, and letters typed into a field', () => {
    expect(isKeyboardUse({ key: 'Shift', target: button }, typesText)).toBe(false);
    expect(isKeyboardUse({ key: 'c', metaKey: true, target: button }, typesText)).toBe(false);
    expect(isKeyboardUse({ key: 'a', target: field }, typesText)).toBe(false);
    expect(isKeyboardUse({ key: 'é', target: { isContentEditable: true } }, typesText)).toBe(false);
    // Moving on from a field, or acting in one, is the keyboard's.
    expect(isKeyboardUse({ key: 'Tab', target: field }, typesText)).toBe(true);
    expect(isKeyboardUse({ key: 'Enter', target: field }, typesText)).toBe(true);
    // A letter on a button (a shortcut a page might give) is keyboard use.
    expect(isKeyboardUse({ key: ' ', target: button }, typesText)).toBe(true);
    expect(isKeyboardUse({ key: 'Unidentified', target: field }, typesText)).toBe(true);
  });

  it('tells a field that takes typing from one that does not', () => {
    expect(typesText(field)).toBe(true);
    expect(typesText({ tagName: 'INPUT' })).toBe(true);
    expect(typesText({ tagName: 'TEXTAREA' })).toBe(true);
    expect(typesText({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(typesText({ tagName: 'INPUT', type: 'range' })).toBe(false);
    expect(typesText(button)).toBe(false);
    expect(typesText(null)).toBe(false);
  });

  it('counts focus as the keyboard’s only when no press came last', () => {
    const ringed = { matches: (selector: string) => selector === ':focus-visible' };
    const dataset: Record<string, string | undefined> = { input: 'pointer' };
    const doc = { documentElement: { dataset } };
    expect(keyboardFocused(ringed, doc)).toBe(false);
    dataset['input'] = 'key';
    expect(keyboardFocused(ringed, doc)).toBe(true);
    expect(keyboardFocused({ matches: () => false }, doc)).toBe(false);
  });
});
