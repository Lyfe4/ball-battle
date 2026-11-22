// The hosted projects' tooling (ADR 0068): the daily check's verdict, the migrations Publish
// applies, and the rule that a migration, once applied, is never edited.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { localVersions, migrationGap } from './migrate.ts';
import { codesProblem, forwardingProblem, madeUpIp } from './project-check.ts';
import { projectRefOf } from './supabase-projects.ts';

describe('the daily check', () => {
  it('forwards a documentation address, never a real one', () => {
    expect(madeUpIp(0)).toBe('198.51.100.1');
    expect(madeUpIp(0.999_999)).toBe('198.51.100.254');
  });

  it('passes only when Auth recorded the forwarded IP', () => {
    expect(forwardingProblem('198.51.100.7', '198.51.100.7')).toBeUndefined();
    expect(forwardingProblem('198.51.100.7', '203.0.113.9')).toMatch(/IP Address Forwarding/);
    expect(forwardingProblem('198.51.100.7', undefined)).toMatch(/no session/);
  });

  it('knows only the two projects', () => {
    expect(projectRefOf('staging')).toBe('fcmzgitzaaabcmbzxxcg');
    expect(projectRefOf('production')).toBe('wtqmptuhonbtjwxjwtwl');
    expect(projectRefOf('prod')).toBeUndefined();
    expect(projectRefOf(undefined)).toBeUndefined();
  });
});

describe('migrations', () => {
  it('reads versions from file names, in order, and flags a misnamed file', () => {
    expect(localVersions(['20261115000000_b.sql', 'README.md', '20261114000000_a.sql'])).toEqual([
      '20261114000000',
      '20261115000000',
    ]);
    expect(localVersions(['fix.sql'])).toEqual(['unnamed: fix.sql']);
  });

  it('tells a missing migration from one this checkout lacks', () => {
    expect(migrationGap(['1', '2'], ['1', '2'])).toEqual([]);
    expect(migrationGap(['1', '2'], ['1'])).toEqual(['2 is not applied']);
    expect(migrationGap(['1'], ['1', '3'])).toEqual(['3 is applied but not in this checkout']);
  });

  // Staging and production run these exactly once, so an edit would never reach them: a change is a
  // new migration. Add a line for each new file; never change one (ADR 0068).
  const PINNED: Readonly<Record<string, string>> = {
    '20261114213106_game_schema.sql':
      'b42faf89de1c526abeb033542220f1bbb608c110f8197e961d7d14477f66c077',
    '20261115014513_api_login_role.sql':
      '3f482b65a887990d946af2d2f931e739473893449e50ebbe7274a4d03fd7913c',
    '20261115090000_live_series.sql':
      '03d0d9ac5fc0f1c64bd59ff63806f64e94a8ea32ad608d7e53a3950495e77379',
    '20261115222739_rematch.sql':
      '1fe76249365689f374d1854b03e196f52fc629951c0cf261af637d0290f44eb1',
    '20261121064854_api_statement_timeout.sql':
      'beeab3f005f64d869fa2b2fa490e207c5fa8f919c5e00cd38b56a4eeabb24237',
    '20261122090000_accounts.sql':
      'baba9f2f68a70a57e6b85245f82da162c91ba4e68b91da4a5f64a76893665fc0',
    '20261122120000_usernames.sql':
      '09b6cd1df250f9cf2d91f945784f5a97bbf97ba1be135ca82d6f055f14e378b8',
    '20261123090000_friends.sql':
      'd783eee9b026aa28dbaf9df2b1d1845984c949cd4f670fbdbb83faf6279f847c',
  };
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const files = readdirSync(dir).filter((file) => file.endsWith('.sql'));

  it.each(files)('%s is pinned and unchanged', (file) => {
    const text = readFileSync(new URL(file, dir), 'utf8').replaceAll('\r\n', '\n');
    expect(createHash('sha256').update(text).digest('hex')).toBe(PINNED[file]);
  });

  it('pins no file that is gone', () => {
    expect(Object.keys(PINNED).filter((file) => !files.includes(file))).toEqual([]);
  });
});

describe('the daily check of this month’s email codes (ADR 0079)', () => {
  it('fails from 2,200, the same point /api/v1/health says near', () => {
    expect(codesProblem(0)).toBeUndefined();
    expect(codesProblem(2199)).toBeUndefined();
    expect(codesProblem(2200)).toMatch(/^2200 email codes this month, near the 2700 cap/);
  });
});
