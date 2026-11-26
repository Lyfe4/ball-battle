// One incoming banner at a time (ADR 0086): news (OK alone, "You left: Jo wins") yields to a banner
// that asks for an answer (a rematch), and waits out while one shows, so the ask is never covered.
import { describe, expect, it } from 'vitest';
import '../../style.css';
import { createIncomingBanner } from './incoming-banner.ts';

const ways = {
  accept: () => Promise.resolve(),
  decline: () => Promise.resolve(),
  dismiss: () => undefined,
  later: () => undefined,
};

describe('incoming banners', () => {
  it('show one at a time: news yields to an ask and waits while one shows', () => {
    const newsRoot = document.createElement('div');
    const askRoot = document.createElement('div');
    document.body.replaceChildren(newsRoot, askRoot);
    const news = createIncomingBanner(newsRoot, 'Match', ways);
    const ask = createIncomingBanner(askRoot, 'Rematch', ways);
    news.show({ who: 'Jo', title: 'You left: Jo wins', line: '', answers: 'ok' });
    expect(newsRoot.hidden).toBe(false);
    ask.show({ who: 'Jo', title: 'Jo wants a rematch', line: 'Best of 3', answers: 'answer' });
    expect([newsRoot.hidden, askRoot.hidden]).toStrictEqual([true, false]);
    news.show({ who: 'Jo', title: 'You left: Jo wins', line: '', answers: 'ok' });
    expect([newsRoot.hidden, askRoot.hidden]).toStrictEqual([true, false]);
    ask.show(undefined);
    news.show({ who: 'Jo', title: 'You left: Jo wins', line: '', answers: 'ok' });
    expect(newsRoot.hidden).toBe(false);
  });
});
