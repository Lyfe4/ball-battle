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
    ]) {
      expect(problemsIn('a.js', text, true, false), text).toHaveLength(1);
      expect(problemsIn('a.js', text, true, true), text).toStrictEqual([]);
    }
    expect(problemsIn('a.js', 'const author="x"; oauth/emails', true, false)).toStrictEqual([]);
  });
});
