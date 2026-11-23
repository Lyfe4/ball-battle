import { describe, expect, it } from 'vitest';
import { problemsIn } from './check-bundle.ts';

describe('the bundle check', () => {
  it('finds a secret key, a service-role token, a private key or a database password', () => {
    const jwt = Buffer.from('{"role":"service_role"}').toString('base64url');
    for (const text of [
      'const k="sb_secret_abc"',
      `x="eyJhbGciOiJIUzI1NiJ9.${jwt}.sig"`,
      '-----BEGIN EC PRIVATE KEY-----',
      'postgresql://game_api:hunter2@db.example:5432/postgres',
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
});
