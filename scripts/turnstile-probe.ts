// `node scripts/turnstile-probe.ts [--key <site key>] [--secret <secret>] [--engines chromium,firefox,webkit]`
// Does Cloudflare Turnstile work under our CSP (ADR 0079 addendum of 2026-11-28)? Serves a page
// with the production headers (`security-headers.ts`, Trusted Types required) that runs the page's
// own check (`src/ui/captcha.ts` and `src/ui/turnstile.ts`, types stripped) with Cloudflare's test
// keys, in each engine, and prints every CSP and Trusted Types violation and console line, the
// token, the box's height before and after the widget, and siteverify's answer to the token.
// Exits 1 on any violation, a missing token (with the passing key) or a box that moved.
// Needs the network (Cloudflare's script, frame and siteverify), so it is a script run by hand
// after any change to the CSP or the widget, not a CI test. Uses only Cloudflare's public test
// keys unless told otherwise: 1x…AA passes, 2x…AB fails (a token never comes: expect exit 1).
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit, type BrowserType } from 'playwright';
import { SECURITY_HEADERS } from './security-headers.ts';

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] ?? fallback) : fallback;
};
const KEY = option('key', '1x00000000000000000000AA');
const SECRET = option('secret', '1x0000000000000000000000000000000AA');
const ENGINES: Record<string, BrowserType> = { chromium, firefox, webkit };
const engines = option('engines', 'chromium,firefox,webkit').split(',');
const SRC = fileURLToPath(new URL('../src/', import.meta.url));

const PAGE = `<!doctype html><meta charset="utf-8"><title>Turnstile probe</title>
<link rel="stylesheet" href="/src/ui/captcha.css"><body><script type="module" src="/probe.js"></script>`;
const PROBE = `
import { createCaptcha } from '/src/ui/captcha.ts';
import { createTurnstile, loadTurnstile } from '/src/ui/turnstile.ts';
const probe = { violations: [], done: false };
window.probe = probe;
document.addEventListener('securitypolicyviolation', (event) => {
  probe.violations.push([event.effectiveDirective, event.blockedURI, event.sample, event.sourceFile].join(' | '));
});
const key = new URLSearchParams(location.search).get('key');
const captcha = createCaptcha(async (box, events) => createTurnstile(box, key, await loadTurnstile(), events), 20000);
document.body.append(captcha.element);
probe.before = captcha.element.getBoundingClientRect().height;
captcha.show();
probe.token = await captcha.token();
probe.after = captcha.element.getBoundingClientRect().height;
probe.done = true;
`;

/** A file under src/, types stripped from TypeScript: never a path outside it. */
function source(path: string): { type: string; body: string } | undefined {
  const file = fileURLToPath(new URL(`..${path}`, import.meta.url));
  if (!file.startsWith(SRC) || !/\.(?:ts|css)$/.test(file)) return undefined;
  const text = readFileSync(file, 'utf8');
  return file.endsWith('.css')
    ? { type: 'text/css', body: text }
    : { type: 'text/javascript', body: stripTypeScriptTypes(text) };
}

const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  const file =
    path === '/'
      ? { type: 'text/html', body: PAGE }
      : path === '/probe.js'
        ? { type: 'text/javascript', body: PROBE }
        : source(path);
  response.writeHead(file === undefined ? 404 : 200, {
    ...SECURITY_HEADERS,
    'Content-Type': file?.type ?? 'text/plain',
  });
  response.end(file?.body ?? 'Not found');
}).listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const address = server.address();
const port = typeof address === 'object' && address !== null ? address.port : 0;
console.log(`CSP: ${SECURITY_HEADERS['Content-Security-Policy'] ?? ''}`);

interface Probe {
  readonly violations: string[];
  readonly done: boolean;
  readonly token?: string | null;
  readonly before?: number;
  readonly after?: number;
}

let failed = false;
for (const name of engines) {
  const engine = ENGINES[name];
  if (engine === undefined) throw new Error(`No engine ${name}`);
  const browser = await engine.launch();
  const page = await browser.newPage();
  const lines: string[] = [];
  page.on('console', (message) => lines.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => lines.push(`pageerror: ${error.message}`));
  await page.goto(`http://localhost:${String(port)}/?key=${encodeURIComponent(KEY)}`);
  await page.waitForFunction(() => (globalThis as unknown as { probe?: Probe }).probe?.done, null, {
    timeout: 30_000,
  });
  // A moment more for anything the widget does after its token.
  await page.waitForTimeout(1500);
  const probe = await page.evaluate(() => (globalThis as unknown as { probe: Probe }).probe);
  await browser.close();
  console.log(`\n${name} ${browser.version()}`);
  console.log(`  token: ${probe.token ?? 'none'}`);
  console.log(`  box: ${String(probe.before)} px before, ${String(probe.after)} px after`);
  console.log(`  violations: ${probe.violations.length === 0 ? 'none' : ''}`);
  for (const line of probe.violations) console.log(`    ${line}`);
  console.log(`  console: ${lines.length === 0 ? 'nothing' : ''}`);
  for (const line of lines) console.log(`    ${line}`);
  if (typeof probe.token === 'string') {
    const answer = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: SECRET, response: probe.token }),
    });
    console.log(`  siteverify: ${String(answer.status)} ${await answer.text()}`);
  }
  if (probe.violations.length > 0 || typeof probe.token !== 'string') failed = true;
  if (probe.before !== probe.after) failed = true;
}
server.close();
process.exit(failed ? 1 : 0);
