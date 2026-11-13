// "How it was won" (ADR 0036, 0037): a closed expander under a finished match whose summary is the
// result in one plain line ("Titan knocked out Venom at 0:20"). Opened, it shows each ball's damage
// as one bar (its ability in its colour, its contact hits paler), the sources in words only when
// there is more than one (or a heal), and up to four key moments as plain sentences, chosen by
// what decided the round (match-story-data.ts). It is worked out by replaying the match headlessly,
// never while a round is fought: in short slices between frames from the moment the fight ends
// (`prepare`, match-story-teller.ts), so no frame pays for the whole match. The line shows once the
// replay is played.
import { ballColor } from '../render/ball-colors.ts';
import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { element, setText } from './dom.ts';
import { clockOf, sourceWords, type MatchStory } from './match-story-data.ts';
import { storyTellerFor } from './match-story-teller.ts';

export interface MatchStoryView {
  readonly element: HTMLElement;
  /**
   * The match to tell, by its opening world; undefined hides it. Closes it for a new match.
   * `label` goes before the result ("Round 1"), where several matches could be meant; `names`
   * names each slot's ball where its name alone could be unclear (storyOf).
   */
  show(start: WorldState | undefined, label?: string, names?: readonly string[]): void;
  /**
   * Starts replaying the match from `start` between frames, so its story is ready when `show`
   * asks for it. Cheap to call every frame with the same world.
   */
  prepare(start: WorldState): void;
}

export function createMatchStory(lookup: DefinitionLookup): MatchStoryView {
  const root = element('details', 'match-story');
  const summary = element('summary', 'match-story-summary');
  // The label and the result are one line of text, so a long result wraps as a sentence.
  const line = element('span', 'match-story-line');
  const label = element('span', 'match-story-label');
  const result = element('span', 'match-story-result');
  line.append(label, result);
  const more = element('span', 'match-story-more', 'How it was won');
  summary.append(line, more);
  const body = element('div', 'match-story-body');
  root.append(summary, body);
  root.hidden = true;
  let start: WorldState | undefined;
  let story: MatchStory | undefined;
  let rendered = false;
  let prepared: WorldState | undefined;
  const teller = storyTellerFor(lookup);

  function render(told: MatchStory): void {
    const most = Math.max(1, ...told.sides.map((side) => side.dealt));
    const rows = told.sides.map((side) => {
      const definition = lookup.get(side.definitionId);
      const color =
        definition === undefined ? 'currentColor' : ballColor(definition.color, side.repeat);
      const row = element('div', 'match-story-side');
      row.style.setProperty('--ball-color', color);
      const head = element('p', 'match-story-head');
      head.append(
        element('span', 'match-story-name', side.name),
        ` ${String(side.dealt)} damage`,
        element('span', 'match-story-sources', ` · ${sourceWords(side)}`),
      );
      const bar = element('div', 'match-story-bar');
      bar.setAttribute('aria-hidden', 'true');
      for (const share of side.sources) {
        const part = element('span', 'match-story-part');
        part.dataset['ability'] = String(share.ability);
        part.style.width = `${((share.amount / most) * 100).toFixed(1)}%`;
        bar.append(part);
      }
      row.append(head, bar);
      return row;
    });
    const moments = element('ol', 'match-story-moments');
    moments.setAttribute('aria-label', 'Key moments');
    moments.append(
      ...told.moments.map((moment) => {
        const item = element('li', '');
        item.dataset['kind'] = moment.kind;
        item.append(element('span', 'match-story-time', clockOf(moment.tick)), ` ${moment.text}`);
        return item;
      }),
    );
    body.replaceChildren(...rows, moments);
  }

  root.addEventListener('toggle', () => {
    if (!root.open || story === undefined || rendered) return;
    rendered = true;
    render(story);
  });

  return {
    element: root,
    show(next, prefix, names) {
      setText(label, prefix === undefined ? '' : `${prefix}: `);
      if (next === start) return;
      start = next;
      root.open = false;
      rendered = false;
      story = undefined;
      setText(result, '');
      // Hidden until its replay is played: at once when `prepare` already played it.
      root.hidden = true;
      if (next === undefined) return;
      teller.tell(next, (replay) => {
        if (start !== next) return;
        story = replay.story(names);
        setText(result, story.result);
        root.hidden = false;
      });
    },
    prepare(next) {
      if (next === prepared) return;
      prepared = next;
      teller.tell(next, () => undefined);
    },
  };
}
