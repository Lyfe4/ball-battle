// The code emails the Send Email hook hands to pg_net, watched (ADR 0082, the mail watch). pg_net
// posts after Auth has answered, so a relay that refuses an email is silent to the player; its
// answer sits in `net._http_response` for only 6 hours. The hook notes each send, answers are copied
// before pg_net drops them, and `game.mail_outcomes` / `game.mail_watch` count the last day.
// Against the local stack, where the hook delivers to Mailpit (supabase/seed.sql).
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { expectAuth, newTicket, ticketData } from './auth-tickets.ts';
import { nextCode, newEmail } from './test/mail.ts';
import { adminSql, testDeps } from './test/support.ts';

const deps = testDeps();
const admin = adminSql();
const { supabaseUrl, supabaseSecretKey } = deps.config;
const MAILPIT = 'http://supabase_inbucket_ballbattle:8025/api/v1/send';

beforeAll(async () => {
  await admin`delete from game.rate_limits`;
  await admin`delete from game.mail_sends`;
});
afterEach(async () => {
  await admin`update game.mail_relay set url = ${MAILPIT}`;
  await admin`delete from game.mail_sends`;
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

interface Outcomes {
  readonly sent: number;
  readonly failed: number;
  readonly unseen: number;
}

/** A sign-in code the game asked for (its ticket first), as `/auth/email` does. */
async function askForCode(email: string): Promise<void> {
  const signUp = newTicket();
  await expectAuth(deps.sql, { email, signUp });
  const answer = await fetch(`${supabaseUrl}/auth/v1/otp`, {
    method: 'POST',
    headers: { apikey: supabaseSecretKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, create_user: true, data: ticketData(signUp) }),
  });
  expect(answer.status).toBe(200);
}

/** The last send's answer from pg_net, waiting for it (it posts after commit). */
async function answered(): Promise<void> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const [row] = await admin<{ n: number }[]>`
      select count(*)::int as n from game.mail_sends sends
      where not exists (select 1 from net._http_response r where r.id = sends.request_id)`;
    if (row?.n === 0) return;
    if (Date.now() > deadline) throw new Error('pg_net never answered');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const outcomes = async (): Promise<Outcomes> => {
  const [row] = await admin<Outcomes[]>`select * from game.mail_outcomes(24)`;
  if (row === undefined) throw new Error('no row');
  return row;
};

describe('the mail watch', () => {
  it('notes a code the relay delivered, with no address kept', async () => {
    const email = newEmail();
    await askForCode(email);
    await nextCode(email);
    await answered();
    expect(await outcomes()).toStrictEqual({ sent: 1, failed: 0, unseen: 0 });
    const columns = await admin<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = 'game' and table_name = 'mail_sends' order by ordinal_position`;
    expect(columns.map((c) => c.column_name)).toStrictEqual([
      'request_id',
      'sent_at',
      'answered',
      'status_code',
    ]);
  });

  it('counts a code the relay refused, though Auth answered 200 and the player saw "sent"', async () => {
    await admin`update game.mail_relay set url = ${MAILPIT.replace('/send', '/no-such-route')}`;
    await askForCode(newEmail());
    await answered();
    expect(await outcomes()).toStrictEqual({ sent: 1, failed: 1, unseen: 0 });
  });

  it('keeps a refusal past pg_net dropping its answer, once the next send or health copied it', async () => {
    await admin`update game.mail_relay set url = ${MAILPIT.replace('/send', '/no-such-route')}`;
    await askForCode(newEmail());
    await answered();
    await admin`update game.mail_relay set url = ${MAILPIT}`;
    // The next send copies the first one's answer.
    const email = newEmail();
    await askForCode(email);
    await nextCode(email);
    await answered();
    await admin`delete from net._http_response`;
    // The second's own answer went too, but it is under 2 minutes old: on its way, not unseen.
    expect(await outcomes()).toStrictEqual({ sent: 2, failed: 1, unseen: 0 });
  });

  it('health’s read copies answers first, as the API role', async () => {
    await admin`update game.mail_relay set url = ${MAILPIT.replace('/send', '/no-such-route')}`;
    await askForCode(newEmail());
    await answered();
    const [watched] = await deps.sql<Outcomes[]>`select * from game.mail_watch()`;
    expect(watched).toStrictEqual({ sent: 1, failed: 1, unseen: 0 });
    await admin`delete from net._http_response`;
    expect(await outcomes()).toStrictEqual({ sent: 1, failed: 1, unseen: 0 });
  });

  it('says a send whose answer nobody saw is unseen, and one on its way is neither', async () => {
    await admin`insert into game.mail_sends (request_id, sent_at) values (-1, now() - interval '7 hours')`;
    await admin`insert into game.mail_sends (request_id, sent_at) values (-2, now())`;
    expect(await outcomes()).toStrictEqual({ sent: 2, failed: 0, unseen: 1 });
  });

  it('counts only the last day, and drops sends after 7 days', async () => {
    await admin`insert into game.mail_sends (request_id, sent_at, answered, status_code)
      values (-3, now() - interval '2 days', true, 500), (-4, now() - interval '8 days', true, 500)`;
    expect(await outcomes()).toStrictEqual({ sent: 0, failed: 0, unseen: 0 });
    await deps.sql`select * from game.mail_watch()`;
    const left = await admin<{ request_id: string }[]>`select request_id from game.mail_sends`;
    expect(left.map((row) => Number(row.request_id))).toStrictEqual([-3]);
  });

  it('is read by no page role, and only health’s read by the API', async () => {
    const [rights] = await admin<
      { api_watch: boolean; api_outcomes: boolean; anon: boolean; table: boolean }[]
    >`select
        has_function_privilege('game_api', 'game.mail_watch()', 'execute') as api_watch,
        has_function_privilege('game_api', 'game.mail_outcomes(integer)', 'execute') as api_outcomes,
        has_function_privilege('anon', 'game.mail_watch()', 'execute') as anon,
        has_table_privilege('game_api', 'game.mail_sends', 'select') as table`;
    expect(rights).toStrictEqual({
      api_watch: true,
      api_outcomes: false,
      anon: false,
      table: false,
    });
  });
});
