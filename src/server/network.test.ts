import { describe, expect, it } from 'vitest';
import { networkOf } from './network.ts';

describe('the network a client IP stands for', () => {
  it('is an IPv4 address itself: a school, a café or a carrier’s shared address', () => {
    expect(networkOf('203.0.113.7')).toBe('203.0.113.7');
    expect(networkOf('203.0.113.8')).not.toBe(networkOf('203.0.113.7'));
  });

  it('is an IPv6 address’s /64, however the rest changes (a household or a phone)', () => {
    const home = networkOf('2001:db8:aa:bb:1111:2222:3333:4444');
    expect(home).toBe('2001:db8:aa:bb::/64');
    expect(networkOf('2001:db8:aa:bb::1')).toBe(home);
    expect(networkOf('2001:DB8:AA:BB:ffff:ffff:ffff:ffff')).toBe(home);
    expect(networkOf('2001:0db8:00aa:00bb:0:0:0:9%eth0')).toBe(home);
    expect(networkOf('2001:db8:aa:bc::1')).not.toBe(home);
    expect(networkOf('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(networkOf('::1')).toBe('0:0:0:0::/64');
  });

  it('reads an IPv4 address written as IPv6 as that IPv4 address', () => {
    expect(networkOf('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(networkOf('::ffff:cb00:7107')).toBe('203.0.113.7');
  });

  it('keeps anything it can’t read as it is: never two clients as one by mistake', () => {
    expect(networkOf('not-an-ip')).toBe('not-an-ip');
    expect(networkOf('1:2:3:4:5:6:7:8:9')).toBe('1:2:3:4:5:6:7:8:9');
    expect(networkOf('1::2::3')).toBe('1::2::3');
  });
});
