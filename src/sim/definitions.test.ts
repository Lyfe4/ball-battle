import { describe, expect, it } from 'vitest';
import { blue, red } from './test-support.ts';
import { getDefinition, indexDefinitions } from './definitions.ts';

describe('indexDefinitions', () => {
  it('looks definitions up by id', () => {
    const lookup = indexDefinitions([red, blue]);
    expect(getDefinition(lookup, 'blue')).toBe(blue);
  });

  it('allows the same definition twice, for mirror matches', () => {
    expect(indexDefinitions([red, red]).size).toBe(1);
  });

  it('rejects two different definitions with the same id', () => {
    expect(() => indexDefinitions([red, { ...blue, id: 'red' }])).toThrow(/share the id/);
  });

  it('throws for a missing id', () => {
    expect(() => getDefinition(indexDefinitions([red]), 'blue')).toThrow(/No ball definition/);
  });
});
