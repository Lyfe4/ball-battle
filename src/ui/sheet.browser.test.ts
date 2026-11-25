// The sheet (sheet.ts, ADR 0086, 0087) as a component: its head (the title, the × last, one tap target
// tall), focus to the title on open and back to what opened it on close, a tap outside and Escape
// closing it, and the confirm step: what the action does, the action in the danger look and Cancel,
// which has focus; Cancel or any close answers no and brings the content back.
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createSheet, type Sheet } from './sheet.ts';

let sheet: Sheet | undefined;
let opener: HTMLButtonElement | undefined;

function mount(): Sheet {
  opener = document.createElement('button');
  opener.textContent = 'Open';
  document.body.append(opener);
  const made = createSheet({ id: 'test-sheet-title', title: 'A friend' });
  made.content.append(Object.assign(document.createElement('p'), { textContent: 'Rows' }));
  document.body.append(made.element);
  opener.focus();
  sheet = made;
  return made;
}

afterEach(() => {
  sheet?.close();
  sheet?.element.remove();
  opener?.remove();
});

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

describe('the sheet', () => {
  it('opens on its title, its × last in a head one tap target tall, and gives focus back', () => {
    const made = mount();
    made.open();
    expect(made.isOpen()).toBe(true);
    expect(document.activeElement).toBe(made.title);
    expect(made.element.getAttribute('aria-labelledby')).toBe('test-sheet-title');
    const head = made.title.parentElement;
    expect(head?.lastElementChild?.getAttribute('aria-label')).toBe('Close');
    expect(head?.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    (head?.lastElementChild as HTMLButtonElement).click();
    expect(made.isOpen()).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('closes on Escape and on a tap outside', async () => {
    const made = mount();
    made.open();
    await userEvent.keyboard('{Escape}');
    await frame();
    expect(made.isOpen()).toBe(false);
    made.open();
    made.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(made.isOpen()).toBe(false);
  });

  it('confirms a destructive action, Cancel the default', async () => {
    const made = mount();
    made.open();
    const asked = made.confirm({
      title: 'Remove Sam?',
      text: 'You stop being friends. Sam is not told.',
      action: 'Remove',
    });
    expect(made.title.textContent).toBe('Remove Sam?');
    expect(made.content.hidden).toBe(true);
    const cancel = document.activeElement as HTMLButtonElement;
    expect(cancel.textContent).toBe('Cancel');
    const action = made.element.querySelector('.danger-button');
    expect(action?.textContent).toBe('Remove');
    expect(made.element.textContent).toContain('You stop being friends.');
    // Enter right away presses Cancel: nothing destructive happens by default.
    await userEvent.keyboard('{Enter}');
    expect(await asked).toBe(false);
    expect(made.title.textContent).toBe('A friend');
    expect(made.content.hidden).toBe(false);
    expect(made.isOpen()).toBe(true);

    const yes = made.confirm({ title: 'Block Sam?', text: 'Sam can’t find you.', action: 'Block' });
    made.element.querySelector<HTMLButtonElement>('.danger-button')?.click();
    expect(await yes).toBe(true);

    const closed = made.confirm({
      title: 'Block Sam?',
      text: 'Sam can’t find you.',
      action: 'Block',
    });
    made.close();
    expect(await closed).toBe(false);
  });
});
