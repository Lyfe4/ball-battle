// Accessibility (axe-core, 2026-11-27): every screen and state the flows reach is checked with
// axe's WCAG 2.0, 2.1 and 2.2 A and AA rules and its best practices, signed in with friends (every frame
// screen, each person's sheet, the settings menu and every online state, faked as
// controls-look does) or as a guest. A serious or critical finding fails the test; moderate and
// minor ones are listed in that failure's message.
import axe, { type Result } from 'axe-core';
import { vi } from 'vitest';
import { ACCOUNT_STORAGE_KEY } from '../app/online-device.ts';
import { FRAME_SCREENS } from './frame-anchors-flow.ts';
import { walkOnline, type OnlineAnswers } from './online-looks-support.ts';
import { settle, until, visible } from './page-support.ts';
import { follow, onScreen, openAs, screenOn } from './shell-routes-support.ts';

const FRIENDS = [
  { id: 'f-1', name: 'Jo', status: 'offline', record: { wins: 3, losses: 2 } },
  { id: 'f-2', name: 'Robin', status: 'online' },
];
const SIGNED_IN: OnlineAnswers = {
  '/api/v1/me': { name: 'robin_b', account: true, username: 'robin_b' },
  '/api/v1/me/inbox': { friends: FRIENDS, requests: 1, invites: [], turns: [] },
  '/api/v1/friends': {
    code: '7KQ2M9XD',
    friends: FRIENDS,
    incoming: [{ id: 'r-1', name: 'Morgan' }],
    outgoing: [{ id: 'o-1', name: 'Taylor' }],
    blocked: [],
  },
};

/** One finding: where, which rule, how bad, and the first nodes it names. */
export interface Finding {
  readonly where: string;
  readonly rule: string;
  readonly impact: string;
  readonly nodes: readonly string[];
}

const findingsOf = (where: string, results: readonly Result[]): Finding[] =>
  results.map((result) => ({
    where,
    rule: result.id,
    impact: result.impact ?? 'unknown',
    nodes: result.nodes
      .slice(0, 3)
      .map((node) => `${node.target.join(' ')}: ${node.failureSummary ?? ''}`),
  }));

/** axe on what shows now (`scope`, else the page). Animations are let finish first. */
async function check(where: string, scope?: Element): Promise<Finding[]> {
  await settle();
  const results = await axe.run(scope ?? document, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
    },
    resultTypes: ['violations'],
  });
  return findingsOf(where, results.violations);
}

/** Opens each person's sheet from Friends, checks it, closes it. */
async function sheets(findings: Finding[]): Promise<void> {
  for (const person of ['Robin', 'Jo', 'Morgan', 'Taylor']) {
    const row = visible('.friends-open').find((node) => node.textContent.includes(person));
    if (row === undefined) continue;
    row.click();
    await until(() => document.querySelector('dialog[open]') !== null, 5_000, `${person}'s sheet`);
    findings.push(...(await check(`${person}'s sheet`)));
    document
      .querySelector('dialog[open]')
      ?.querySelector<HTMLButtonElement>('.close-button')
      ?.click();
    await settle();
  }
}

/**
 * Every screen as `signedIn` reaches it; returns every finding. The page loads once per file, so a
 * guest's walk and an account's are files of their own.
 */
export async function walkA11y(signedIn: boolean): Promise<Finding[]> {
  vi.stubEnv('VITE_TURNS', '1');
  if (signedIn) localStorage.setItem(ACCOUNT_STORAGE_KEY, '1');
  const api: OnlineAnswers = signedIn ? { ...SIGNED_IN } : {};
  await openAs({ online: true, accounts: true }, '', api);
  await onScreen('home');
  await document.fonts.ready;
  const findings: Finding[] = [...(await check('Play'))];
  const screens = FRAME_SCREENS.filter(([, , screen]) => !signedIn || screen !== 'signin');
  for (const [name, search, screen] of screens) {
    if (search !== '') await follow(search);
    await until(() => screenOn() === screen, 5_000, name, false);
    if (signedIn && screen === 'friends') {
      await until(() => visible('.friends-open').length > 0, 5_000, 'the friends', false);
    }
    findings.push(...(await check(name)));
    if (signedIn && screen === 'friends') await sheets(findings);
  }
  await follow('');
  await onScreen('home');
  visible('.settings-toggle')[0]?.click();
  await until(() => visible('#settings-panel').length > 0, 5_000, 'the settings menu', false);
  findings.push(...(await check('the settings menu')));
  visible('.settings-toggle')[0]?.click();
  if (signedIn) {
    const online: Finding[] = [];
    await walkOnline(api, async (state) => {
      online.push(...(await check(state.name)));
    });
    findings.push(...online);
  }
  return findings;
}

/** Each finding in one line: impact, rule, where, its first node. */
export const linesOf = (findings: readonly Finding[]): string =>
  findings
    .map((f) => `${f.impact} ${f.rule} @ ${f.where}: ${f.nodes[0] ?? ''}`)
    .join(String.fromCharCode(10));

/** The serious and critical findings: what fails a test. */
export const serious = (findings: readonly Finding[]): Finding[] =>
  findings.filter((finding) => finding.impact === 'serious' || finding.impact === 'critical');
