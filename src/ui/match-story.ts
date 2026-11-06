// "How it was won" (ADR 0036): a closed expander under a finished match. Opened, it shows each
// ball's damage by source as one stacked bar (its ability in its colour, its contact hits paler),
// heals, and up to four key moments with their times. It is worked out only when opened, by
// replaying the match headlessly (match-story-data.ts), so nothing is computed for a player who
// never looks.
import { ballColor } from '../render/ball-colors.ts';
import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { element } from './dom.ts';
import { clockOf, storyOf, type MatchStory } from './match-story-data.ts';

export interface MatchStoryView {
  readonly element: HTMLElement;
  /** The match to tell, by its opening world; undefined hides it. Closes it for a new match. */
  show(start: WorldState | undefined): void;
}

export function createMatchStory(lookup: DefinitionLookup): MatchStoryView {
  const root = element('details', 'match-story');
  const summary = element('summary', 'match-story-summary', 'How it was won');
  const body = element('div', 'match-story-body');
  root.append(summary, body);
  root.hidden = true;
  let start: WorldState | undefined;
  let told: WorldState | undefined;

  function render(story: MatchStory): void {
    const most = Math.max(1, ...story.sides.map((side) => side.dealt));
    const rows = story.sides.map((side) => {
      const definition = lookup.get(side.definitionId);
      const color =
        definition === undefined ? 'currentColor' : ballColor(definition.color, side.repeat);
      const row = element('div', 'match-story-side');
      row.style.setProperty('--ball-color', color);
      const head = element('p', 'match-story-head');
      head.append(element('span', 'match-story-name', side.name), ` dealt ${String(side.dealt)}`);
      const bar = element('div', 'match-story-bar');
      bar.setAttribute('aria-hidden', 'true');
      for (const share of side.sources) {
        const part = element('span', 'match-story-part');
        part.dataset['ability'] = String(share.ability);
        part.style.width = `${((share.amount / most) * 100).toFixed(1)}%`;
        bar.append(part);
      }
      const words = side.sources.map((share) => `${share.label} ${String(share.amount)}`);
      if (side.healed > 0) {
        const cut = side.healsCut > 0 ? `, ${String(side.healsCut)} cut by shock` : '';
        words.push(`healed ${String(side.healed)}${cut}`);
      }
      row.append(head, bar, element('p', 'match-story-sources', words.join(' · ')));
      return row;
    });
    const moments = element('ol', 'match-story-moments');
    moments.setAttribute('aria-label', 'Key moments');
    moments.append(
      ...story.moments.map((moment) => {
        const item = element('li', '');
        item.append(element('span', 'match-story-time', clockOf(moment.tick)), ` ${moment.text}`);
        return item;
      }),
    );
    body.replaceChildren(...rows, moments);
  }

  root.addEventListener('toggle', () => {
    if (!root.open || start === undefined || told === start) return;
    told = start;
    render(storyOf(start, lookup));
  });

  return {
    element: root,
    show(next) {
      root.hidden = next === undefined;
      if (next === start) return;
      start = next;
      root.open = false;
    },
  };
}
