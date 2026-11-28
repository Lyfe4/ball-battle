import { describe, expect, it } from 'vitest';
import { problemsIn } from './check-bundle.ts';

describe('the bundle check', () => {
  it('finds a secret key, a service-role token, a private key, a database password or a Google client secret', () => {
    const jwt = Buffer.from('{"role":"service_role"}').toString('base64url');
    for (const text of [
      'const k="sb_secret_abc"',
      `x="eyJhbGciOiJIUzI1NiJ9.${jwt}.sig"`,
      '-----BEGIN EC PRIVATE KEY-----',
      'postgresql://game_api:hunter2@db.example:5432/postgres',
      'const s="GOCSPX-abcdefghijklmnopqrstuvwxyz12"',
    ]) {
      expect(problemsIn('a.js', text, true), text).toHaveLength(1);
    }
  });

  it('passes a publishable key and ordinary code', () => {
    expect(
      problemsIn('a.js', 'const k="sb_publishable_x"; fetch("/api/v1/health")', true),
    ).toStrictEqual([]);
  });

  it('finds online code in a build without online play', () => {
    expect(problemsIn('a.js', 'fetch("/api/v1/health")', false)).toHaveLength(1);
    expect(problemsIn('a.js', 'fetch("/assets/x")', false)).toStrictEqual([]);
  });

  it('lets a build without online play hold Forget me, and nothing else of the API', () => {
    for (const quote of ['"', "'", '`']) {
      expect(problemsIn('a.js', `const u=${quote}/api/v1/me${quote}`, false)).toStrictEqual([]);
    }
    expect(problemsIn('a.js', 'f("/api/v1/me/match")', false)).toHaveLength(1);
    expect(problemsIn('a.js', 'f(`/api/v1/${e}`)', false)).toHaveLength(1);
    expect(problemsIn('a.js', 'f("/api/v1/"+e)', false)).toHaveLength(1);
    expect(problemsIn('a.js', 'f("/api/v1/me");g("/api/v1/series")', false)).toHaveLength(1);
  });

  it('refuses sign-in code in an online build without accounts (ADR 0079)', () => {
    for (const text of [
      'f("auth/email")',
      'f(`auth/email/verify`)',
      'location.assign("/api/v1/auth/google")',
      'f("auth/switch")',
      'f("PUT","me/username")',
      'f("GET","friends")',
      'f("POST",`friends/${id}/accept`)',
    ]) {
      expect(problemsIn('a.js', text, true, false), text).toHaveLength(1);
      expect(problemsIn('a.js', text, true, true), text).toStrictEqual([]);
    }
    expect(problemsIn('a.js', 'const author="x"; oauth/emails', true, false)).toStrictEqual([]);
    // Words about friends in the page's text are not the friends routes.
    expect(problemsIn('a.js', 't("Play your friends")', true, false)).toStrictEqual([]);
    // Nor is the Friends tab's name (ADR 0081), which an online build without accounts holds.
    for (const text of ['e==="friends"', 'const v=["friends","profile"]', 'f("friends")']) {
      expect(problemsIn('a.js', text, true, false), text).toStrictEqual([]);
    }
    expect(problemsIn('a.js', 'f( "DELETE" , "friends" )', true, false)).toHaveLength(1);
  });

  // Excerpts of real minified bundles (Vite's output keeps template-literal quotes), so the mark is
  // held to the shapes it meets, not only to hand-written ones.
  it('still finds the leak #147 shipped: the account screen in production with vs Friend on', () => {
    // Production's build at 6519135 (online, no accounts), assets/main-DUIwzZi7.js: every place
    // the mark matched it, before #147 kept the account screen out.
    const leaked = [
      'o},c=await e.api(`POST`,`auth/email`,s);c.ok?(n={to:o,r',
      'et i=await e.api(`POST`,`auth/email/verify`,{code:r});i',
      'et t=await e.api(`POST`,`auth/switch`,{});t.ok?e.done()',
      '=>{await e.api(`DELETE`,`auth/switch`),e.back()}))}var ',
      'let o=await e.api(`PUT`,`me/username`,{username:n});o.o',
    ];
    for (const text of leaked)
      expect(problemsIn('main.js', text, true, false), text).toHaveLength(1);
    expect(problemsIn('main.js', leaked.join(';'), true, false)).toHaveLength(1);
  });

  it('finds every accounts call a build with accounts holds, and not the tabs’ names', () => {
    // A build with accounts (online, accounts on) after ADR 0081's routes: its friends, inbox and
    // username calls are accounts code...
    for (const text of [
      'Q(e,s(`POST`,`friends/${n.id}/accept`));let',
      'Q(t,s(`DELETE`,`friends/${n.id}`)),o.append(e',
      'let n=await S(e.api(`POST`,`friends`,{to:t}));n!==',
      'let n=await e.api(`GET`,`friends`);n.ok?(h.hidde',
      'c(){let e=await $(`GET`,`me/inbox`);if(!e.ok||e.body===',
      'load:()=>a(`GET`,`me/record`),open:t.openSeries',
      'page:e=>n(`GET`,`me/matches?after=${encodeURIComponent(e)}`)',
    ]) {
      expect(problemsIn('main.js', text, true, false), text).toHaveLength(1);
    }
    // ...and the Friends tab's name, which production with vs Friend on holds too, is not (the
    // mark before #150 counted these seven places as sign-in code).
    for (const text of [
      ',n)}})();var e=[`manual`,`friends`,`ranks`];function t(',
      ':{ok:!0,state:l}}var Pi=[`friends`,`profile`,`ranks`],F',
      ',`send`,`start`,`signin`,`friends`,`profile`,`ranks`].i',
      'turn{handlers:{friends:r(`friends`),profile:r(`profile`',
    ]) {
      expect(problemsIn('main.js', text, true, false), text).toStrictEqual([]);
    }
  });

  it('refuses the poke’s code in a build without VITE_POKE, online or not (ADR 0082)', () => {
    const socket = [
      'callApi("GET","me/poke")',
      'new WebSocket(`${url}`); const u="wss://x.supabase.co/realtime/v1/websocket"',
      'send(topic,"phx_join",{config:{}})',
    ];
    for (const text of socket) {
      expect(problemsIn('a.js', text, true, true)).toStrictEqual([
        "a.js holds the poke's code in a build without it (VITE_POKE unset)",
      ]);
      expect(problemsIn('a.js', text, true, true, true)).toStrictEqual([]);
    }
    expect(problemsIn('a.js', 'callApi("GET","me/inbox")', true, true)).toStrictEqual([]);
  });

  it('refuses play by turns in a build without VITE_TURNS (ADR 0085)', () => {
    const text = 'segmented(root,"pace","Play",[{value:"live",text:"Live"},{text:"By turns"}])';
    expect(problemsIn('a.js', text, true, true, true)).toStrictEqual([
      'a.js offers play by turns in a build without it (VITE_TURNS unset)',
    ]);
    expect(problemsIn('a.js', text, true, true, true, true)).toStrictEqual([]);
    expect(problemsIn('a.js', 'you take turns, up to a day each', true)).toStrictEqual([]);
  });

  it('refuses the page’s error reports in a build without VITE_ERROR_REPORTS (launch eve)', () => {
    const text = 'const E="/api/v1/client-error";fetch(E,{method:"POST",keepalive:!0})';
    expect(problemsIn('a.js', text, true, true, true, true)).toStrictEqual([
      'a.js reports errors in a build without it (VITE_ERROR_REPORTS unset)',
    ]);
    expect(problemsIn('a.js', text, true, true, true, true, true)).toStrictEqual([]);
  });
});
