// The hosted projects' tooling (ADR 0068): the daily check's verdict, the migrations Publish
// applies, and the rule that a migration, once applied, is never edited.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { localVersions, migrationGap } from './migrate.ts';
import {
  codesProblem,
  sizeReport,
  forwardingProblem,
  madeUpIp,
  mailProblem,
  mailWarning,
} from './project-check.ts';
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
    '20261123120000_inbox.sql': '9ac7a92e696bb2b59c8ddcd30ac9c35b96423ef313d188237cedbfba862af8c2',
    '20261123180000_starts.sql': 'bb3c2f6ad953bf26c4c08d0e2b8f631ae9a87cfef6b4783ddd8c3a30a59bd187',
    '20261124090000_auth_hooks.sql':
      '9aadf9db0800033f53d201a5ec0b1ab60e251deb41c1e6d59c4e1dc6588b2847',
    '20261124120000_poke.sql': '46855fef8a7db41bfdf965c7f8750abe5e8cc34b806b2aa81d899f1a57ca00f2',
    '20261124190000_mail_watch.sql':
      'b402e619043dd5acc1cbe863b27608d94d625fca14213388cbb63b4695d91467',
    '20261125090000_blocks_reports.sql':
      '1c0afb20dfe999c6426afd316bba5f0604acfab8baab137d38722ba1b3b22c38',
    '20261125150000_ranked.sql': '22acb3647d09024db649651c26f20ab2c15220ff41f828db1210ad0637a2a86c',
    '20261125200000_poke_turns.sql':
      'e052f04e7026cd2969a118c49924f2533c7f56099fcf6c5f9d88714bd20d8f1f',
    '20261125210000_mail_watch_read_only.sql':
      'fdc556bac944071147a4b29dda6565eb173f764d4be327b6655f316108ace0f7',
    '20261125234153_series_seen.sql':
      'bfa71eefbdcb66e8b0ca8cd612217437ccd8c827d6fa2c309b19c0b1cd37cb25',
    '20261127120000_one_outgoing_challenge.sql':
      '8b1edcb8ac258270ff2e405fddb151d1ba03723e921107ff9f4239a0fb26d246',
    '20261128120000_session_live.sql':
      '8612d4dbe535dff99b0ab0a205b6f5653b504ac3ed0197ef5d6f04b154f3be20',
    '20261128130000_player_keys_and_orphans.sql':
      '862c0f86ab0151840a74c932fa295044df330ef50d2413619e381ee466a2271e',
    '20261128140000_poke_private.sql':
      '851449d8b3877a218e2ce0d58e894941d301e8d5757624268a1d4564e58321fa',
  };
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const files = readdirSync(dir).filter((file) => file.endsWith('.sql'));

  // Expand only (ADR 0068): the live deploy keeps running against a database that is already
  // migrated, so nothing it uses may go, change type or tighten. Function bodies ($$ ... $$) may
  // delete their own rows; the statements around them may not.
  const SHRINKS =
    /\b(drop\s+(table|column|schema|type|view|materialized\s+view|sequence)|rename\s+(to|column)|truncate|alter\s+column\s+\w+\s+(set\s+data\s+)?type|set\s+not\s+null)\b/i;
  it.each(files)('%s only expands the schema', (file) => {
    const text = readFileSync(new URL(file, dir), 'utf8')
      .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, '')
      .replace(/--.*$/gm, '');
    expect(SHRINKS.exec(text)?.[0]).toBeUndefined();
  });

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

describe('the daily check of the code emails the relay refused (ADR 0082, the mail watch)', () => {
  it('fails on any refused or unanswered send in the last day, naming where to look', () => {
    expect(mailProblem({ sent: 0, failed: 0, unseen: 0 })).toBeUndefined();
    expect(mailProblem({ sent: 40, failed: 0, unseen: 3 })).toBeUndefined();
    expect(mailProblem({ sent: 40, failed: 2, unseen: 0 })).toMatch(
      /^2 of 40 code emails in the last 24 h were refused or never answered by the relay/,
    );
  });

  it('warns, without failing, about sends whose answer nobody read in time', () => {
    expect(mailWarning({ sent: 40, failed: 0, unseen: 0 })).toBeUndefined();
    expect(mailWarning({ sent: 40, failed: 0, unseen: 3 })).toMatch(/^3 of 40 code emails/);
  });
});

describe('the daily check of the database’s size (ADR 0083, decision 8)', () => {
  it('reports the size every day and warns, without failing, from 300 MB of the 500', () => {
    const mb = 1024 * 1024;
    expect(sizeReport(12 * mb)).toStrictEqual({
      line: "database 12 MB of the free plan's 500 MB",
    });
    expect(sizeReport(299 * mb).warning).toBeUndefined();
    expect(sizeReport(300 * mb).warning).toMatch(
      /^the database is 300 MB of the free plan's 500 MB/,
    );
  });
});
