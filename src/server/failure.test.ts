// A failure is logged by stage and kind, and nothing secret ever reaches the log line: not a
// password in a connection string, not a token in an error's message, cause or stack.
import { describe, expect, it } from 'vitest';
import { AuthError, refusalOf } from './auth.ts';
import { ConfigError, configOf } from './config.ts';
import { databaseFor } from './db.ts';
import { failureOf, RulesetError } from './failure.ts';
import { ApiError, endpoint, type Deps } from './http.ts';

const SECRET = 'hunter2-sb_secret_abc123';

/** Runs a route whose handler throws `error`, and returns its log line. */
async function lineFor(
  error: unknown,
  depsOf: () => Deps | undefined = () => ({ config: { online: true } }) as Deps,
) {
  const lines: string[] = [];
  const handler = endpoint(
    'test',
    () => {
      // Whatever the route's code throws, an Error or not.
      throw error;
    },
    depsOf,
    (line) => lines.push(line),
  );
  await handler(new Request('https://x.test/api/v1/test'));
  return lines.join('\n');
}

describe('a failure in the log', () => {
  it('names a database that refuses the connection, never the URL or its password', async () => {
    const sql = databaseFor(`postgresql://game_api:${SECRET}@127.0.0.1:1/postgres`);
    const error = await sql`select 1`.catch((caught: unknown) => caught);
    await sql.end();
    expect(failureOf(error)).toBe('database: ECONNREFUSED connection refused');
    const line = await lineFor(error);
    expect(line).toContain('"failure":"database: ECONNREFUSED connection refused"');
    expect(line).not.toMatch(/hunter2|sb_secret|127\.0\.0\.1|game_api/);
  });

  it('names a database URL that is not a URL', async () => {
    const error = await Promise.resolve()
      .then(() => databaseFor(`postgres://game_api:${SECRET}@[not a host/postgres`))
      .then((sql) => sql`select 1`)
      .catch((caught: unknown) => caught);
    expect(failureOf(error)).toMatch(/^database: /);
    expect(failureOf(error)).not.toContain('hunter2');
  });

  it('says which setting is wrong, never its value', async () => {
    const config = () =>
      configOf({
        BALLBATTLE_ONLINE: '1',
        DATABASE_URL: `postgres://u:${SECRET}@h/d`,
        SUPABASE_URL: 'https://x.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
        SUPABASE_SECRET_KEY: SECRET,
        SEED_KEYS: `{"k": "${SECRET}"`,
      });
    const line = await lineFor(undefined, () => {
      config();
      return undefined;
    });
    expect(line).toContain('"failure":"config: SEED_KEYS is not JSON"');
    expect(line).not.toContain('hunter2');
  });

  it('logs only the kind of an error whose message, cause or stack holds a secret', async () => {
    const error = new Error(`connect to postgres://u:${SECRET}@db failed`, {
      cause: new Error(SECRET),
    });
    error.stack = `Error: ${SECRET}\n    at x (/var/task/${SECRET}.js:1:1)`;
    const line = await lineFor(error);
    expect(line).toContain('"failure":"internal: Error"');
    expect(line).not.toContain('hunter2');
  });

  it('never logs a code that could carry a value', () => {
    const shaped = Object.assign(new Error('x'), { code: `password=${SECRET}` });
    expect(failureOf(shaped)).toBe('internal: Error');
  });

  it('names Auth refusing or unreachable, the ruleset bundle, and our own 5xx answers', () => {
    expect(failureOf(new AuthError('x', 503))).toBe('auth: Supabase Auth answered 503');
    expect(failureOf(new AuthError('x', 422, undefined, 'anonymous_provider_disabled'))).toBe(
      'auth: Supabase Auth answered 422 anonymous_provider_disabled',
    );
    expect(failureOf(new AuthError('x', 422, undefined, `key=${SECRET}`))).toBe(
      'auth: Supabase Auth answered 422',
    );
    const unreachable = new AuthError(
      'x',
      0,
      Object.assign(new Error(SECRET), { code: 'ENOTFOUND' }),
    );
    expect(failureOf(unreachable)).toBe(
      'auth: Supabase Auth unreachable (ENOTFOUND host not found (DNS))',
    );
    expect(failureOf(new ApiError(500, 'ruleset_missing', 'x'))).toBe(
      'ruleset: no frozen bundle on this server',
    );
    expect(failureOf(new RulesetError('ruleset 15’s bundle failed to load (SyntaxError)'))).toBe(
      'ruleset: ruleset 15’s bundle failed to load (SyntaxError)',
    );
    expect(failureOf(Object.assign(new Error('x'), { code: '28P01' }), 'database')).toBe(
      'database: 28P01 password authentication failed',
    );
  });

  it('names Auth’s own error code from its answer, such as anonymous sign-ins being off', async () => {
    const answer = new Response(
      JSON.stringify({ code: 422, error_code: 'anonymous_provider_disabled', msg: 'x' }),
      { status: 422 },
    );
    expect(failureOf(await refusalOf(answer, 'x'))).toBe(
      'auth: Supabase Auth answered 422 anonymous_provider_disabled',
    );
    expect(failureOf(await refusalOf(new Response('not json', { status: 500 }), 'x'))).toBe(
      'auth: Supabase Auth answered 500',
    );
  });

  it('leaves a client’s mistake out of it (a 4xx is an answer, not a failure)', async () => {
    const line = await lineFor(new ApiError(409, 'not_your_turn', 'x'));
    expect(line).not.toContain('failure');
  });

  it('keeps a ConfigError’s own words, which name settings only', () => {
    expect(failureOf(new ConfigError('DATABASE_URL is not set'))).toBe(
      'config: DATABASE_URL is not set',
    );
  });
});
