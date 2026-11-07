// Rendered-look checks for parts that must look the same wherever they appear (ADR 0038, 0044).
// Structure alone isn't enough: a context rule (a `.series[data-phase]` override, a desktop query)
// can restyle the same markup, so these compare computed styles.
import { expect } from 'vitest';

type Look = Readonly<Record<string, string>>;

function styleOf(node: Element | null | undefined, keys: readonly string[]): Look {
  if (node === null || node === undefined) return { missing: 'true' };
  const style = getComputedStyle(node);
  return Object.fromEntries(keys.map((key) => [key, style.getPropertyValue(key)]));
}

const BOX = [
  'background-color',
  'border-top-left-radius',
  'border-bottom-right-radius',
  'padding-top',
  'padding-left',
] as const;
const TYPE = ['color', 'font-size', 'font-weight', 'font-family'] as const;

/** "How it was won", closed: its card, the summary's padding and each part of its line. */
function storyLook(story: Element): Look {
  const part = (selector: string, keys: readonly string[]) => {
    const look = styleOf(story.querySelector(selector), keys);
    return Object.fromEntries(
      Object.entries(look).map(([key, value]) => [`${selector} ${key}`, value]),
    );
  };
  return {
    ...styleOf(story, [...BOX, 'font-size']),
    ...part('.match-story-summary', ['padding-top', 'padding-left', 'min-height']),
    ...part('.match-story-result', TYPE),
    ...part('.match-story-label', TYPE),
    ...part('.match-story-more', TYPE),
  };
}

/**
 * The story's own look, from a copy placed straight in the page (no screen's context around it):
 * any screen that restyles it differs from this.
 */
function referenceStoryLook(): Look {
  const story = document.createElement('details');
  story.className = 'match-story';
  story.innerHTML =
    '<summary class="match-story-summary"><span class="match-story-line">' +
    '<span class="match-story-label">Round 1: </span><span class="match-story-result">A</span>' +
    '</span><span class="match-story-more">How it was won</span></summary>';
  document.body.append(story);
  const look = storyLook(story);
  story.remove();
  return look;
}

/** Checks a visible, closed story looks exactly like the story's own look. */
export function checkStoryLook(where: string, story: Element): void {
  expect({ where, look: storyLook(story) }).toStrictEqual({ where, look: referenceStoryLook() });
}

/** The legend's and the settings' panel looks seen in this run: they must all be one look. */
const panelLooks = new Map<string, Look>();

/** Records an open panel's look (the legend or settings) and its Close link's. */
export function notePanelLook(where: string, panel: HTMLElement | null): void {
  const close = panel?.querySelector('.panel-close');
  const box = panel?.getBoundingClientRect();
  const closeBox = close?.getBoundingClientRect();
  const inset = Number.parseFloat(panel === null ? '0' : getComputedStyle(panel).paddingRight);
  panelLooks.set(where, {
    ...styleOf(panel, [...BOX, ...TYPE, 'box-shadow']),
    ...Object.fromEntries(
      Object.entries(styleOf(close, [...TYPE, 'min-height'])).map(([key, value]) => [
        `close ${key}`,
        value,
      ]),
    ),
    // Close sits at the panel's end, on its right padding.
    'close at the end': String(
      box !== undefined &&
        closeBox !== undefined &&
        Math.abs(box.right - inset - closeBox.right) <= 1 &&
        Math.abs(
          box.bottom -
            Number.parseFloat(getComputedStyle(panel ?? document.body).paddingBottom) -
            closeBox.bottom,
        ) <= 1,
    ),
  });
}

/** Every panel look noted matches the first. */
export function checkPanelLooks(): void {
  const [first] = [...panelLooks.values()];
  const off = [...panelLooks].filter(([, look]) => JSON.stringify(look) !== JSON.stringify(first));
  expect({ panels: panelLooks.size >= 2, off }).toStrictEqual({ panels: true, off: [] });
  panelLooks.clear();
}
