// The style guide's UI parts: every shared screen component in its states, at phone width, built
// with the game's own code and stylesheet (styleguide.html?only=ui). It plays the part a component
// catalogue would, without a new dependency.
import '../style.css';
import { BALL_LOOKUP, BALLS } from '../sim/balls/index.ts';
import { createBallGrid } from '../ui/balls/ball-grid.ts';
import { leanOf } from '../ui/balls/matchups.ts';
import { createBallDetail } from '../ui/manual/ball-detail.ts';
import { createMatchupChart } from '../ui/manual/matchup-chart.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { recordOutcome, recordPick, startSeries } from '../sim/series.ts';
import { createPickRows } from '../ui/series/pick-rows.ts';
import { createSeriesTrack } from '../ui/series/series-track.ts';
import { pickChoiceOf, trackOf } from '../ui/series/series-view.ts';
import { createSymbolLegend } from '../ui/symbol-legend.ts';

/** One labelled example, in a phone-width frame. */
function example(label: string, ...content: HTMLElement[]): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'ui-example';
  const frame = document.createElement('div');
  frame.className = 'ui-frame';
  frame.append(...content);
  const caption = document.createElement('figcaption');
  caption.textContent = label;
  figure.append(frame, caption);
  return figure;
}

export function uiPartsSection(): HTMLElement {
  const section = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = 'UI parts (phone width)';
  const row = document.createElement('div');
  row.className = 'row';

  const plain = createBallGrid(BALLS, { label: 'Balls', onPick: () => undefined });
  plain.update({ pressed: ['vampire'] });

  const marked = createBallGrid(BALLS, { label: 'Balls', onPick: () => undefined });
  marked.update({
    pressed: ['vampire'],
    marks: {
      against: 'Storm',
      leans: new Map(BALLS.map((ball) => [ball.id, leanOf(ball.id, 'storm')])),
    },
  });

  const lineup = createBallGrid(BALLS, { label: 'Balls', onPick: () => undefined });
  lineup.update({
    pressed: ['storm', 'frost'],
    unavailable: new Map([
      ['storm', 'In slot 1'],
      ['frost', 'In slot 2'],
    ]),
  });

  const detail = createBallDetail(BALLS, { onOpen: () => undefined, onTry: () => undefined });
  detail.show('storm');
  const chart = createMatchupChart(BALLS, () => undefined);

  // A Reveal series after round 1, the player due to show first in round 2.
  const reveal = ['thorns', 'archer', 'a'].reduce(
    (state, step) => (step === 'a' ? recordOutcome(state, 'a') : recordPick(state, step)),
    startSeries({
      ruleset: RULESET_VERSION,
      seed: 0,
      a: ['brawler', 'archer', 'vampire'],
      b: ['thorns', 'speedster', 'frost'],
      opponent: { kind: 'player' },
      format: 'reveal',
    }),
  );
  const track = createSeriesTrack(BALL_LOOKUP);
  track.update(reveal, trackOf(reveal, undefined));
  const rows = createPickRows(BALL_LOOKUP, () => undefined);
  const choice = pickChoiceOf(reveal);
  if (choice !== undefined) rows.show(choice);
  const legend = createSymbolLegend();
  legend.panel.hidden = false;

  row.append(
    example('Series track, Reveal after round 1', track.element),
    example('Pick rows: show first, with the bot’s possible answers', rows.element),
    example('Symbol legend, open', legend.panel),
    example('Ball grid, one chosen', plain.element),
    example('Ball grid, marked against Storm (quick match)', marked.element),
    example('Ball grid in a lineup: balls already in a slot', lineup.element),
    example('Ball manual entry', detail.element),
    example('Matchup chart, first counter selected', chart.element),
  );
  section.append(heading, row);
  return section;
}
