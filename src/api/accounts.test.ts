import { describe, expect, it } from 'vitest';
import {
  decodeSendCode,
  decodeVerifyCode,
  isGoogleResult,
  normalCode,
  normalEmail,
} from './accounts.ts';

describe('email addresses (ADR 0079)', () => {
  it('are kept trimmed and in lower case, so one address is counted once', () => {
    expect(normalEmail('  Sam@Example.COM ')).toBe('sam@example.com');
  });

  it('refuses what can’t be one', () => {
    const long = `${'a'.repeat(250)}@x.co`;
    for (const text of [
      '',
      'sam',
      'sam@',
      '@example.com',
      'sam@example',
      'a b@example.com',
      long,
    ]) {
      expect(normalEmail(text), text).toBeUndefined();
    }
  });

  it('decode a send with the 16+ confirmation only when it is true', () => {
    expect(decodeSendCode({ email: 'Sam@example.com' })).toStrictEqual({
      email: 'sam@example.com',
    });
    expect(decodeSendCode({ email: 'sam@example.com', adult: true })).toStrictEqual({
      email: 'sam@example.com',
      adult: true,
    });
    expect(decodeSendCode({ email: 'sam@example.com', adult: 'yes' })).toStrictEqual({
      email: 'sam@example.com',
    });
    for (const body of [null, 'x', {}, { email: 4 }, { email: 'nope' }]) {
      expect(decodeSendCode(body)).toBeUndefined();
    }
  });
});

describe('codes', () => {
  it('are 6 digits, spaces from a paste dropped', () => {
    expect(normalCode('123 456')).toBe('123456');
    expect(normalCode(' 123456\n')).toBe('123456');
    for (const text of ['12345', '1234567', '12345a', '']) expect(normalCode(text)).toBeUndefined();
    expect(decodeVerifyCode({ code: '654321' })).toStrictEqual({ code: '654321' });
    expect(decodeVerifyCode({ code: 654321 })).toBeUndefined();
  });
});

describe('Google results', () => {
  it('are only the ones the callback sends', () => {
    expect(isGoogleResult('switch')).toBe(true);
    expect(isGoogleResult('ok')).toBe(false);
    expect(isGoogleResult(null)).toBe(false);
  });
});
