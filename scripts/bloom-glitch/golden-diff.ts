// Which recorded matches play differently on this branch (proto only): replays each recorded case.
import { readFileSync } from 'node:fs';
import { playGolden, type GoldenRecord } from '../../src/golden/golden.ts';

const record = JSON.parse(readFileSync('src/golden/golden-matches.json', 'utf8')) as GoldenRecord;
const changed: string[] = [];
for (const want of record.results) {
  const got = await playGolden({ a: want.a, b: want.b, seed: want.seed });
  if (got.hash !== want.hash || got.endTick !== want.endTick) changed.push(`${want.a}|${want.b}`);
}
console.log('recorded', record.results.length, 'changed', changed.length);
console.log([...new Set(changed)].join(' '));
