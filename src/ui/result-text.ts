import type { DefinitionLookup, MatchState, WorldState } from '../sim/types.ts';

/** The result line shown when a match ends, e.g. "Red wins by knockout". Empty while running. */
export function describeResult(
  match: MatchState,
  world: WorldState,
  definitions: DefinitionLookup,
): string {
  if (match.status === 'running') return '';
  if (match.result.kind === 'draw') {
    return match.reason === 'knockout' ? 'Draw: both knocked out' : 'Draw on time';
  }
  const { winnerId } = match.result;
  const winner = world.balls.find((ball) => ball.id === winnerId);
  const name = definitions.get(winner?.definitionId ?? '')?.name ?? winnerId;
  return match.reason === 'knockout' ? `${name} wins by knockout` : `${name} wins on time`;
}
