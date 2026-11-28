import { describe, expect, it } from 'vitest';
import { databaseMatchesUrl, projectOfDatabaseUrl, projectOfSupabaseUrl } from './project-ref.ts';

// Made-up refs of the real shape (20 lowercase letters): never a real project's.
const A = 'abcdefghijklmnopqrst';
const B = 'tsrqponmlkjihgfedcba';
const pooler = (ref: string) =>
  `postgresql://game_api_v2.${ref}:secret@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres`;

describe('whether the functions’ database is SUPABASE_URL’s project', () => {
  it('is true for the pooler or the direct host of the same project', () => {
    expect(databaseMatchesUrl(pooler(A), `https://${A}.supabase.co`)).toBe(true);
    expect(databaseMatchesUrl(pooler(A), `https://${A}.supabase.co/`)).toBe(true);
    expect(
      databaseMatchesUrl(
        `postgresql://postgres:x@db.${A}.supabase.co:5432/postgres`,
        `https://${A}.supabase.co`,
      ),
    ).toBe(true);
  });

  it('is false for another project’s database (production pointing at staging)', () => {
    expect(databaseMatchesUrl(pooler(B), `https://${A}.supabase.co`)).toBe(false);
    expect(
      databaseMatchesUrl(
        `postgresql://postgres:x@db.${B}.supabase.co:5432/postgres`,
        `https://${A}.supabase.co`,
      ),
    ).toBe(false);
  });

  it('is false when either names no project it can read: a check that can’t tell never passes', () => {
    expect(
      databaseMatchesUrl(
        'postgresql://game_api_v2:x@pooler.example.com:6543/postgres',
        `https://${A}.supabase.co`,
      ),
    ).toBe(false);
    expect(databaseMatchesUrl(pooler(A), 'https://api.example.com')).toBe(false);
    expect(databaseMatchesUrl('not a url', `https://${A}.supabase.co`)).toBe(false);
    expect(databaseMatchesUrl(pooler(A), 'http://127.0.0.1:54321')).toBe(false);
    expect(
      databaseMatchesUrl(
        `postgresql://game_api_v2.${B}:x@db.${A}.supabase.co:5432/postgres`,
        `https://${A}.supabase.co`,
      ),
    ).toBe(false);
  });

  it('is true for the local stack, through its pooler or straight to Postgres', () => {
    const url = 'http://127.0.0.1:54321';
    expect(
      databaseMatchesUrl('postgresql://game_api_v2.pooler-dev:x@127.0.0.1:54329/postgres', url),
    ).toBe(true);
    expect(databaseMatchesUrl('postgresql://game_api_v2:x@localhost:54322/postgres', url)).toBe(
      true,
    );
  });

  it('reads the ref from the pooler user or the direct host only', () => {
    expect(projectOfDatabaseUrl(pooler(A))).toBe(A);
    expect(projectOfDatabaseUrl(`postgresql://u:x@db.${A}.supabase.co/postgres`)).toBe(A);
    expect(projectOfDatabaseUrl(`postgresql://u.short:x@h.example.com/postgres`)).toBeUndefined();
    expect(projectOfSupabaseUrl(`https://${A}.supabase.co`)).toBe(A);
    expect(projectOfSupabaseUrl(`https://${A}.supabase.co.evil.com`)).toBeUndefined();
  });
});
