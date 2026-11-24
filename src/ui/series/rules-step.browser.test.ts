// The setup's Play row (ADR 0085): only where play by turns is offered (the vs Friend setup in a
// build with VITE_TURNS), Live by default; By turns says what it asks, its button goes on to the
// lineup, and the choice reaches the setup's host.
import { describe, expect, it } from 'vitest';
import '../../style.css';
import { createRulesStep, type SetupChoices } from './rules-step.ts';

function setup(turns: boolean) {
  const changed: SetupChoices[] = [];
  const next: SetupChoices[] = [];
  const step = createRulesStep(
    {
      title: 'vs Friend',
      formats: ['reveal', 'showdown'],
      levels: false,
      note: 'Live: you both stay until the end.',
      next: 'Send challenge',
      ...(turns ? { turns: { label: 'By turns', note: 'Pick your lineup now.' } } : {}),
    },
    {
      onBack: () => undefined,
      onChange: (choices) => changed.push(choices),
      onNext: (choices) => next.push(choices),
    },
  );
  document.body.replaceChildren(step.element);
  step.open({ format: 'reveal', bestOf: 3, level: '' });
  const pace = step.element.querySelector<HTMLElement>('.rules-pace');
  const button = (text: string) =>
    [...step.element.querySelectorAll<HTMLButtonElement>('button')].find(
      (one) => one.textContent === text,
    );
  const note = () => step.element.querySelector('.rules-note')?.textContent;
  return { pace, button, note, changed, next };
}

describe('the Play row: live or by turns', () => {
  it('is not there where play by turns is not offered', () => {
    const { pace, button, note } = setup(false);
    expect(pace?.hidden).toBe(true);
    expect(button('By turns')).toBeUndefined();
    expect(note()).toBe('Live: you both stay until the end.');
  });

  it('starts live; by turns says what it asks, goes on to the lineup, and is handed on', () => {
    const { pace, button, note, changed, next } = setup(true);
    expect(pace?.hidden).toBe(false);
    expect(button('Live')?.getAttribute('aria-pressed')).toBe('true');
    expect(button('Send challenge')).toBeDefined();
    button('By turns')?.click();
    expect(button('By turns')?.getAttribute('aria-pressed')).toBe('true');
    expect(note()).toBe('Pick your lineup now.');
    expect(changed.at(-1)?.turns).toBe(true);
    button('Choose lineup')?.click();
    expect(next).toStrictEqual([{ format: 'reveal', bestOf: 3, level: '', turns: true }]);
    button('Live')?.click();
    expect(note()).toBe('Live: you both stay until the end.');
    expect(button('Send challenge')).toBeDefined();
  });
});
