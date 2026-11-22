import { describe, expect, it } from 'vitest';
import { ConfigError, configOf, parseSeedKeys } from './config.ts';

const key = (byte: number, length = 32) => Buffer.alloc(length, byte).toString('base64');

const ONLINE = {
  BALLBATTLE_ONLINE: '1',
  DATABASE_URL: 'postgres://game_api:secret@db.example/postgres',
  SUPABASE_URL: 'https://project.supabase.co/',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  SUPABASE_SECRET_KEY: 'sb_secret_x',
  SEED_KEYS: JSON.stringify({ '2026-11': key(1) }),
};

describe('the server configuration', () => {
  it('is absent with online play off and no settings, and needs no secrets then', () => {
    expect(configOf({})).toBeUndefined();
    expect(configOf({ BALLBATTLE_ONLINE: 'true' })).toBeUndefined();
    expect(configOf({ ...ONLINE, BALLBATTLE_ONLINE: '0', SEED_KEYS: ' ' })).toBeUndefined();
    expect(configOf({ ...ONLINE, BALLBATTLE_ONLINE: undefined, DATABASE_URL: '' })).toBeUndefined();
  });

  it('is read with online play off when every setting is there, so deleting never waits on it', () => {
    expect(configOf({ ...ONLINE, BALLBATTLE_ONLINE: undefined })?.online).toBe(false);
    expect(configOf({ ...ONLINE, BALLBATTLE_ONLINE: '0' })?.online).toBe(false);
    expect(configOf(ONLINE)?.online).toBe(true);
  });

  it('reads every setting when online, trimming the Supabase URL', () => {
    const config = configOf(ONLINE);
    expect(config?.supabaseUrl).toBe('https://project.supabase.co');
    expect(config?.currentSeedKey.id).toBe('2026-11');
    expect(config?.sentryDsn).toBeUndefined();
  });

  it('names a missing setting, never a value', () => {
    for (const name of ['DATABASE_URL', 'SUPABASE_URL', 'SEED_KEYS', 'SUPABASE_SECRET_KEY']) {
      expect(() => configOf({ ...ONLINE, [name]: ' ' })).toThrow(
        new ConfigError(`${name} is not set`),
      );
    }
    expect(() => configOf({ ...ONLINE, SEED_KEYS: '{"k": "short"}' })).toThrow(/shorter than 32/);
    expect(() => configOf({ ...ONLINE, SEED_KEYS: '{"k": "short"}' })).not.toThrow(/short"/);
  });
});

describe('the accounts settings (ADR 0079)', () => {
  it('are off unless switched on, and never without online play', () => {
    expect(configOf(ONLINE)?.accounts).toBe(false);
    expect(configOf({ ...ONLINE, BALLBATTLE_ACCOUNTS: 'true' })?.accounts).toBe(false);
    expect(configOf({ ...ONLINE, BALLBATTLE_ACCOUNTS: '1' })?.accounts).toBe(true);
    const offline = { ...ONLINE, BALLBATTLE_ONLINE: undefined, BALLBATTLE_ACCOUNTS: '1' };
    expect(configOf(offline)?.accounts).toBe(false);
  });

  it('send email codes unless switched off', () => {
    expect(configOf(ONLINE)?.emailCodes).toBe(true);
    expect(configOf({ ...ONLINE, BALLBATTLE_EMAIL_CODES: 'OFF' })?.emailCodes).toBe(false);
  });

  it('offer Google only with both its client id and secret', () => {
    expect(configOf(ONLINE)?.google).toBeUndefined();
    const google = { GOOGLE_CLIENT_ID: 'id.apps', GOOGLE_CLIENT_SECRET: 'secret' };
    expect(configOf({ ...ONLINE, ...google })?.google).toStrictEqual({
      clientId: 'id.apps',
      clientSecret: 'secret',
    });
    expect(() => configOf({ ...ONLINE, GOOGLE_CLIENT_ID: 'id.apps' })).toThrow(ConfigError);
    expect(() => configOf({ ...ONLINE, GOOGLE_CLIENT_ID: 'id.apps' })).not.toThrow(/id\.apps/);
  });
});

describe('the seed key map', () => {
  it('uses the newest id for new series and keeps the old keys', () => {
    const { keys, current } = parseSeedKeys(
      JSON.stringify({ '2026-11': key(1), '2027-02': key(2) }),
    );
    expect(current.id).toBe('2027-02');
    expect(current.raw[0]).toBe(2);
    expect([...keys.keys()]).toStrictEqual(['2026-11', '2027-02']);
  });

  it('refuses anything but a map of plain ids to keys of 32 bytes or more', () => {
    for (const bad of ['', '[]', 'null', '{}', '"k"', '{"a b": "x"}', `{"k": ${String(1)}}`]) {
      expect(() => parseSeedKeys(bad)).toThrow(ConfigError);
    }
    expect(() => parseSeedKeys(JSON.stringify({ k: key(1, 31) }))).toThrow(ConfigError);
    expect(parseSeedKeys(JSON.stringify({ k: key(1, 64) })).current.raw).toHaveLength(64);
  });
});
