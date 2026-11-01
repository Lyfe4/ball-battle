import type { BallDefinition, DefinitionLookup } from './types.ts';

/** Builds the lookup step() needs. Duplicate ids would make lookups ambiguous, so they throw. */
export function indexDefinitions(definitions: readonly BallDefinition[]): DefinitionLookup {
  const lookup = new Map<string, BallDefinition>();
  for (const definition of definitions) {
    const existing = lookup.get(definition.id);
    if (existing !== undefined && existing !== definition) {
      throw new Error(`Two different ball definitions share the id "${definition.id}"`);
    }
    lookup.set(definition.id, definition);
  }
  return lookup;
}

/** A ball whose definition is missing can only come from a bug, so fail loudly. */
export function getDefinition(definitions: DefinitionLookup, id: string): BallDefinition {
  const definition = definitions.get(id);
  if (definition === undefined) {
    throw new Error(`No ball definition with id "${id}"`);
  }
  return definition;
}
