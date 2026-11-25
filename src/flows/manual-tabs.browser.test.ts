// The Balls / Matchup chart switch is a tab list (ADR 0087, view-tabs.ts): two tabs that each control
// their panel, the current one `aria-selected` and alone in the tab order, the arrows moving between
// them and showing the view, and neither wearing the chosen-option look (no `.choice`, no
// `aria-pressed`).
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { settle, visible } from './page-support.ts';
import { onScreen, openAs } from './shell-routes-support.ts';

const tabs = () => visible('[role="tablist"] [role="tab"]');
const selected = () =>
  tabs()
    .filter((tab) => tab.getAttribute('aria-selected') === 'true')
    .map((tab) => tab.textContent.trim());

describe('the Balls and Matchup chart tabs', () => {
  it('are a tab list, moved by the arrows, never the chosen look', async () => {
    await openAs({ online: false, accounts: false }, '?view=manual');
    await onScreen('manual');
    expect(tabs().map((tab) => tab.textContent.trim())).toStrictEqual(['Balls', 'Matchup chart']);
    expect(selected()).toStrictEqual(['Balls']);
    for (const tab of tabs()) {
      expect(tab.classList.contains('choice'), tab.textContent).toBe(false);
      expect(tab.hasAttribute('aria-pressed'), tab.textContent).toBe(false);
      const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '');
      expect(panel?.getAttribute('role'), tab.textContent).toBe('tabpanel');
      expect(panel?.getAttribute('aria-labelledby'), tab.textContent).toBe(tab.id);
    }
    expect(tabs().map((tab) => tab.tabIndex)).toStrictEqual([0, -1]);
    tabs()[0]?.focus();
    await userEvent.keyboard('{ArrowRight}');
    await settle();
    expect(selected()).toStrictEqual(['Matchup chart']);
    expect(document.activeElement?.textContent.trim()).toBe('Matchup chart');
    expect(new URLSearchParams(location.search).get('tab')).toBe('chart');
    expect(
      visible('.ball-grid').filter((grid) => grid.closest('.manual-index') !== null),
    ).toHaveLength(0);
    await userEvent.keyboard('{ArrowLeft}');
    await settle();
    expect(selected()).toStrictEqual(['Balls']);
  });
});
