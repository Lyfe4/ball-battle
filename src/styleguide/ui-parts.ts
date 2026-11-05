// The style guide's UI parts: every shared screen component in its states, at phone width, built
// with the game's own code and stylesheet (styleguide.html?only=ui). It plays the part a component
// catalogue would, without a new dependency.
import '../style.css';
import { BALLS } from '../sim/balls/index.ts';
import { createBallGrid } from '../ui/balls/ball-grid.ts';
import { createBallInfo } from '../ui/balls/ball-info.ts';
import { leanOf } from '../ui/balls/matchups.ts';
import { createBallDetail } from '../ui/manual/ball-detail.ts';
import { createMatchupChart } from '../ui/manual/matchup-chart.ts';

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

  const info = createBallInfo(BALLS);
  info.show('vampire');
  const brawler = createBallInfo(BALLS);
  brawler.show('brawler');

  const detail = createBallDetail(BALLS, { onOpen: () => undefined, onTry: () => undefined });
  detail.show('storm');
  const chart = createMatchupChart(BALLS, () => undefined);

  row.append(
    example('Ball grid, one chosen', plain.element),
    example('Ball grid, marked against Storm (quick match)', marked.element),
    example('Ball grid in a lineup: balls already in a slot', lineup.element),
    example('Ball info', info.element),
    example('Ball info, a ball that beats nothing in particular', brawler.element),
    example('Ball manual entry', detail.element),
    example('Matchup chart, first counter selected', chart.element),
  );
  section.append(heading, row);
  return section;
}
