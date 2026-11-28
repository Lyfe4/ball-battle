import { describe, expect, it, vi } from 'vitest';
import { decodeClientError } from '../api/client-error.ts';
import { createReporter, reportOf } from './error-report.ts';
import {
  REPORTER_AFTER_LOAD_MS,
  startErrorReports,
  type ErrorWindow,
  type Reporter,
} from './error-report-start.ts';

/** A window whose listeners and timers the test fires itself. */
function fakeWindow(readyState = 'loading') {
  const listeners = new Map<string, ((event: unknown) => void)[]>();
  const timers: { handler: () => void; ms: number }[] = [];
  const win = {
    addEventListener(type: string, listener: (event: unknown) => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    document: { readyState },
    setTimeout(handler: () => void, ms: number) {
      timers.push({ handler, ms });
    },
  } as unknown as ErrorWindow;
  const fire = (type: string, event: unknown = {}) => {
    for (const listener of listeners.get(type) ?? []) listener(event);
  };
  return { win, fire, timers, listeners };
}

describe('the page’s error reports (launch eve)', () => {
  it('scrub what they send, and send what the server accepts', () => {
    const report = reportOf('error', new TypeError('No player "robin_b" for code 482913'));
    expect(report).toMatchObject({
      kind: 'error',
      type: 'TypeError',
      message: 'No player "…" for code <n>',
    });
    expect(decodeClientError(report)).toStrictEqual(report);
    expect(reportOf('rejection', 'sam@example.com failed')?.message).toBe('<email> failed');
    expect(reportOf('error', 'Script error.')).toBeUndefined();
  });

  it('send each failure once, at most 5 a page load, and never throw when sending fails', async () => {
    const send = vi.fn<(body: string) => Promise<unknown>>(() =>
      Promise.reject(new Error('offline')),
    );
    const reporter = createReporter(send);
    reporter.report('error', new Error('same'));
    reporter.report('error', new Error('same'));
    for (let i = 0; i < 10; i += 1)
      reporter.report('rejection', new Error(`other ${'x'.repeat(i)}`));
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(5);
    expect(JSON.parse(send.mock.calls[0]?.[0] ?? '{}')).toMatchObject({ message: 'same' });
  });

  it('fetch the reporter only after the page has loaded, then send what failed before', async () => {
    const { win, fire, timers } = fakeWindow();
    const sent: [string, unknown][] = [];
    const reporter: Reporter = { report: (kind, reason) => sent.push([kind, reason]) };
    const load = vi.fn(() => Promise.resolve(reporter));
    startErrorReports(win, load);
    fire('error', { error: new Error('early') });
    fire('unhandledrejection', { reason: 'late promise' });
    expect(timers).toHaveLength(0);
    fire('load');
    expect(timers.map((timer) => timer.ms)).toStrictEqual([REPORTER_AFTER_LOAD_MS]);
    expect(load).not.toHaveBeenCalled();
    timers[0]?.handler();
    await vi.waitFor(() => {
      expect(sent).toHaveLength(2);
    });
    fire('error', { message: 'after' });
    expect(sent.map(([kind]) => kind)).toStrictEqual(['error', 'rejection', 'error']);
    expect(sent[2]?.[1]).toBe('after');
  });

  it('keep at most 5 failures before the reporter arrives, and stay quiet if it never does', async () => {
    const { win, fire, timers } = fakeWindow('complete');
    startErrorReports(win, () => Promise.reject(new Error('chunk gone')));
    for (let i = 0; i < 8; i += 1) fire('error', { error: new Error(String(i)) });
    timers[0]?.handler();
    await Promise.resolve();
    expect(timers).toHaveLength(1);
  });
});
