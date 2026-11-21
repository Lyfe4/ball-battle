// BallBattle's sim at ruleset 23, frozen by `pnpm ruleset:freeze` (ADR 0052). Generated: never edit.
// src/sim/definitions.ts
/** Builds the lookup step() needs. Duplicate ids would make lookups ambiguous, so they throw. */
function indexDefinitions(definitions) {
	const lookup = /* @__PURE__ */ new Map();
	for (const definition of definitions) {
		const existing = lookup.get(definition.id);
		if (existing !== void 0 && existing !== definition) throw new Error(`Two different ball definitions share the id "${definition.id}"`);
		lookup.set(definition.id, definition);
	}
	return lookup;
}
/** A ball whose definition is missing can only come from a bug, so fail loudly. */
function getDefinition(definitions, id) {
	const definition = definitions.get(id);
	if (definition === void 0) throw new Error(`No ball definition with id "${id}"`);
	return definition;
}
/** Seconds of simulated time per tick. */
var DT = 1 / 60;
/** Side length of the square arena in world units, independent of screen size. */
var ARENA_SIZE = 1e3;
/**
* How close two balls must be, beyond touching, to still count as in contact. Covers balls that
* were just separated and drift apart slowly, so one collision is never counted twice.
*/
var CONTACT_SLOP = .5;
/**
* Contact damage scales with how directly the attacker hit: the cosine of its approach angle,
* clamped to [MIN_IMPACT_MULTIPLIER, 1], so a glancing, retreating or standing ball still hurts a
* little (ADR 0002, ADR 0008).
*/
var MIN_IMPACT_MULTIPLIER = .25;
// src/sim/defence.ts
/**
* A hit of `amount` on `target` after its definition's `incomingDamageOf`, as a whole number of 0 or
* more, and the event when its defence took anything. A defence may also raise a hit (the Balloon's
* shots, ADR 0075): `raised` is what it added, and no event marks it. A ball without a defence
* takes the hit whole.
*/
function defendHit(target, sourceId, amount, definitions, tick, via) {
	const { incomingDamageOf } = getDefinition(definitions, target.definitionId);
	if (incomingDamageOf === void 0 || amount <= 0) return {
		rest: amount,
		event: void 0,
		raised: 0
	};
	const defended = incomingDamageOf(target, amount, tick, via);
	if (!Number.isFinite(defended)) throw new Error(`Ball "${target.id}" defended a hit to a non-finite value`);
	const rest = Math.max(0, Math.round(defended));
	if (rest >= amount) return {
		rest,
		event: void 0,
		raised: rest - amount
	};
	return {
		rest,
		event: {
			type: "hitReduced",
			tick,
			ballId: target.id,
			sourceId,
			reduced: amount - rest,
			rest
		},
		raised: 0
	};
}
// src/sim/combat.ts
function isAlive(ball) {
	return ball.health > 0;
}
/** Order-independent key for a pair of balls, as stored in WorldState.contacts. */
function pairKey(idA, idB) {
	return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}
/**
* The contact set for the end of this tick. A pair enters it only by actually colliding (being in
* `collided`), and stays while both balls are alive and within CONTACT_SLOP of touching. Balls
* that merely pass close without overlapping are never in contact, so their real hit next tick
* still counts. Returned sorted so the world is identical however it was built.
*/
function nextContacts(balls, previous, collided) {
	const byId = new Map(balls.map((ball) => [ball.id, ball]));
	return [.../* @__PURE__ */ new Set([...previous, ...collided])].filter((key) => {
		const [idA = "", idB = ""] = key.split("|");
		const a = byId.get(idA);
		const b = byId.get(idB);
		if (a === void 0 || b === void 0 || !isAlive(a) || !isAlive(b)) return false;
		const dx = b.position.x - a.position.x;
		const dy = b.position.y - a.position.y;
		const reach = a.radius + b.radius + CONTACT_SLOP;
		return dx * dx + dy * dy <= reach * reach;
	}).sort();
}
/**
* How much of its contact damage a ball deals, from how directly it hit (the cosine of its
* approach angle, see Contact.directness): full head-on, less for a glancing hit, and the minimum
* for a ball moving away or standing still. Speed does not matter (ADR 0008).
*/
function directnessMultiplier(directness) {
	return Math.min(1, Math.max(MIN_IMPACT_MULTIPLIER, directness));
}
/**
* Damage for one hit, rounded to a whole number so health stays readable. Any hit from a ball with
* contact damage deals at least 1. Math.round is exact, so this is deterministic (ADR 0001).
*/
function impactDamage(contactDamage, multiplier) {
	return contactDamage > 0 ? Math.max(1, Math.round(contactDamage * multiplier)) : 0;
}
/** True while a ball's definition says it is phased (ADR 0026): it passes through other balls. */
function isPhased(ball, definition) {
	return definition.phasedOf?.(ball) ?? false;
}
/**
* The base contact damage a ball deals in its current state: its definition's `contactDamageOf`
* if it declares one, otherwise its `contactDamage` (ADR 0015). Throws for a non-finite or
* negative value, which only a bug can produce.
*/
function contactDamageOf(ball, definition) {
	const damage = definition.contactDamageOf?.(ball, definition) ?? definition.contactDamage;
	if (!Number.isFinite(damage) || damage < 0) throw new Error(`Ball "${ball.id}" has an invalid contact damage (${String(damage)})`);
	return damage;
}
/**
* Applies contact damage for each new contact. Each ball's hit is scaled by how directly it was
* moving at the other before the bounce. Within a pair both hits are worked out from health before the
* exchange. If both hits would be lethal, the ball that dealt the larger raw damage survives on
* 1 health; equal raw damage knocks both out (ADR 0002, lethal-exchange tiebreak).
*/
function applyContactDamage(balls, newContacts, definitions, tick) {
	const byId = new Map(balls.map((ball) => [ball.id, ball]));
	const damage = [];
	const reduced = [];
	const pendingHit = (target, source, directness) => {
		const definition = getDefinition(definitions, source.definitionId);
		const multiplier = directnessMultiplier(directness);
		const times = definition.bumpTimesOf?.(directness) ?? 1;
		return {
			target,
			source,
			raw: impactDamage(contactDamageOf(source, definition) * times, multiplier),
			multiplier,
			times,
			reduced: 0
		};
	};
	const apply = (hit, survives) => {
		const { target, source, raw, multiplier } = hit;
		const healthAfter = survives ? Math.min(target.health, 1) : Math.max(0, target.health - raw);
		const amount = target.health - healthAfter;
		if (amount <= 0 && !survives) return target;
		damage.push({
			type: "damage",
			tick,
			targetId: target.id,
			sourceId: source.id,
			cause: "contact",
			amount,
			healthAfter,
			multiplier,
			survivedLethal: survives,
			...hit.times !== 1 ? { times: hit.times } : {},
			...hit.reduced > 0 ? { reduced: hit.reduced } : {}
		});
		return {
			...target,
			health: healthAfter
		};
	};
	const defend = (hit) => {
		const defended = defendHit(hit.target, hit.source.id, hit.raw, definitions, tick, "contact");
		if (defended.event !== void 0) reduced.push(defended.event);
		return {
			...hit,
			raw: defended.rest,
			reduced: defended.event?.reduced ?? 0
		};
	};
	for (const { ballIds, directness, phased } of newContacts) {
		if (phased) continue;
		const a = byId.get(ballIds[0]);
		const b = byId.get(ballIds[1]);
		if (a === void 0 || b === void 0) continue;
		const toA = defend(pendingHit(a, b, directness[1]));
		const toB = defend(pendingHit(b, a, directness[0]));
		const lethal = (hit) => hit.raw > 0 && hit.raw >= hit.target.health;
		const mutualLethal = isAlive(a) && isAlive(b) && lethal(toA) && lethal(toB);
		byId.set(a.id, apply(toA, mutualLethal && toB.raw > toA.raw));
		byId.set(b.id, apply(toB, mutualLethal && toA.raw > toB.raw));
	}
	return {
		balls: balls.map((ball) => byId.get(ball.id) ?? ball),
		damage,
		reduced
	};
}
/**
* A ballDefeated event for every ball that was alive at the start of the tick and is not now.
* The defeater is the source of the last damage event that hit it this tick.
*/
function defeatsThisTick(before, after, events, tick) {
	const lastHitBy = /* @__PURE__ */ new Map();
	for (const event of events) if (event.type === "damage") lastHitBy.set(event.targetId, event.sourceId);
	const afterById = new Map(after.map((ball) => [ball.id, ball]));
	const defeated = [];
	for (const ball of before) {
		const now = afterById.get(ball.id);
		const defeatedById = lastHitBy.get(ball.id);
		if (now !== void 0 && defeatedById !== void 0 && isAlive(ball) && !isAlive(now)) defeated.push({
			type: "ballDefeated",
			tick,
			ballId: ball.id,
			defeatedById
		});
	}
	return defeated;
}
// src/sim/rng.ts
var GOLDEN_GAMMA = 1831565813;
var UINT32_RANGE = 4294967296;
/** Normalises any number to a valid generator state. Non-finite seeds map to 0. */
function seedRng(seed) {
	return Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
}
/** Returns a float in [0, 1) and the advanced state. */
function nextFloat(state) {
	const next = state + GOLDEN_GAMMA >>> 0;
	let t = next;
	t = Math.imul(t ^ t >>> 15, t | 1);
	t ^= t + Math.imul(t ^ t >>> 7, t | 61);
	return {
		value: ((t ^ t >>> 14) >>> 0) / UINT32_RANGE,
		state: next
	};
}
/** Returns a float in [min, max) and the advanced state. */
function nextRange(state, min, max) {
	const { value, state: next } = nextFloat(state);
	return {
		value: min + value * (max - min),
		state: next
	};
}
/**
* Mixes several integers into one generator state (a murmur3-style finaliser per part). Used to
* give each hook call its own independent stream; see ADR 0003. Integer-only, so exact everywhere.
*/
function deriveSeed(parts) {
	let hash = 2166136261;
	for (const part of parts) {
		hash = Math.imul(hash ^ part >>> 0, 2246822507);
		hash ^= hash >>> 13;
		hash = Math.imul(hash, 3266489909);
		hash ^= hash >>> 16;
	}
	return hash >>> 0;
}
/**
* A stream of floats in [0, 1) starting from `state`. The returned function keeps its own
* position, so it must only be handed to one consumer (one hook call) and never stored in the
* world.
*/
function createStream(state) {
	let current = state;
	return () => {
		const result = nextFloat(current);
		current = result.state;
		return result.value;
	};
}
// src/sim/bounce-variance.ts
/**
* tan(BOUNCE_MAX_ANGLE_DEGREES / 2), precomputed because Math.tan is not allowed in the sim
* (ADR 0001). A test checks it against Math.tan.
*/
var BOUNCE_MAX_HALF_TAN = .06992681194351041;
/**
* Rotates `v` by the angle 2·atan(t), using the rational parametrisation of the circle:
* cos = (1 − t²)/(1 + t²), sin = 2t/(1 + t²). Only + − * /, so it is exact on every engine and
* keeps the speed to within rounding.
*/
function rotateByHalfTan(v, t) {
	const tSquared = t * t;
	const denominator = 1 + tSquared;
	const cos = (1 - tSquared) / denominator;
	const sin = 2 * t / denominator;
	return {
		x: v.x * cos - v.y * sin,
		y: v.x * sin + v.y * cos
	};
}
/** True if `rotated` still moves away from every wall bounced off along the given axes. */
function keepsAwayFromWalls(reflected, rotated, bouncedX, bouncedY) {
	return (!bouncedX || Math.sign(rotated.x) === Math.sign(reflected.x)) && (!bouncedY || Math.sign(rotated.y) === Math.sign(reflected.y));
}
/**
* The reflected velocity turned by 2·atan(t), mirrored to −t if that would point back into a wall
* it just bounced off. A turn can only flip an axis whose component is smaller than |v|·sin of the
* angle, and both components can't be that small at once, so one of ±t always works for a moving
* ball. The unturned fallback is only a guard for a zero velocity.
*/
function turnBounce(reflected, t, bouncedX, bouncedY) {
	for (const candidate of [t, -t]) {
		const rotated = rotateByHalfTan(reflected, candidate);
		if (keepsAwayFromWalls(reflected, rotated, bouncedX, bouncedY)) return rotated;
	}
	return reflected;
}
/**
* Gives every live ball that bounced this tick a small random turn, drawn from the world RNG: one
* draw per bouncing ball, in ball order, however many walls it hit. Positions never change, so
* balls stay inside the arena.
*/
function applyBounceVariance(movements, rngState) {
	let state = rngState;
	return {
		balls: movements.map(({ ball, bounces, bouncesX, bouncesY }) => {
			if (bounces === 0 || !isAlive(ball)) return ball;
			const draw = nextRange(state, -.06992681194351041, BOUNCE_MAX_HALF_TAN);
			state = draw.state;
			return {
				...ball,
				velocity: turnBounce(ball.velocity, draw.value, bouncesX > 0, bouncesY > 0)
			};
		}),
		rngState: state
	};
}
// src/sim/define-ball.ts
/**
* Declares a ball. Inside the definition, hooks see `self.abilityState` as the ball's own type
* `S`; the result is the erased BallDefinition that the registry and step() work with.
*
* This is the one place the two are bridged, with a single cast. It is sound because a ball's
* ability state is only ever created from its own `initialAbilityState` (createWorld) and replaced
* by its own hooks' `setAbilityState` actions (apply-actions.ts), so a hook always receives the
* state shape it declared. See ADR 0003.
*/
function defineBall(definition) {
	return definition;
}
// src/sim/balls/how-it-works.ts
/** Ticks as the seconds a player reads, to one decimal at most: 105 ticks is "1.8". */
function secondsOf(ticks) {
	return String(Math.round(ticks / 60 * 10) / 10);
}
/** A share as a whole percentage: 0.37 is "37%". */
function percentOf(share) {
	return `${String(Math.round(share * 100))}%`;
}
// src/sim/side.ts
/** The side a ball fights for: the id of the ball it was split from, or its own id. */
function sideOf(ball) {
	return ball.side ?? ball.id;
}
/** The side of the ball with this id (an owner of a shot, zone or minion), or the id itself. */
function sideOfId(balls, id) {
	const ball = balls.find((other) => other.id === id);
	return ball === void 0 ? id : sideOf(ball);
}
/** True when `ball` fights for the side of the ball `ownerId`: it is that ball or its ally. */
function isAllyOf(balls, ball, ownerId) {
	return ball.id === ownerId || sideOf(ball) === sideOfId(balls, ownerId);
}
// src/sim/balls/targeting.ts
/**
* The live ball closest to `self` (by centre distance), other than itself; undefined if none.
* Ties go to the earlier ball in the array, so the choice is deterministic. For abilities that act
* on a ball (the Magnet's pull); aimed attacks use `nearestTarget`.
*/
function nearestEnemy(self, balls) {
	let nearest;
	let nearestDistance = Infinity;
	for (const ball of balls) {
		if (sideOf(ball) === sideOf(self) || !isAlive(ball)) continue;
		const dx = ball.position.x - self.position.x;
		const dy = ball.position.y - self.position.y;
		const distance = dx * dx + dy * dy;
		if (distance < nearestDistance) {
			nearest = ball;
			nearestDistance = distance;
		}
	}
	return nearest;
}
/**
* The target an aimed attack picks (ADR 0026): the nearest live enemy ball or enemy minion,
* whichever is closer. One rule for every ball that aims (the Archer, Storm and Sniper), so a
* minion nearer than its owner draws the arrow, the lightning or the shot. A phased ball is aimed at
* like any other; the shot passes through it (ADR 0049). Ties go to the ball, then to the earlier
* one in its array, so the choice is deterministic. A ball is aimed at where `aimPointOf` says (the
* hook context's: the Mirage's copy while it shows, ADR 0077), but which is nearest is measured to
* the ball itself.
*/
function nearestTarget(self, balls, minions, aimPointOf) {
	const ball = nearestEnemy(self, balls);
	let nearest = ball === void 0 ? void 0 : {
		kind: "ball",
		...pick({
			...ball,
			position: aimPointOf(ball)
		})
	};
	let nearestDistance = ball === void 0 ? Infinity : distanceSquared(self.position, ball.position);
	for (const minion of minions) {
		if (sideOfId(balls, minion.ownerId) === sideOf(self)) continue;
		const distance = distanceSquared(self.position, minion.position);
		if (distance < nearestDistance) {
			nearest = {
				kind: "minion",
				...pick(minion)
			};
			nearestDistance = distance;
		}
	}
	return nearest;
}
function pick({ id, position, velocity }) {
	return {
		id,
		position,
		velocity
	};
}
function distanceSquared(a, b) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	return dx * dx + dy * dy;
}
/** World units per second. */
var ARROW_SPEED = 1650;
/**
* tan of half the widest spread, i.e. tan(2°) for up to ±4° either side of the aim. Precomputed
* because Math.tan is not allowed in the sim (ADR 0001).
*/
var SPREAD_HALF_TAN = .03492076949174773;
/**
* Where to aim so an arrow at `arrowSpeed` meets a target moving in a straight line: the target's
* position after time t, for the smallest t > 0 with |D + V·t| = arrowSpeed·t (D from shooter to
* target, V the target's velocity). Solved as a quadratic with only + − * / and Math.sqrt
* (ADR 0001). Falls back to the target's current position if the arrow can never catch it. It
* does not foresee wall bounces.
*/
function leadTarget(shooter, target, targetVelocity, arrowSpeed) {
	const dx = target.x - shooter.x;
	const dy = target.y - shooter.y;
	const a = targetVelocity.x * targetVelocity.x + targetVelocity.y * targetVelocity.y - arrowSpeed * arrowSpeed;
	const halfB = dx * targetVelocity.x + dy * targetVelocity.y;
	const c = dx * dx + dy * dy;
	let t;
	if (a === 0) t = halfB < 0 ? -c / (2 * halfB) : void 0;
	else {
		const discriminant = halfB * halfB - a * c;
		if (discriminant >= 0) {
			const root = Math.sqrt(discriminant);
			const candidates = [(-halfB - root) / a, (-halfB + root) / a].filter((value) => value > 0);
			t = candidates.length > 0 ? Math.min(...candidates) : void 0;
		}
	}
	if (t === void 0) return target;
	return {
		x: target.x + targetVelocity.x * t,
		y: target.y + targetVelocity.y * t
	};
}
/**
* A glass cannon: weak in contact, but every COOLDOWN_TICKS it shoots an arrow at the nearest
* enemy, leading its aim to where the enemy will be when the arrow arrives, with a small random
* spread. The next shot is stored as an absolute
* tick, so the hook does nothing at all between shots.
*/
var archer = defineBall({
	id: "archer",
	name: "Archer",
	description: "Leads an arrow every 1.8 s; frail up close.",
	color: "#22d3ee",
	ability: {
		name: "Arrows",
		shownBy: { kind: "projectileFired" }
	},
	howItWorks: [`Every ${secondsOf(110)} s it shoots an arrow at the nearest enemy for 11, aimed where that enemy is heading.`, "Its own bump is weak, so it wins from afar."],
	radius: 50,
	speed: 780,
	maxHealth: 47,
	contactDamage: 6,
	initialAbilityState: { nextShotTick: 30 },
	hooks: { onTick: ({ world, self, random, aimPointOf }) => {
		const due = self.abilityState.nextShotTick;
		if (world.tick < due) return [];
		const target = nearestTarget(self, world.balls, world.minions, aimPointOf);
		if (target === void 0) return [];
		const aimAt = leadTarget(self.position, target.position, target.velocity, ARROW_SPEED);
		const dx = aimAt.x - self.position.x;
		const dy = aimAt.y - self.position.y;
		const distance = Math.sqrt(dx * dx + dy * dy);
		if (distance === 0) return [];
		return [{
			kind: "spawnProjectile",
			velocity: rotateByHalfTan({
				x: dx / distance * ARROW_SPEED,
				y: dy / distance * ARROW_SPEED
			}, (random() * 2 - 1) * SPREAD_HALF_TAN),
			radius: 6,
			damage: 11,
			lifetimeTicks: 180
		}, {
			kind: "setAbilityState",
			state: { nextShotTick: world.tick + 110 }
		}];
	} }
});
/**
* The most health in the roster (ADR 0015). Every hit it takes, of any kind, stores a point of rage
* (up to MAX_RAGE); its next bump spends it all as extra contact damage (ADR 0045, group 4). Many small hits (poison ticks, burns, a boomerang, skull bites) fill
* it fast; a few big ones barely do. Rage hits are contact hits: directness scales them and Thorns
* reflects them.
*/
var berserker = defineBall({
	id: "berserker",
	name: "Berserker",
	description: "Every hit it takes builds rage; its next bump lets it out.",
	color: "#f97316",
	ability: {
		name: "Rage",
		shownBy: {
			kind: "hook",
			hook: "onHitBall"
		}
	},
	howItWorks: [`Every hit it takes stores rage, up to 3: bumps, shots, poison and burns alike. Hits at the same moment store one; reflected spikes store none.`, `Its next bump lets it all out: 3 extra damage per hit stored, up to 9. The hit it takes back in that bump starts the next.`],
	radius: 50,
	speed: 780,
	maxHealth: 88,
	contactDamage: 18.2,
	initialAbilityState: { rage: 0 },
	contactDamageOf: (self, stats) => stats.contactDamage + 3 * self.abilityState.rage,
	hooks: {
		onHitBall: ({ self }) => self.abilityState.rage === 0 ? [] : [{
			kind: "setAbilityState",
			state: { rage: 0 }
		}],
		onDamageTaken: ({ self }) => self.abilityState.rage >= 3 ? [] : [{
			kind: "setAbilityState",
			state: { rage: self.abilityState.rage + 1 }
		}]
	}
});
// src/sim/balls/brawler.ts
/** The baseline: no ability, just solid stats. Every other ball is balanced against this one. */
var brawler = defineBall({
	id: "brawler",
	name: "Brawler",
	description: "No tricks. Hits hard and takes a beating.",
	color: "#ef4444",
	howItWorks: ["No ability: just its bump.", "Like every ball’s, its bump does full damage head-on and less when it glances."],
	radius: 50,
	speed: 770,
	maxHealth: 67,
	contactDamage: 26,
	initialAbilityState: {},
	hooks: {}
});
// src/sim/status.ts
/** Throws unless `durationTicks` is a whole number of at least 1; only a bug can produce one. */
function assertStatusDuration(kind, durationTicks, sourceId) {
	if (!Number.isInteger(durationTicks) || durationTicks < 1) throw new Error(`"${sourceId}" tried to apply ${kind} for an invalid ${durationTicks} ticks`);
}
/**
* How long a status lasts on a ball that resists it (ADR 0016): the requested duration times the
* share it keeps, rounded to whole ticks but never below 1. A share of 0 means immune, and returns
* 0: the status is not applied at all. No share (undefined) is the full duration.
*/
function resistedDuration(durationTicks, keeps) {
	if (keeps === void 0) return durationTicks;
	if (!Number.isFinite(keeps) || keeps < 0 || keeps > 1) throw new Error(`A status resistance must be a share from 0 to 1, got ${keeps}`);
	return keeps === 0 ? 0 : Math.max(1, Math.round(durationTicks * keeps));
}
/** Share of its cruise speed a slowed ball loses (ADR 0012, 0045). The Frost's lever. */
var SLOW_FACTOR = .45;
/** A slowed ball's cruise speed. */
function slowedSpeed(speed) {
	return speed * .55;
}
/** Share of its cruise speed a held ball keeps (ADR 0075): wrapped, it barely moves. */
var HELD_SHARE = .15;
/** True when a poison first applied on `sinceTick` ticks on `tick`: every interval after it. */
function isPoisonTick(sinceTick, tick) {
	const elapsed = tick - sinceTick;
	return elapsed > 0 && elapsed % 34 === 0;
}
/** True if the ball has a status of this kind. Expired statuses are already removed by `step`. */
function hasStatus(ball, kind) {
	return ball.statuses.some((status) => status.kind === kind);
}
/**
* The ball with `request` applied by `sourceId` on `tick`. A kind it already has is refreshed,
* never stacked: its expiry becomes the later of the two, so a refresh never shortens it, and the
* newest source is recorded; the tick it was first applied is kept. Throws for a duration that is not a whole number of at least 1.
*/
function withStatus(ball, request, sourceId, tick) {
	const { kind, durationTicks } = request;
	assertStatusDuration(kind, durationTicks, sourceId);
	const existing = ball.statuses.find((status) => status.kind === kind);
	const expiresTick = Math.max(existing?.expiresTick ?? 0, tick + durationTicks);
	const status = {
		kind,
		sourceId,
		expiresTick,
		sinceTick: existing?.sinceTick ?? tick
	};
	return {
		ball: {
			...ball,
			statuses: [...ball.statuses.filter((other) => other.kind !== kind), status]
		},
		event: {
			type: "statusApplied",
			tick,
			ballId: ball.id,
			sourceId,
			status: kind,
			expiresTick,
			refreshed: existing !== void 0
		}
	};
}
/** Removes every status whose expiry is `tick` or earlier, with one event per status removed. */
function expireStatuses(balls, tick) {
	const events = [];
	return {
		balls: balls.map((ball) => {
			if (!ball.statuses.some((status) => status.expiresTick <= tick)) return ball;
			for (const status of ball.statuses) if (status.expiresTick <= tick) events.push({
				type: "statusExpired",
				tick,
				ballId: ball.id,
				status: status.kind
			});
			return {
				...ball,
				statuses: ball.statuses.filter((status) => status.expiresTick > tick)
			};
		}),
		events
	};
}
/**
* Slow and sturdy; every hit chills the target. Slowed balls cruise much slower, which cuts what
* speed feeds: the Speedster's speed and the wall bounces that build its stacks, and the Quake's
* wall hits that send out its shockwaves (ADR 0045).
*/
var frost = defineBall({
	id: "frost",
	name: "Frost",
	description: "Slow and sturdy. Every hit slows its enemy right down.",
	color: "#bae6fd",
	ability: {
		name: "Slow",
		shownBy: {
			kind: "status",
			status: "slowed"
		}
	},
	howItWorks: [`Its bump slows the other ball by ${percentOf(SLOW_FACTOR)} for ${secondsOf(270)} s.`, "Each new bump starts the slow again; it never stacks."],
	radius: 50,
	speed: 720,
	maxHealth: 83,
	contactDamage: 22,
	initialAbilityState: {},
	hooks: { onHitBall: ({ other }) => [{
		kind: "applyStatus",
		targetId: other.id,
		status: "slowed",
		durationTicks: 270
	}] }
});
/**
* Every wall bounce sets off a shockwave where it hit: a zone at the impact point that strikes
* WARNING_TICKS later (ADR 0006) and hurts any enemy near it, minions too. Then nothing for
* COOLDOWN_TICKS. The sim clamps the zone into the arena. It needs walls: a slowed Quake reaches them
* less often. Damage only (ADR 0045): many small, wide shockwaves, too small for a rewind to undo and
* a big share of each lost to armor (group 4).
*/
var quake = defineBall({
	id: "quake",
	name: "Quake",
	description: "Its wall hits send out small, wide shockwaves.",
	color: "#78716c",
	ability: {
		name: "Shockwave",
		shownBy: {
			kind: "hook",
			hook: "onWallHit"
		}
	},
	howItWorks: [`Every wall bounce sends out a wide shockwave where it hit: ${secondsOf(12)} s later, 7 to any enemy near it.`, `Then no shockwave for ${secondsOf(12)} s.`],
	radius: 50,
	speed: 760,
	maxHealth: 70,
	contactDamage: 15,
	initialAbilityState: { readyTick: 0 },
	hooks: { onWallHit: ({ world, self }) => {
		if (world.tick < self.abilityState.readyTick) return [];
		return [{
			kind: "spawnZone",
			position: self.position,
			radius: 250,
			damage: 7,
			delayTicks: 12
		}, {
			kind: "setAbilityState",
			state: { readyTick: world.tick + 12 }
		}];
	} }
});
/** World units per second: fast, so the line is what decides a hit, not the flight time. */
var SHOT_SPEED = 2400;
/**
* Locks its aim on the nearest enemy, shows a laser along that line for CHARGE_TICKS, then fires
* one fast, heavy shot down it. The aim is the enemy's position when the charge starts, with no
* leading and no spread: a target that keeps moving is usually off the line by the time the shot
* comes, so the faster the target, the more often it misses. Shots never touch Thorns' spikes.
*/
var sniper = defineBall({
	id: "sniper",
	name: "Sniper",
	description: "Locks on and fires one heavy shot every 2 s.",
	color: "#818cf8",
	ability: {
		name: "Sniper shot",
		shownBy: { kind: "projectileFired" }
	},
	howItWorks: [`It locks onto where the nearest enemy is, shows a laser for ${secondsOf(12)} s, then fires one shot down it for 22.`, `It doesn’t lead, so a moving ball often slips off the line. One shot about every ${secondsOf(117)} s.`],
	radius: 50,
	speed: 780,
	maxHealth: 78,
	contactDamage: 9,
	initialAbilityState: {
		nextChargeTick: 60,
		charge: null
	},
	hooks: { onTick: ({ world, self, aimPointOf }) => {
		const { charge, nextChargeTick } = self.abilityState;
		if (charge !== null) {
			if (world.tick < charge.fireTick) return [];
			return [{
				kind: "spawnProjectile",
				velocity: {
					x: charge.aim.x * SHOT_SPEED,
					y: charge.aim.y * SHOT_SPEED
				},
				radius: 6,
				damage: 22,
				lifetimeTicks: 60
			}, {
				kind: "setAbilityState",
				state: {
					nextChargeTick: world.tick + 105,
					charge: null
				}
			}];
		}
		if (world.tick < nextChargeTick) return [];
		const target = nearestTarget(self, world.balls, world.minions, aimPointOf);
		if (target === void 0) return [];
		const dx = target.position.x - self.position.x;
		const dy = target.position.y - self.position.y;
		const distance = Math.sqrt(dx * dx + dy * dy);
		if (distance === 0) return [];
		const aim = {
			x: dx / distance,
			y: dy / distance
		};
		return [{
			kind: "setAbilityState",
			state: {
				nextChargeTick,
				charge: {
					fireTick: world.tick + 12,
					aim
				}
			}
		}];
	} }
});
/** Extra speed per stack, as a fraction of base speed. */
var SPEED_PER_STACK = .12;
/** Speed the Speedster travels at with `stacks` stacks. */
function speedForStacks(baseSpeed, stacks) {
	return baseSpeed * (1 + SPEED_PER_STACK * stacks);
}
/**
* Every wall bounce adds a stack (a corner is two), up to MAX_STACKS. Hitting a ball cashes the
* stacks in as bonus damage and resets them. Its speed follows its stacks through `cruiseSpeed`
* (ADR 0008): the hooks only change stacks, so nothing can compound the speed past the cap.
*/
var speedster = defineBall({
	id: "speedster",
	name: "Speedster",
	description: "Wall bounces build speed and its next bump’s damage.",
	color: "#facc15",
	ability: {
		name: "Speed hit",
		shownBy: {
			kind: "hookDamage",
			hook: "onHitBall"
		}
	},
	howItWorks: [`Each wall bounce adds a stack (a corner adds two), up to 5. Each stack makes it ${percentOf(SPEED_PER_STACK)} faster.`, `Its next bump spends them all: 2 extra damage a stack, up to 10, as a hit of its own that spikes never reflect.`],
	radius: 50,
	speed: 800,
	maxHealth: 70,
	contactDamage: 14,
	initialAbilityState: { stacks: 0 },
	cruiseSpeed: (state, stats) => speedForStacks(stats.speed, state.stacks),
	topSpeed: speedForStacks(800, 5),
	hooks: {
		onWallHit: ({ self, bounces }) => {
			const stacks = Math.min(5, self.abilityState.stacks + bounces);
			if (stacks === self.abilityState.stacks) return [];
			return [{
				kind: "setAbilityState",
				state: { stacks }
			}];
		},
		onHitBall: ({ self, other }) => {
			const { stacks } = self.abilityState;
			if (stacks === 0) return [];
			return [{
				kind: "damage",
				targetId: other.id,
				amount: stacks * 2
			}, {
				kind: "setAbilityState",
				state: { stacks: 0 }
			}];
		}
	}
});
/**
* A uniformly random point in a disk of `radius` around the origin, by rejection sampling from
* `random` (no trig, ADR 0001). Each try is accepted with probability π/4, so a handful is enough.
*/
function randomOffset(random, radius) {
	for (;;) {
		const x = random() * 2 - 1;
		const y = random() * 2 - 1;
		if (x * x + y * y <= 1) return {
			x: x * radius,
			y: y * radius
		};
	}
}
/**
* Calls down lightning: every COOLDOWN_TICKS it marks a zone around the nearest enemy's current
* position, off by a random amount, which strikes WARNING_TICKS later (ADR 0006). One big hit and
* nothing else (ADR 0045: no more shock). The sim clamps the zone into the arena. The next strike is
* stored as an absolute tick, so onTick does nothing at all in between. A zone already called still
* strikes.
*/
var storm = defineBall({
	id: "storm",
	name: "Storm",
	description: "Calls a big lightning strike on its enemy, after a warning.",
	color: "#93c5fd",
	ability: {
		name: "Lightning",
		shownBy: { kind: "zoneSpawned" }
	},
	howItWorks: [`Every ${secondsOf(105)} s it marks a circle near its enemy. ${secondsOf(52)} s later lightning strikes it for 42.`, "A ball that gets out of the circle in time takes nothing."],
	radius: 50,
	speed: 780,
	maxHealth: 74,
	contactDamage: 11,
	initialAbilityState: { nextStrikeTick: 60 },
	hooks: { onTick: ({ world, self, random, aimPointOf }) => {
		const due = self.abilityState.nextStrikeTick;
		if (world.tick < due) return [];
		const target = nearestTarget(self, world.balls, world.minions, aimPointOf);
		if (target === void 0) return [];
		const offset = randomOffset(random, 60);
		return [{
			kind: "spawnZone",
			position: {
				x: target.position.x + offset.x,
				y: target.position.y + offset.y
			},
			radius: 140,
			damage: 42,
			delayTicks: 52
		}, {
			kind: "setAbilityState",
			state: { nextStrikeTick: world.tick + 105 }
		}];
	} }
});
// src/sim/balls/thorns.ts
/** Share of the contact damage Thorns takes that it reflects back at the attacker. */
var REFLECT_SHARE = .37;
/** Damage reflected for taking `amount` contact damage. Rounded so health stays whole. */
function reflectFor(amount) {
	return Math.round(amount * REFLECT_SHARE);
}
/**
* Covered in spikes: every contact hit it takes bounces part of the damage back at the attacker,
* as Thorns' ability damage (ADR 0012, 0013). Reflection scales with the hit, so the hardest
* hitter hurts itself the most: Thorns is the Brawler's one counter. Arrows and lightning never
* touch it, so they are never reflected. Reflected damage fires no further hooks, so two Thorns
* can't loop.
*/
var thorns = defineBall({
	id: "thorns",
	name: "Thorns",
	description: "Spiked: every bump it takes hurts the attacker back.",
	color: "#16a34a",
	ability: {
		name: "Spikes",
		shownBy: {
			kind: "hookDamage",
			hook: "onDamageTaken"
		}
	},
	howItWorks: [`Every bump it takes hurts the attacker back for ${percentOf(REFLECT_SHARE)} of it, rounded.`, "Only bumps meet its spikes: shots, strikes and poison don’t."],
	radius: 50,
	speed: 727,
	maxHealth: 80,
	contactDamage: 18,
	initialAbilityState: {},
	hooks: { onDamageTaken: ({ attacker, amount, cause }) => {
		if (cause !== "contact") return [];
		const reflected = reflectFor(amount);
		return reflected > 0 ? [{
			kind: "damage",
			targetId: attacker.id,
			amount: reflected
		}] : [];
	} }
});
// src/sim/balls/vampire.ts
/** Fraction of the damage it deals that the Vampire heals. */
var LIFESTEAL = .95;
/** How much faster it travels while thirsty (ADR 0077). */
var THIRST_SPEED = 1.35;
/** Health healed for dealing `amount` damage. Rounded so health stays whole. */
function lifestealFor(amount) {
	return Math.round(amount * LIFESTEAL);
}
/**
* Heals itself for most of the damage its bumps deal, never above its max health, on little health
* of its own: a glass cannon that beats bumpers. Only bumps: it drinks nothing from a ball it never
* touches, so shooters beat it (ADR 0045). Thirst (ADR 0077): any hit that isn't a bump (a shot, a
* strike, a skull, poison) makes it THIRST_SPEED as fast for THIRST_TICKS, so it closes in on what
* hurts it from afar. Its speed follows the state through `cruiseSpeed` (ADR 0008).
*/
var vampire = defineBall({
	id: "vampire",
	name: "Vampire",
	description: "Heals most of what its bumps deal; a hit from afar speeds it up.",
	color: "#a855f7",
	ability: {
		name: "Lifesteal",
		shownBy: { kind: "healed" }
	},
	howItWorks: [
		`It heals ${percentOf(LIFESTEAL)} of what its bumps deal, rounded, never past full health.`,
		"Only bumps heal it: a ball it never touches feeds it nothing.",
		`Any hit that isn't a bump makes it ${percentOf(.3500000000000001)} faster for ${secondsOf(60)} s.`
	],
	radius: 50,
	speed: 750,
	topSpeed: 750 * THIRST_SPEED,
	maxHealth: 37,
	contactDamage: 23,
	initialAbilityState: { thirstyUntil: 0 },
	cruiseSpeed: (state, stats) => state.thirstyUntil > 0 ? stats.speed * THIRST_SPEED : stats.speed,
	hooks: {
		onTick: ({ world, self }) => self.abilityState.thirstyUntil > 0 && world.tick >= self.abilityState.thirstyUntil ? [{
			kind: "setAbilityState",
			state: { thirstyUntil: 0 }
		}] : [],
		onDamageDealt: ({ self, amount, cause }) => {
			if (cause !== "contact") return [];
			const heal = lifestealFor(amount);
			return heal > 0 ? [{
				kind: "heal",
				targetId: self.id,
				amount: heal
			}] : [];
		},
		onDamageTaken: ({ world, self, attacker, cause, amount }) => cause === "contact" || amount <= 0 || attacker.id === self.id ? [] : [{
			kind: "setAbilityState",
			state: { thirstyUntil: world.tick + 60 }
		}]
	}
});
// src/sim/balls/venom.ts
/**
* Every ball Venom touches is poisoned for this long: it takes POISON_DAMAGE of Venom's ability
* damage every POISON_INTERVAL_TICKS (ADR 0012), three ticks in all (the status is removed at the
* start of its expiry tick, hence the one extra tick). Refreshed, never stacked, by every new
* contact, so a Venom that keeps touching its enemy keeps it poisoned.
*/
var POISON_TICKS = 103;
/**
* Light bumps that poison (ADR 0012, 0045). Most of its damage is a few small poison ticks after
* each bump: too small for the Chrono to rewind and never touching the Thorns' spikes, while armor
* takes a share off each one, a fade makes one miss and regrowth heals some back.
*/
var venom = defineBall({
	id: "venom",
	name: "Venom",
	description: "Bumps poison its enemy: a few small hits follow.",
	color: "#84cc16",
	ability: {
		name: "Poison",
		shownBy: {
			kind: "status",
			status: "poisoned"
		}
	},
	howItWorks: [`Its bump poisons: 5 damage every ${secondsOf(34)} s, ${Math.floor(POISON_TICKS / 34)} times.`, "Each new bump starts the poison again; it never stacks."],
	radius: 50,
	speed: 780,
	maxHealth: 71,
	contactDamage: 10,
	initialAbilityState: {},
	hooks: { onHitBall: ({ other }) => [{
		kind: "applyStatus",
		targetId: other.id,
		status: "poisoned",
		durationTicks: POISON_TICKS
	}] }
});
// src/sim/steer.ts
/**
* `velocity` turned toward `toward` (a point) from `position`: the unit heading plus `share` of the
* unit direction to the point, renormalised to the original speed. `share` 0 leaves it alone, 1
* turns it halfway between its heading and the point (or straight at it if it was heading away).
* Only + − * / and Math.sqrt (ADR 0001). A ball standing still, or already on the point, is left
* as it is.
*/
function steerToward(position, velocity, toward, share) {
	const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
	const dx = toward.x - position.x;
	const dy = toward.y - position.y;
	const distance = Math.sqrt(dx * dx + dy * dy);
	if (speed === 0 || distance === 0 || share === 0) return velocity;
	const x = velocity.x / speed + dx / distance * share;
	const y = velocity.y / speed + dy / distance * share;
	const length = Math.sqrt(x * x + y * y);
	if (length === 0) return {
		x: dx / distance * speed,
		y: dy / distance * speed
	};
	return {
		x: x / length * speed,
		y: y / length * speed
	};
}
/** Throws unless `share` is a finite number from 0 to 1; only a bug can produce another. */
function assertSteerShare(share, ownerId) {
	if (!Number.isFinite(share) || share < 0 || share > 1) throw new Error(`An ability of "${ownerId}" tried to steer with an invalid share ${share}`);
}
/** How far each tick of a timed pull turns the enemy's heading toward the Magnet (ADR 0026). */
var PULL_SHARE = .025;
/** Its share: harder than a timed pull, so the shooter is dragged in before it gets loose. */
var HIT_PULL_SHARE = .07;
/** True for a hit from range, which starts a pull at once: a projectile or a minion. */
function startsPull(via) {
	return via === "projectile" || via === "minion";
}
/**
* Every PULL_PERIOD_TICKS it pulls the nearest enemy toward itself for PULL_TICKS: each tick the
* enemy's heading turns toward the Magnet (the `steer` action, ADR 0026). Only direction changes;
* the enemy keeps its own speed, so a pull drags a ball into contact instead of flinging it.
* A hit from range (a projectile or minion, `via`) starts a harder pull at once, unless one is in
* progress or resting (ADR 0058): it reacts to the kind of hit, as the Battery does (ADR 0056), so
* against a ball that never hits from range it is the timed pull alone.
*/
var magnet = defineBall({
	id: "magnet",
	name: "Magnet",
	description: "Pulls every 2 s, and at once when hit from range.",
	color: "#e11d48",
	ability: {
		name: "Pull",
		shownBy: {
			kind: "hook",
			hook: "onTick"
		}
	},
	howItWorks: [
		`Every ${secondsOf(120)} s it pulls the nearest enemy toward it for ${secondsOf(36)} s.`,
		`A shot, throw or minion that hits it starts a harder pull at once, for ${secondsOf(60)} s; the next can start ${secondsOf(60)} s after it ends.`,
		"The pull only turns the other ball; it keeps its own speed."
	],
	radius: 50,
	speed: 760,
	maxHealth: 68,
	contactDamage: 25,
	initialAbilityState: {
		nextPullTick: 60,
		pullUntilTick: 0,
		pullShare: PULL_SHARE,
		hitReadyTick: 0
	},
	hooks: {
		onTick: ({ world, self }) => {
			const { nextPullTick, pullUntilTick, pullShare } = self.abilityState;
			const actions = [];
			let share = pullShare;
			if (world.tick >= nextPullTick) {
				share = world.tick < pullUntilTick ? Math.max(PULL_SHARE, pullShare) : PULL_SHARE;
				actions.push({
					kind: "setAbilityState",
					state: {
						...self.abilityState,
						nextPullTick: world.tick + 120,
						pullUntilTick: Math.max(pullUntilTick, world.tick + 36),
						pullShare: share
					}
				});
			}
			const target = world.tick >= nextPullTick || world.tick < pullUntilTick ? nearestEnemy(self, world.balls) : void 0;
			if (target !== void 0) {
				actions.push({
					kind: "steer",
					targetId: target.id,
					toward: self.position,
					share
				});
				actions.push({
					kind: "setVelocity",
					velocity: steerToward(self.position, self.velocity, target.position, share)
				});
			}
			return actions;
		},
		onDamageTaken: ({ world, self, via }) => {
			const { pullUntilTick, hitReadyTick } = self.abilityState;
			if (!startsPull(via) || world.tick < pullUntilTick || world.tick < hitReadyTick) return [];
			return [{
				kind: "setAbilityState",
				state: {
					...self.abilityState,
					pullUntilTick: world.tick + 60,
					pullShare: HIT_PULL_SHARE,
					hitReadyTick: world.tick + 60 + 60
				}
			}];
		}
	}
});
/** True when a Ghost whose rhythm started at `phase` is phased on `tick`. */
function phasedAt(tick, phase) {
	return phase >= 0 && (tick + phase) % 240 < 70;
}
/**
* Phases (ADR 0049): for PHASE_TICKS of every PHASE_CYCLE_TICKS, from a seeded point in its rhythm,
* nothing touches it. It passes through balls, shots, skulls and bombs, and no hit of any kind
* lands (`incomingDamageOf`). Passing through a ball while phased deals its spectral hit, once per
* pass. One rule, the same against any ball: a phased ball can still be aimed at and pulled, so
* an aimed shot just flies through it.
*/
var ghost = defineBall({
	id: "ghost",
	name: "Ghost",
	description: "Phases every 4 s: slips through all, hitting as it goes.",
	color: "#c4b5fd",
	ability: {
		name: "Phase",
		shownBy: {
			kind: "hookDamage",
			hook: "onHitBall"
		}
	},
	howItWorks: [`It is phased for ${secondsOf(70)} s of every ${secondsOf(240)} s. Then nothing touches it: balls, shots, skulls and bombs pass through, and no hit lands.`, `Passing through a ball while phased hits it for 12, once per pass.`],
	radius: 50,
	speed: 770,
	maxHealth: 65,
	contactDamage: 22,
	initialAbilityState: {
		phase: -1,
		phased: false
	},
	phasedOf: (self) => self.abilityState.phased,
	incomingDamageOf: (self, amount, tick) => phasedAt(tick, self.abilityState.phase) ? 0 : amount,
	hooks: {
		onTick: ({ world, self, random }) => {
			const phase = self.abilityState.phase >= 0 ? self.abilityState.phase : Math.floor(random() * 240);
			const phased = phasedAt(world.tick, phase);
			return phased === self.abilityState.phased && phase === self.abilityState.phase ? [] : [{
				kind: "setAbilityState",
				state: {
					phase,
					phased
				}
			}];
		},
		onHitBall: ({ self, other }) => self.abilityState.phased ? [{
			kind: "damage",
			targetId: other.id,
			amount: 12
		}] : []
	}
});
/**
* A uniformly random unit direction from `random`, by rejection sampling inside the unit circle
* (no trig, ADR 0001). Each try is accepted with probability about π/4.
*/
function randomDirection$1(random) {
	for (;;) {
		const x = random() * 2 - 1;
		const y = random() * 2 - 1;
		const lengthSquared = x * x + y * y;
		if (lengthSquared > 1e-6 && lengthSquared <= 1) {
			const length = Math.sqrt(lengthSquared);
			return {
				x: x / length,
				y: y / length
			};
		}
	}
}
/**
* Every SUMMON_TICKS it raises a minion (ADR 0026): a small skeleton ball launched in a random
* direction at a steady speed, bouncing off the walls like a ball, that pops on the first enemy
* ball it reaches. At most MAX_MINIONS at once. Minions draw aimed attacks when they are nearer
* than the Necromancer, and an area strike clears every minion inside it.
*/
var necromancer = defineBall({
	id: "necromancer",
	name: "Necromancer",
	description: "Keeps a skeleton out that bites and draws aimed shots.",
	color: "#4d7c0f",
	ability: {
		name: "Skeletons",
		shownBy: { kind: "minionSpawned" }
	},
	howItWorks: [
		`Every ${secondsOf(55)} s, if its skull is gone, it raises a new one: one out at a time.`,
		`A skull bounces around and bites the first enemy it reaches for 11.`,
		`A skull lasts ${secondsOf(600)} s. Aimed attacks go for it when it is nearer, and an area hit clears it.`
	],
	radius: 50,
	speed: 760,
	maxHealth: 71,
	contactDamage: 14,
	initialAbilityState: { nextSummonTick: 45 },
	hooks: { onTick: ({ world, self, random }) => {
		if (world.tick < self.abilityState.nextSummonTick) return [];
		const direction = randomDirection$1(random);
		return [{
			kind: "spawnMinion",
			velocity: {
				x: direction.x * 640,
				y: direction.y * 640
			},
			radius: 26,
			damage: 11,
			lifetimeTicks: 600,
			maxAlive: 1
		}, {
			kind: "setAbilityState",
			state: { nextSummonTick: world.tick + 55 }
		}];
	} }
});
/** Back to its oldest moment, if it is charged and has one, and recharge. */
function rewind(state, tick) {
	const oldest = state.history[0];
	if (tick < state.readyTick || oldest === void 0) return [];
	return [{
		kind: "rewind",
		position: {
			x: oldest.x,
			y: oldest.y
		},
		velocity: {
			x: oldest.vx,
			y: oldest.vy
		},
		health: oldest.health
	}, {
		kind: "setAbilityState",
		state: {
			history: [],
			readyTick: tick + 600
		}
	}];
}
/**
* Rewinds big hits (ADR 0034, 0045): when an ability hits it for BIG_HIT or more while it is
* charged, it goes back to where it was a moment earlier, with the health it had then, and
* recharges for RECHARGE_TICKS. That undoes the big hit and little else. A hit that would knock it
* out counts as big, whatever it was. Small hits (poison ticks,
* burns, arrows) and bumps are never rewound, and what has already landed on it stays: a status
* keeps ticking.
*/
var chrono = defineBall({
	id: "chrono",
	name: "Chrono",
	description: `Rewinds a hit of 20 or more, then recharges for ${secondsOf(600)} s.`,
	color: "#d4a373",
	ability: {
		name: "Rewind",
		shownBy: { kind: "rewound" }
	},
	howItWorks: [`When an ability hits it for 20 or more, or would knock it out, it jumps back to where it was up to ${secondsOf(30)} s earlier, with the health it had then.`, `Then it recharges for ${secondsOf(600)} s. Bumps and small hits are never rewound.`],
	radius: 50,
	speed: 770,
	maxHealth: 62,
	contactDamage: 22,
	initialAbilityState: {
		history: [],
		readyTick: 0
	},
	hooks: {
		onTick: ({ world, self }) => {
			if (world.tick % 15 !== 0) return [];
			const { position, velocity, health } = self;
			const moment = {
				x: position.x,
				y: position.y,
				vx: velocity.x,
				vy: velocity.y,
				health
			};
			const history = [...self.abilityState.history, moment].slice(-2);
			return [{
				kind: "setAbilityState",
				state: {
					...self.abilityState,
					history
				}
			}];
		},
		onDamageTaken: ({ world, self, amount, cause }) => cause === "ability" && amount >= 20 ? rewind(self.abilityState, world.tick) : [],
		onKnockedOut: ({ world, self }) => rewind(self.abilityState, world.tick)
	}
});
// src/sim/balls/titan.ts
/** How much the Titan's radius grows each tick, in world units. */
var GROWTH_PER_TICK = .07;
/** How many times its base contact damage it hits for at MAX_RADIUS, rising in step with its size. */
var GROWN_HIT = 1.85;
/** The Titan's radius on `tick`: the standard size at the start, growing to MAX_RADIUS. */
function titanRadius(tick) {
	return Math.min(90, 50 + GROWTH_PER_TICK * tick);
}
/**
* Grows bigger and heavier as the match goes on (ADR 0034): the one ball allowed a different size.
* Its mass is r², so light, fast balls bounce off it while it barely turns; a bigger body is also
* an easier target for arrows, shots and fire. Its bumps grow with it (ADR 0045, group 4): weak
* early, crushing late.
*/
var titan = defineBall({
	id: "titan",
	name: "Titan",
	description: "Grows as the match goes on, and its bumps grow with it.",
	color: "#86efac",
	howItWorks: [`It grows all match, to ${String(90 / 50)} times as wide by ${secondsOf(40 / GROWTH_PER_TICK)} s.`, `Its bump grows with it, to ${String(GROWN_HIT)} times as hard. Heavy, it barely turns when light balls hit it.`],
	radius: 50,
	speed: 750,
	maxHealth: 78,
	contactDamage: 14.5,
	initialAbilityState: {},
	contactDamageOf: (self, stats) => stats.contactDamage * (1 + .8500000000000001 * (self.radius - 50) / 40),
	hooks: {},
	radiusOf: (_self, tick) => titanRadius(tick)
});
/**
* Leaves a trail of short-lived burning patches (ADR 0034): lasting zones (ADR 0006) that burn
* every enemy ball inside on a fixed rhythm, and burn up enemy minions. The whole trail burns on one
* beat, and a ball standing in several patches is burned once (one owner's lasting zones never
* stack, ADR 0045): a steady drip of small burns, so armor takes a share of each, a fade makes a few
* miss and regrowth keeps up. A slow ball lingers in the fire; a fast one is soon through it.
*/
var inferno = defineBall({
	id: "inferno",
	name: "Inferno",
	description: "Leaves a trail of fire that burns. Its burns never stack.",
	color: "#fdba74",
	ability: {
		name: "Fire trail",
		shownBy: { kind: "zoneSpawned" }
	},
	howItWorks: [`Every ${secondsOf(26)} s it leaves a patch of fire behind it that burns for ${secondsOf(130)} s.`, `An enemy in the fire takes 3 every ${secondsOf(13)} s, however many patches it is in.`],
	radius: 50,
	speed: 740,
	maxHealth: 74,
	contactDamage: 7,
	initialAbilityState: {},
	hooks: { onTick: ({ world, self }) => world.tick % 26 === 0 ? [{
		kind: "spawnZone",
		position: self.position,
		radius: 62,
		damage: 3,
		delayTicks: 20,
		linger: {
			ticks: 130,
			pulseEveryTicks: 13
		}
	}] : [] }
});
/** World units per second, out and back: well above any ball's speed, so it always gets home. */
var BOOMERANG_SPEED = 1700;
/** True while `ownerId` has a boomerang in the air. */
function hasBoomerangOut(world, ownerId) {
	return world.projectiles.some((projectile) => projectile.ownerId === ownerId && projectile.returning !== void 0);
}
/**
* Throws a boomerang (ADR 0043): a returning projectile, led at the nearest enemy like an arrow,
* that turns back after TURN_TICKS or at a wall and homes on the Boomerang, which catches it. A hit
* doesn't stop it, so it can hit the same ball going out and coming back: the way back crosses
* whatever is near the Boomerang. It throws again once COOLDOWN_TICKS have passed and the last one
* is home (or lost to a skull, which a boomerang can't fly through).
*/
var boomerang = defineBall({
	id: "boomerang",
	name: "Boomerang",
	description: "Its boomerang hits going out and coming back.",
	color: "#2dd4bf",
	ability: {
		name: "Boomerang",
		shownBy: { kind: "projectileFired" }
	},
	howItWorks: [`Every ${secondsOf(130)} s it throws a boomerang at the nearest enemy for 7. It turns back after ${secondsOf(22)} s or at a wall.`, "It can hit going out and again on the way back, then comes home to be thrown again."],
	radius: 50,
	speed: 760,
	maxHealth: 52,
	contactDamage: 10,
	initialAbilityState: { nextThrowTick: 40 },
	hooks: { onTick: ({ world, self, aimPointOf }) => {
		const due = self.abilityState.nextThrowTick;
		if (world.tick < due || hasBoomerangOut(world, self.id)) return [];
		const target = nearestTarget(self, world.balls, world.minions, aimPointOf);
		if (target === void 0) return [];
		const aimAt = leadTarget(self.position, target.position, target.velocity, BOOMERANG_SPEED);
		const dx = aimAt.x - self.position.x;
		const dy = aimAt.y - self.position.y;
		const distance = Math.sqrt(dx * dx + dy * dy);
		if (distance === 0) return [];
		return [{
			kind: "spawnProjectile",
			velocity: {
				x: dx / distance * BOOMERANG_SPEED,
				y: dy / distance * BOOMERANG_SPEED
			},
			radius: 12,
			damage: 7,
			lifetimeTicks: 240,
			returnAfterTicks: 22
		}, {
			kind: "setAbilityState",
			state: { nextThrowTick: world.tick + 130 }
		}];
	} }
});
/**
* Drops one big bomb every few seconds (ADR 0043, 0045 group 4): a zone (ADR 0006) with a visible
* fuse that blows after FUSE_TICKS, or at once when an enemy touches it after it arms (a trigger).
* The faster a ball goes, the more ground it covers and the more bombs it runs into. Skulls and a
* phased ball pass over a bomb without setting it off, though its blast still catches them.
*/
var bomber = defineBall({
	id: "bomber",
	name: "Bomber",
	description: "Drops a big bomb now and then: it blows when touched.",
	color: "#f91fce",
	ability: {
		name: "Bombs",
		shownBy: { kind: "zoneSpawned" }
	},
	howItWorks: [`Every ${secondsOf(220)} s it drops a bomb that blows after ${secondsOf(210)} s, hitting enemies in the blast for 28.`, "An enemy that runs into an armed bomb sets it off at once."],
	radius: 50,
	speed: 760,
	maxHealth: 62,
	contactDamage: 11,
	initialAbilityState: { nextDropTick: 45 },
	hooks: { onTick: ({ world, self }) => {
		if (world.tick < self.abilityState.nextDropTick) return [];
		return [{
			kind: "spawnZone",
			position: self.position,
			radius: 100,
			damage: 28,
			delayTicks: 210,
			trigger: {
				radius: 44,
				armTicks: 18
			}
		}, {
			kind: "setAbilityState",
			state: { nextDropTick: world.tick + 220 }
		}];
	} }
});
/** Its speed while the shield is planted, as a share of its own (a bit under half). */
var SHIELDED_SPEED = .42;
/** The share of a hit that lands while the shield is planted (rounded down). */
var SHIELDED_SHARE = .5;
var SPEAR_SPEED = 1500;
/** Where in its rhythm a Spartan that started at `phase` is at `tick`. */
function rhythmAt(tick, phase) {
	return (tick + Math.max(0, phase)) % 250;
}
/** True while a Spartan that started its rhythm at `phase` has its shield planted at `tick`. */
function shieldRaisedAt(tick, phase) {
	return rhythmAt(tick, phase) < 135;
}
/** What a planted shield lets through of a hit of `amount`: half, rounded down. */
function shieldedHit(amount) {
	return Math.floor(amount * SHIELDED_SHARE);
}
/**
* Shield and spear: one steady rhythm of about 4 s. For the first part it plants its shield (half
* speed, and every hit, of any kind, does half, rounded down), then lowers it, throws its spear
* where the nearest enemy is (one heavy hit from afar, no lead) and fights in the open for the rest.
* Each match starts the rhythm at a seeded random point, so it never runs in lock-step with another
* ball's timer.
*/
var spartan = defineBall({
	id: "spartan",
	name: "Spartan",
	description: "Plants its shield, then throws its spear.",
	color: "#dc2626",
	ability: {
		name: "Shield and spear",
		shownBy: { kind: "projectileFired" }
	},
	howItWorks: [`Its rhythm is ${secondsOf(250)} s. For ${secondsOf(135)} s its shield is planted: it moves at ${percentOf(SHIELDED_SPEED)} speed and every hit on it is cut to ${percentOf(SHIELDED_SHARE)}, rounded down.`, `Then it throws its spear where the nearest enemy is, for 28, and fights in the open.`],
	radius: 50,
	speed: 730,
	maxHealth: 45,
	contactDamage: 16,
	initialAbilityState: {
		phase: -1,
		raised: false
	},
	cruiseSpeed: (state, stats) => state.raised ? stats.speed * SHIELDED_SPEED : stats.speed,
	incomingDamageOf: (self, amount, tick) => shieldRaisedAt(tick, self.abilityState.phase) ? shieldedHit(amount) : amount,
	hooks: { onTick: ({ world, self, random, aimPointOf }) => {
		const phase = self.abilityState.phase >= 0 ? self.abilityState.phase : Math.floor(random() * 250);
		const raised = shieldRaisedAt(world.tick, phase);
		const mark = raised === self.abilityState.raised && phase === self.abilityState.phase ? [] : [{
			kind: "setAbilityState",
			state: {
				phase,
				raised
			}
		}];
		if (rhythmAt(world.tick, phase) !== 135) return mark;
		const target = nearestTarget(self, world.balls, world.minions, aimPointOf);
		if (target === void 0) return mark;
		const dx = target.position.x - self.position.x;
		const dy = target.position.y - self.position.y;
		const distance = Math.sqrt(dx * dx + dy * dy);
		if (distance === 0) return mark;
		return [...mark, {
			kind: "spawnProjectile",
			velocity: {
				x: dx / distance * SPEAR_SPEED,
				y: dy / distance * SPEAR_SPEED
			},
			radius: 9,
			damage: 28,
			lifetimeTicks: 120
		}];
	} }
});
/**
* Regrows (ADR 0045): HEAL_AMOUNT every HEAL_EVERY_TICKS, all match long, except that every hit it
* takes, of any kind, pauses its regrowth for PAUSE_TICKS. Rare hits are healed back between them;
* a steady stream of small hits keeps it closed and stops the regrowth.
*/
var bloom = defineBall({
	id: "bloom",
	name: "Bloom",
	description: "Regrows once left alone for 2 s; any hit makes it wait again.",
	color: "#f472b6",
	ability: {
		name: "Regrowth",
		shownBy: { kind: "healed" }
	},
	howItWorks: [`Left alone for ${secondsOf(120)} s, it opens and regrows 1 health every ${secondsOf(12)} s.`, "Every hit it takes, of any kind, closes it into a bud and starts the wait again."],
	radius: 50,
	speed: 780,
	maxHealth: 52,
	contactDamage: 21.5,
	initialAbilityState: {
		nextHealTick: 12,
		pausedUntil: 0
	},
	hooks: {
		onTick: ({ world, self }) => {
			const { nextHealTick, pausedUntil } = self.abilityState;
			if (world.tick < nextHealTick || world.tick < pausedUntil) return [];
			return [{
				kind: "heal",
				targetId: self.id,
				amount: 1
			}, {
				kind: "setAbilityState",
				state: {
					nextHealTick: world.tick + 12,
					pausedUntil
				}
			}];
		},
		onDamageTaken: ({ world, self }) => [{
			kind: "setAbilityState",
			state: {
				nextHealTick: Math.max(self.abilityState.nextHealTick, world.tick + 120),
				pausedUntil: world.tick + 120
			}
		}]
	}
});
/** The burst takes this share of the cursed ball's full health. */
var CURSE_SHARE = .27;
/** The burst on a ball of `maxHealth`: CURSE_SHARE of it, rounded, at least 1. */
function curseBurstFor(maxHealth) {
	return Math.max(1, Math.round(maxHealth * CURSE_SHARE));
}
var NO_CURSE = {
	cursedId: "",
	cursedTick: 0,
	burstTick: 0
};
/**
* Curses (ADR 0049): its bump marks the enemy, and CURSE_FUSE_TICKS later the mark bursts for
* CURSE_SHARE of that ball's full health. A bump on a ball already marked does nothing: the
* countdown keeps running. It works the same on any ball; a big ball takes a big burst because it
* is big, and a frail one a small burst. The burst is ability damage from its onTick hook, so it is
* no bump: Thorns' spikes never answer it, and a phased Ghost takes none of it.
*/
var hex = defineBall({
	id: "hex",
	name: "Hex",
	description: "Its bump curses: 3 s later it takes 27% of its health.",
	color: "#d946ef",
	ability: {
		name: "Curse",
		shownBy: {
			kind: "hookDamage",
			hook: "onTick"
		}
	},
	howItWorks: [
		`Its bump marks the other ball. 3 s later the mark bursts for ${percentOf(CURSE_SHARE)} of that ball’s full health.`,
		"A bump on a ball already marked does nothing: the countdown keeps running.",
		`So big balls take big bursts: ${curseBurstFor(80)} on an 80-health ball, ${curseBurstFor(40)} on a 40-health one.`
	],
	radius: 50,
	speed: 770,
	maxHealth: 66,
	contactDamage: 15,
	initialAbilityState: NO_CURSE,
	hooks: {
		onHitBall: ({ world, self, other }) => {
			const { cursedId, burstTick } = self.abilityState;
			if (cursedId === other.id && world.tick < burstTick) return [];
			return [{
				kind: "setAbilityState",
				state: {
					cursedId: other.id,
					cursedTick: world.tick,
					burstTick: world.tick + 180
				}
			}];
		},
		onTick: ({ world, self, maxHealthOf }) => {
			const { cursedId, burstTick } = self.abilityState;
			if (cursedId === "" || world.tick < burstTick) return [];
			const target = world.balls.find((ball) => ball.id === cursedId);
			const clear = {
				kind: "setAbilityState",
				state: NO_CURSE
			};
			if (target === void 0 || target.health <= 0) return [clear];
			return [clear, {
				kind: "damage",
				targetId: cursedId,
				amount: curseBurstFor(maxHealthOf(target))
			}];
		}
	}
});
/** One bounce catches once: a ball caught this recently is not caught again. */
var CATCH_GAP_TICKS = 10;
/** The walls `ball` touches (within `slack`), with where along each wall. */
function wallsTouched(ball, size, slack) {
	const { x, y } = ball.position;
	const reach = ball.radius + slack;
	const touched = [];
	if (x <= reach) touched.push({
		side: 0,
		at: y
	});
	if (x >= size - reach) touched.push({
		side: 1,
		at: y
	});
	if (y <= reach) touched.push({
		side: 2,
		at: x
	});
	if (y >= size - reach) touched.push({
		side: 3,
		at: x
	});
	return touched;
}
/** How fast `ball` is leaving `side` (0 or less: not moving away from it). */
function speedAwayFrom(ball, side) {
	const { x, y } = ball.velocity;
	return side === 0 ? x : side === 1 ? -x : side === 2 ? y : -y;
}
/** The gap between `ball`'s edge and `side`. */
function gapTo(ball, side, size) {
	const { x, y } = ball.position;
	return (side === 0 ? x : side === 1 ? size - x : side === 2 ? y : size - y) - ball.radius;
}
/** True when `ball` has just bounced off `web`: at its wall, inside its reach, moving away. */
function bouncedOff(ball, web, size) {
	const away = speedAwayFrom(ball, web.side);
	const along = web.side < 2 ? ball.position.y : ball.position.x;
	return away > 0 && gapTo(ball, web.side, size) <= away * .016666666666666666 + .5 && Math.abs(along - web.at) < 145;
}
/**
* Webs (ADR 0049, 0060): every wall it bounces off gets a web where it touched, reaching
* WEB_HALF_LENGTH each way. An enemy that bounces off a webbed stretch of wall is nipped for
* WEB_NIP and slowed for WEB_SLOW_TICKS, and the web that caught it is used up (gone): it spins a
* new one on its next bounce off that wall. At most MOST_WEBS at once, each lasting WEB_TICKS; a
* web spun again on the same stretch is moved and renewed, not doubled. A phased ball slips through.
*/
var spider = defineBall({
	id: "spider",
	name: "Spider",
	description: "Its webs on the walls slow and nip balls that bounce off.",
	color: "#d4d4d8",
	ability: {
		name: "Webs",
		shownBy: {
			kind: "hookDamage",
			hook: "onTick"
		}
	},
	howItWorks: [
		"Each wall it bounces off gets a web where it touched.",
		`A ball that bounces off a web takes 3 damage and is slowed for 6 s, and the web snaps.`,
		`Up to 6 webs at once, each lasting 12 s.`
	],
	radius: 50,
	speed: 770,
	maxHealth: 71,
	contactDamage: 18,
	initialAbilityState: {
		webs: [],
		caught: {}
	},
	hooks: {
		onWallHit: ({ world, self }) => {
			const size = world.arena.size;
			let webs = self.abilityState.webs.filter((web) => web.until > world.tick);
			const { x, y } = self.velocity;
			const speed = Math.sqrt(x * x + y * y);
			for (const { side, at } of wallsTouched(self, size, speed * DT + 1)) {
				webs = webs.filter((web) => web.side !== side || Math.abs(web.at - at) >= 145);
				webs.push({
					side,
					at,
					since: world.tick,
					until: world.tick + 720
				});
			}
			if (webs.length > 6) webs = webs.slice(webs.length - 6);
			return [{
				kind: "setAbilityState",
				state: {
					...self.abilityState,
					webs
				}
			}];
		},
		onTick: ({ world, self, isPhased }) => {
			const size = world.arena.size;
			let webs = self.abilityState.webs.filter((web) => web.until > world.tick);
			const live = webs.length;
			const actions = [];
			const caught = { ...self.abilityState.caught };
			for (const ball of world.balls) {
				if (ball.id === self.id || ball.health <= 0 || isPhased(ball)) continue;
				if ((caught[ball.id] ?? -10) > world.tick - CATCH_GAP_TICKS) continue;
				const web = webs.find((one) => bouncedOff(ball, one, size));
				if (web === void 0) continue;
				webs = webs.filter((one) => one !== web);
				caught[ball.id] = world.tick;
				actions.push({
					kind: "damage",
					targetId: ball.id,
					amount: 3
				}, {
					kind: "applyStatus",
					targetId: ball.id,
					status: "slowed",
					durationTicks: 360
				});
			}
			if (actions.length === 0 && live === self.abilityState.webs.length) return [];
			return [{
				kind: "setAbilityState",
				state: {
					webs,
					caught
				}
			}, ...actions];
		}
	}
});
/** True for the hits it stores part of: big strikes and blasts (zones) and bursts (onTick). */
function storesHit(via, amount) {
	return amount >= 15 && (via === "zone" || via === "onTick");
}
/**
* Stores part of every big strike, blast or burst that hits it, and its next bump lets it all out
* as extra contact damage (ADR 0056; hitting harder is contactDamageOf, ADR 0015). Bumps, shots,
* arrows, burns and poison are never stored. Its defence reads what dealt the hit (`via`).
*/
var battery = defineBall({
	id: "battery",
	name: "Battery",
	description: "Stores big strikes and blasts; its next bump lets them out.",
	color: "#2563eb",
	ability: {
		name: "Store",
		shownBy: { kind: "hitReduced" }
	},
	howItWorks: [`A strike, blast or burst of 15 or more lands at ${percentOf(.6699999999999999)}: it stores the rest, up to 40.`, "Its next bump adds everything stored. Bumps and shots are never stored."],
	radius: 50,
	speed: 870,
	maxHealth: 70,
	contactDamage: 23.5,
	initialAbilityState: { stored: 0 },
	incomingDamageOf: (_self, amount, _tick, via) => storesHit(via, amount) ? Math.ceil(amount * .6699999999999999) : amount,
	contactDamageOf: (self, stats) => stats.contactDamage + self.abilityState.stored,
	hooks: {
		onHitBall: ({ self }) => self.abilityState.stored === 0 ? [] : [{
			kind: "setAbilityState",
			state: { stored: 0 }
		}],
		onDamageTaken: ({ self, reduced }) => reduced <= 0 ? [] : [{
			kind: "setAbilityState",
			state: { stored: Math.min(40, self.abilityState.stored + reduced) }
		}]
	}
});
// src/sim/balls/slime.ts
/** It splits the first time a hit leaves it at this share of its full health or less. */
var SPLIT_AT = .5;
/** Each half cruises at this multiple of the Slime's speed... */
var HALF_SPEED = 1.2;
/** ... and bumps for this share of its bump. */
var HALF_BUMP = .85;
/**
* Split (ADR 0060): the first time a hit leaves it at half its health or less, it splits into two
* small, quicker slimes on its side (the split action, ADR 0059) that share what it has left, the
* first half taking the odd point. The enemy has to finish both. Any hit, from anything, can split
* it; a ball split from it never splits again.
*/
var slime = defineBall({
	id: "slime",
	name: "Slime",
	description: "At half health it splits in two; finish both to win.",
	color: "#e8f580",
	ability: {
		name: "Split",
		shownBy: { kind: "split" }
	},
	howItWorks: [`The first hit that leaves it at ${percentOf(SPLIT_AT)} health or less splits it into two small slimes sharing what is left.`, `Each half is ${percentOf(.19999999999999996)} faster and bumps for ${percentOf(HALF_BUMP)}. Both must be knocked out.`],
	radius: 50,
	speed: 760,
	maxHealth: 76,
	contactDamage: 24,
	initialAbilityState: { split: false },
	radiusOf: (self) => self.abilityState.split ? 30 : 50,
	cruiseSpeed: (state, stats) => state.split ? stats.speed * HALF_SPEED : stats.speed,
	contactDamageOf: (self, stats) => self.abilityState.split ? stats.contactDamage * HALF_BUMP : stats.contactDamage,
	hooks: { onDamageTaken: ({ self, stats }) => {
		const { health } = self;
		if (self.abilityState.split || health > stats.maxHealth * .5 || health < 2) return [];
		const left = Math.max(2, Math.round(health));
		const keep = Math.ceil(left / 2);
		return [{
			kind: "setAbilityState",
			state: { split: true }
		}, {
			kind: "split",
			keepHealth: keep,
			splitHealth: left - keep,
			state: { split: true },
			spread: 30
		}];
	} }
});
// src/sim/balls/balloon.ts
/** Share of an area hit (fire, a bomb, a shockwave, lightning) that lands: it floats over them. */
var AREA_SHARE = .55;
/** How much harder a shot hits it: a shot pops a balloon. */
var SHOT_TIMES = 1.4;
/** True for the hits that strike the court: a zone's strike or a lasting zone's pulse. */
function isAreaHit(via) {
	return via === "zone" || via === "zonePulse";
}
/**
* Floats (ADR 0075): area hits pass under it, so a strike, blast, shockwave or burn lands at
* AREA_SHARE, and anything shot at it lands SHOT_TIMES as hard. Bumps, skulls, poison and hooks'
* own damage land as they are. Its defence reads what dealt the hit (`via`), on both damage paths.
*/
var balloon = defineBall({
	id: "balloon",
	name: "Balloon",
	description: "Floats: area hits do half; shots hit it harder.",
	color: "#ff6b6b",
	ability: {
		name: "Float",
		shownBy: { kind: "hitReduced" }
	},
	howItWorks: [`Fire, bombs, shockwaves and lightning land at ${percentOf(AREA_SHARE)}: they pass under it.`, `Every shot hits it for ${percentOf(SHOT_TIMES)}. Bumps land as they are.`],
	radius: 50,
	speed: 760,
	maxHealth: 76,
	contactDamage: 24,
	initialAbilityState: {},
	incomingDamageOf: (_self, amount, _tick, via) => isAreaHit(via) ? amount * AREA_SHARE : via === "projectile" ? amount * SHOT_TIMES : amount,
	hooks: {}
});
/**
* Wails (ADR 0075): every WAIL_EVERY_TICKS it hits every enemy ball within WAIL_RADIUS for
* WAIL_DAMAGE, and nothing blocks it: no shield, phasing or floating takes any of it (an
* `unblockable` damage action). Its own bump is weak, so most of what it deals is the wail.
*/
var banshee = defineBall({
	id: "banshee",
	name: "Banshee",
	description: "Every few seconds it wails all around; nothing blocks it.",
	color: "#a0729f",
	ability: {
		name: "Wail",
		shownBy: {
			kind: "hookDamage",
			hook: "onTick"
		}
	},
	howItWorks: [`Every ${secondsOf(170)} s it wails: 33 to every enemy within 320, a third of the court.`, "No shield, phasing or floating takes any of it. Its bump is weak."],
	radius: 50,
	speed: 770,
	maxHealth: 56,
	contactDamage: 4,
	initialAbilityState: { nextWailTick: 120 },
	hooks: { onTick: ({ world, self }) => {
		if (world.tick < self.abilityState.nextWailTick) return [];
		const actions = [{
			kind: "setAbilityState",
			state: { nextWailTick: world.tick + 170 }
		}];
		for (const ball of world.balls) {
			if (sideOf(ball) === sideOf(self) || ball.health <= 0) continue;
			const dx = ball.position.x - self.position.x;
			const dy = ball.position.y - self.position.y;
			const reach = 320 + ball.radius;
			if (dx * dx + dy * dy <= reach * reach) actions.push({
				kind: "damage",
				targetId: ball.id,
				amount: 33,
				unblockable: true
			});
		}
		return actions;
	} }
});
/** The Kraken's own speed while it holds a ball, as a share: it anchors to squeeze. */
var ANCHOR_SHARE = .3;
/** Tentacles that wrap a ball of `radius`: 2 for a standard ball or a Slime half, 4 for a grown Titan. */
function tentaclesFor(radius) {
	const byWidth = Math.round(2 * radius / 50);
	return Math.max(2, byWidth);
}
var sameHolds = (a, b) => {
	const ids = Object.keys(a);
	return ids.length === Object.keys(b).length && ids.every((id) => a[id] === b[id]);
};
var within = (spot, ball) => {
	const dx = spot.x - ball.position.x;
	const dy = spot.y - ball.position.y;
	return Math.sqrt(dx * dx + dy * dy) <= 90 + ball.radius;
};
/**
* Tentacles (ADR 0075): every GRAB_EVERY_TICKS, once it holds nothing, it marks a spot where each
* enemy ball will be RIPPLE_TICKS later if it keeps its line, and ripples show there. Then the
* tentacles burst up: a ball within GRAB_REACH of a spot (never a phased one) is held, cruising at
* HELD_SHARE of its speed, and after HOLD_TICKS crushed once for CRUSH_PER_TENTACLE a tentacle, a
* wider ball getting more. The Kraken anchors (ANCHOR_SHARE of its speed) while it holds.
*/
var kraken = defineBall({
	id: "kraken",
	name: "Kraken",
	description: "Tentacles rise and crush its enemy; big balls get more.",
	color: "#0891b2",
	ability: {
		name: "Tentacles",
		shownBy: {
			kind: "status",
			status: "held"
		}
	},
	howItWorks: [`Every ${secondsOf(230)} s ripples mark where its enemy is heading; ${secondsOf(30)} s later tentacles rise there and wrap it.`, `A wrapped ball moves at ${percentOf(HELD_SHARE)}; after ${secondsOf(90)} s it is crushed for 6 a tentacle: 12 on most balls, more on big ones. It anchors while it squeezes.`],
	radius: 50,
	speed: 760,
	maxHealth: 62,
	contactDamage: 16,
	initialAbilityState: {
		nextGrabTick: 90,
		burstTick: -1,
		spots: [],
		holds: {}
	},
	cruiseSpeed: (state, stats) => Object.keys(state.holds).length > 0 ? stats.speed * ANCHOR_SHARE : stats.speed,
	hooks: { onTick: ({ world, self, isPhased }) => {
		const state = self.abilityState;
		const { tick } = world;
		const enemies = world.balls.filter((ball) => sideOf(ball) !== sideOf(self) && ball.health > 0);
		const actions = [];
		let { nextGrabTick, burstTick, spots } = state;
		const holds = {};
		for (const [id, crushTick] of Object.entries(state.holds)) {
			const ball = enemies.find((enemy) => enemy.id === id);
			if (ball === void 0) continue;
			if (crushTick > tick) holds[id] = crushTick;
			else {
				const amount = 6 * tentaclesFor(ball.radius);
				actions.push({
					kind: "damage",
					targetId: id,
					amount
				});
			}
		}
		if (burstTick < 0 && tick >= nextGrabTick && Object.keys(holds).length === 0) {
			const ahead = 30 / 60;
			const size = world.arena.size;
			spots = enemies.map((ball) => ({
				x: Math.min(size, Math.max(0, ball.position.x + ball.velocity.x * ahead)),
				y: Math.min(size, Math.max(0, ball.position.y + ball.velocity.y * ahead))
			}));
			burstTick = tick + 30;
		}
		if (burstTick >= 0 && tick >= burstTick) {
			for (const ball of enemies) {
				if (isPhased(ball) || !spots.some((spot) => within(spot, ball))) continue;
				holds[ball.id] = tick + 90;
				actions.push({
					kind: "applyStatus",
					targetId: ball.id,
					status: "held",
					durationTicks: 90
				});
			}
			burstTick = -1;
			spots = [];
			nextGrabTick = tick + 200;
		}
		if (nextGrabTick === state.nextGrabTick && burstTick === state.burstTick && spots === state.spots && sameHolds(holds, state.holds)) return actions;
		return [{
			kind: "setAbilityState",
			state: {
				nextGrabTick,
				burstTick,
				spots,
				holds
			}
		}, ...actions];
	} }
});
/** The eight sides a copy can hang on, as unit vectors (no trig, ADR 0001). */
var SIDES = [
	[1, 0],
	[.7071, .7071],
	[0, 1],
	[-.7071, .7071],
	[-1, 0],
	[-.7071, -.7071],
	[0, -1],
	[.7071, -.7071]
];
/** Where the copy of a Mirage at `position` hangs, kept inside a court of `size`. */
function copyPosition(position, state, size) {
	const clamp = (value) => Math.min(size - 40, Math.max(40, value));
	return {
		x: clamp(position.x + state.copyDx),
		y: clamp(position.y + state.copyDy)
	};
}
/**
* A shimmering copy (ADR 0077): a copy of it hangs COPY_OFFSET away on one of eight sides, and every
* aimed attack at the Mirage aims at the copy instead (its `decoyOf`, read by `nearestTarget`).
* A shot passing within COPY_POP_REACH of the copy, or a strike landing there, pops it; it comes
* back COPY_BACK_TICKS later on a side picked at random. The copy has no body: nothing bumps it, it
* deals nothing, and it never draws an attack aimed at another ball (unlike the Necromancer's skull,
* a minion that fights and draws shots by being nearer). Bumps reach the Mirage as normal.
*/
var mirage = defineBall({
	id: "mirage",
	name: "Mirage",
	description: "A shimmering copy hangs beside it: aimed shots go for the copy.",
	color: "#fda4af",
	ability: {
		name: "Copy",
		shownBy: {
			kind: "hook",
			hook: "onTick"
		}
	},
	howItWorks: [
		`Its copy hangs ${String(170)} away. Arrows, spears, boomerangs, lightning and shots aim at the copy while it shows.`,
		`A shot or a strike reaching the copy pops it; it comes back ${secondsOf(230)} s later on another side.`,
		"Bumps, poison and anything not aimed reach the Mirage as normal."
	],
	radius: 50,
	speed: 770,
	maxHealth: 76,
	contactDamage: 23.5,
	initialAbilityState: {
		copyOn: false,
		copyDx: 0,
		copyDy: 0,
		backAt: 30
	},
	decoyOf: (self, size) => self.abilityState.copyOn ? copyPosition(self.position, self.abilityState, size) : void 0,
	hooks: { onTick: ({ world, self, random }) => {
		const s = self.abilityState;
		if (!s.copyOn) {
			if (world.tick < s.backAt) return [];
			const [x, y] = SIDES[Math.floor(random() * SIDES.length)] ?? SIDES[0];
			return [{
				kind: "setAbilityState",
				state: {
					copyOn: true,
					copyDx: x * 170,
					copyDy: y * 170,
					backAt: world.tick
				}
			}];
		}
		const at = copyPosition(self.position, s, world.arena.size);
		const reaches = (position, radius) => {
			const dx = position.x - at.x;
			const dy = position.y - at.y;
			const reach = 60 + radius;
			return dx * dx + dy * dy <= reach * reach;
		};
		const ours = (ownerId) => world.balls.some((ball) => ball.id === ownerId && sideOf(ball) === sideOf(self));
		return world.projectiles.some((shot) => !ours(shot.ownerId) && reaches(shot.position, shot.radius)) || world.zones.some((zone) => !ours(zone.ownerId) && zone.strikeTick === world.tick && reaches(zone.position, zone.radius)) ? [{
			kind: "setAbilityState",
			state: {
				...s,
				copyOn: false,
				backAt: world.tick + 230
			}
		}] : [];
	} }
});
/** How much faster it travels while charging. */
var CHARGE_SPEED = 1.5;
/** Any other bump lands at this share: the lance glances off. */
var GLANCE_SHARE = .4;
var SPEED = 770;
var BUMP = 11;
var BALL_LOOKUP = indexDefinitions([
	brawler,
	speedster,
	vampire,
	archer,
	storm,
	frost,
	thorns,
	venom,
	berserker,
	sniper,
	quake,
	magnet,
	ghost,
	necromancer,
	chrono,
	titan,
	inferno,
	boomerang,
	bomber,
	spartan,
	bloom,
	hex,
	spider,
	battery,
	slime,
	balloon,
	banshee,
	kraken,
	mirage,
	defineBall({
		id: "jouster",
		name: "Jouster",
		description: "Its lance hits triple head-on, but barely scratches at a glance.",
		color: "#a16207",
		ability: {
			name: "Lance",
			shownBy: {
				kind: "hook",
				hook: "onTick"
			}
		},
		howItWorks: [`Every ${secondsOf(150)} s it charges straight at its enemy, ${percentOf(.5)} faster for up to ${secondsOf(60)} s.`, `A head-on bump does ${String(3)} times its ${String(BUMP)}; a glancing one ${percentOf(GLANCE_SHARE)} of it.`],
		radius: 50,
		speed: SPEED,
		maxHealth: 66,
		contactDamage: BUMP,
		initialAbilityState: {
			nextCharge: 60,
			chargeEnds: 0,
			charging: false
		},
		cruiseSpeed: (state, stats) => state.charging ? stats.speed * CHARGE_SPEED : stats.speed,
		topSpeed: SPEED * CHARGE_SPEED,
		bumpTimesOf: (directness) => directness >= .85 ? 3 : GLANCE_SHARE,
		hooks: {
			onTick: ({ world, self }) => {
				const s = self.abilityState;
				const tick = world.tick;
				const target = nearestEnemy(self, world.balls);
				if (tick >= s.nextCharge && target !== void 0) {
					const dx = target.position.x - self.position.x;
					const dy = target.position.y - self.position.y;
					const distance = Math.sqrt(dx * dx + dy * dy);
					if (distance === 0) return [];
					return [{
						kind: "setAbilityState",
						state: {
							nextCharge: tick + 150,
							chargeEnds: tick + 60,
							charging: true
						}
					}, {
						kind: "setVelocity",
						velocity: {
							x: dx / distance * SPEED,
							y: dy / distance * SPEED
						}
					}];
				}
				return s.charging && tick >= s.chargeEnds ? [{
					kind: "setAbilityState",
					state: {
						...s,
						charging: false
					}
				}] : [];
			},
			onHitBall: ({ self }) => self.abilityState.charging ? [{
				kind: "setAbilityState",
				state: {
					...self.abilityState,
					charging: false
				}
			}] : []
		}
	})
]);
// src/sim/counter-map-batch-3.ts
/**
* Each counter was measured before it was kept (ADR 0026). The Magnet's pull forces a brawl, so it
* beats the balls that are weak up close and loses to Thorns, whose spikes it drags into itself.
* The Ghost's phasing stops contact hits, so it beats the Speedster, whose whole game is contact,
* and loses to every ball whose attacks never needed contact. Minions draw aimed attacks, so the
* Necromancer beats the Archer and Sniper; an area strike clears its minion. ADR 0028 made phasing
* one rule (a phased ball can't be touched, gripped or aimed at), so the Ghost is favoured over the
* Magnet and the Necromancer.
* Every pair with the Storm, Quake, Berserker, Vampire, Archer, Sniper or Boomerang moved to the
* counter-map-rules-out-*.ts files with ADR 0045, which removed the interaction rules, and every
* other pair with the Chrono, Guardian, Ghost, Bloom or Venom to counter-map-hit-kinds-*.ts with
* the redesign's second group.
*/
var BATCH_THREE_ENTRIES = [
	{
		x: "brawler",
		y: "magnet",
		intended: "even",
		reason: "No tricks either way: plain hits decide it."
	},
	{
		x: "magnet",
		y: "speedster",
		intended: "even",
		reason: "The pull turns it off the walls, but the stacks it does build rush in hard: even."
	},
	{
		x: "magnet",
		y: "frost",
		intended: "y",
		level: "strong",
		reason: "The pull drags it into a brawl with the sturdy Frost, slowed by every bump and outlasted."
	},
	{
		x: "thorns",
		y: "magnet",
		intended: "x",
		level: "strong",
		reason: "The Magnet drags the spikes into itself, and every hard hit comes back."
	},
	{
		x: "brawler",
		y: "necromancer",
		intended: "even",
		reason: "No tricks either way: plain hits decide it."
	},
	{
		x: "necromancer",
		y: "speedster",
		intended: "even",
		reason: "Minions pop on the fastest ball, but it reaches the Necromancer quickly."
	},
	{
		x: "necromancer",
		y: "frost",
		intended: "y",
		level: "edge",
		reason: "Skeletons chip the sturdy Frost, but its big health wins the contacts in between."
	},
	{
		x: "necromancer",
		y: "thorns",
		intended: "even",
		reason: "Minion pops never touch the spikes, but Thorns wins the contacts."
	},
	{
		x: "magnet",
		y: "necromancer",
		intended: "x",
		level: "edge",
		reason: "Every skull bite starts a pull that drags the Necromancer into its bumps."
	}
];
// src/sim/counter-map-batch-4.ts
/**
* Each counter was measured before it was kept (ADR 0034). The Chrono's rewind undoes the last
* half second, so it undoes a single big hit (a stacked rush, a strike, a shot) and little of a
* drip: what a Vampire drank and poison still on it are not rewound. The Titan's growing body
* meets its enemy more often and shrugs light balls off, so light hitters lose the trade; spikes
* and fire get more of it. The Inferno's fire burns what lingers or crosses it, phased or not, and
* burns skulls up; a fast ball outruns it and a ranged one never crosses it.
* Every pair with the Storm, Quake, Berserker, Vampire, Archer, Sniper or Boomerang moved to the
* counter-map-rules-out-*.ts files with ADR 0045, which removed the interaction rules, and every
* other pair with the Chrono, Guardian, Ghost, Bloom or Venom to counter-map-hit-kinds-*.ts with
* the redesign's second group.
*/
var BATCH_FOUR_ENTRIES = [
	{
		x: "brawler",
		y: "titan",
		intended: "even",
		reason: "No tricks either way: plain hits decide it."
	},
	{
		x: "titan",
		y: "speedster",
		intended: "x",
		level: "edge",
		reason: "Its rush lands while the Titan is small; once grown, the giant’s bumps outweigh it."
	},
	{
		x: "titan",
		y: "frost",
		intended: "even",
		reason: "Two heavy bumpers: the giant’s growth and the cold’s slow cancel out."
	},
	{
		x: "thorns",
		y: "titan",
		intended: "x",
		level: "edge",
		reason: "The bigger it grows, the harder each bump comes back off the spikes."
	},
	{
		x: "titan",
		y: "magnet",
		intended: "even",
		reason: "The pull forces the brawl both of them want."
	},
	{
		x: "titan",
		y: "necromancer",
		intended: "even",
		reason: "The growing body meets the skull often, but the Necromancer keeps raising another."
	},
	{
		x: "brawler",
		y: "inferno",
		intended: "even",
		reason: "No tricks either way: plain hits decide it."
	},
	{
		x: "speedster",
		y: "inferno",
		intended: "x",
		level: "edge",
		reason: "It races through the fire, and its bumps outhit the Inferno’s light ones between burns."
	},
	{
		x: "inferno",
		y: "frost",
		intended: "even",
		reason: "The slowest ball lingers in the fire, but hits hard enough to pay it back."
	},
	{
		x: "inferno",
		y: "thorns",
		intended: "x",
		level: "edge",
		reason: "Fire never touches the spikes, and it burns the slow Thorns all match."
	},
	{
		x: "magnet",
		y: "inferno",
		intended: "even",
		reason: "The pull drags it into a brawl, and into its own fire too."
	},
	{
		x: "inferno",
		y: "necromancer",
		intended: "x",
		level: "edge",
		reason: "The fire burns up the skulls, and the Necromancer behind them."
	},
	{
		x: "inferno",
		y: "titan",
		intended: "even",
		reason: "A growing giant crosses more fire, but it grows big soon and bumps back hard: even."
	}
];
// src/sim/counter-map-batch-5.ts
/**
* Each counter was measured before it was kept (ADR 0043). A boomerang chips twice a throw from
* range, so phasing and fire answer it poorly; a fast ball outruns it, a bigger body wins the
* trades and a skull stops it dead. Bombs punish whoever covers the most ground, and a ball that
* shoots from range crosses them least.
* Every pair with the Storm, Quake, Berserker, Vampire, Archer, Sniper or Boomerang moved to the
* counter-map-rules-out-*.ts files with ADR 0045, which removed the interaction rules, and every
* other pair with the Chrono, Guardian, Ghost, Bloom or Venom to counter-map-hit-kinds-*.ts with
* the redesign's second group.
*/
var BATCH_FIVE_ENTRIES = [
	{
		x: "brawler",
		y: "bomber",
		intended: "even",
		reason: "It runs into bombs like anyone, and hits hard when it gets there."
	},
	{
		x: "bomber",
		y: "speedster",
		intended: "x",
		level: "strong",
		reason: "The fastest ball covers the most ground, so it runs into the most bombs, each a big blast."
	},
	{
		x: "frost",
		y: "bomber",
		intended: "even",
		reason: "The slowest ball runs into few bombs, but it can’t outrun a blast either."
	},
	{
		x: "thorns",
		y: "bomber",
		intended: "y",
		level: "edge",
		reason: "Blasts never touch the spikes, and the slow Thorns can’t keep clear of the bombs."
	},
	{
		x: "magnet",
		y: "bomber",
		intended: "even",
		reason: "The pull drags it across the bombs, and its heavy hits pay them back."
	},
	{
		x: "necromancer",
		y: "bomber",
		intended: "y",
		level: "edge",
		reason: "A blast hits harder than a skull bites, and it clears the skull for a while too."
	},
	{
		x: "titan",
		y: "bomber",
		intended: "even",
		reason: "A growing giant sets off more bombs, and its growing bumps pay them back."
	},
	{
		x: "inferno",
		y: "bomber",
		intended: "y",
		level: "edge",
		reason: "Both lie in wait, but one blast hits harder than the burns it takes crossing the fire."
	}
];
// src/sim/counter-map-first.ts
/**
* The Brawler as the safe pick, even against everyone but Thorns, its one designed counter
* (docs/vision.md, ADR 0013). Frost (ADR 0012) slows, so it beats the Speedster; Venom (ADR 0014)
* is favoured against Thorns. The Frost and Venom are even again since ADR 0028 removed the cold's
* resistance to poison.
* Every pair with the Storm, Quake, Berserker, Vampire, Archer, Sniper or Boomerang moved to the
* counter-map-rules-out-*.ts files with ADR 0045, which removed the interaction rules, and every
* other pair with the Chrono, Guardian, Ghost, Bloom or Venom to counter-map-hit-kinds-*.ts with
* the redesign's second group.
*/
var FIRST_ENTRIES = [
	{
		x: "brawler",
		y: "speedster",
		intended: "even",
		reason: "No tricks either way: plain hits decide it."
	},
	{
		x: "frost",
		y: "speedster",
		intended: "x",
		level: "strong",
		reason: "Slowed, it loses its speed and the wall bounces that build its stacks."
	},
	{
		x: "brawler",
		y: "frost",
		intended: "y",
		level: "edge",
		reason: "Plain bumps both ways, and the Frost’s bigger health outlasts the Brawler’s harder ones."
	},
	{
		x: "thorns",
		y: "brawler",
		intended: "x",
		level: "strong",
		reason: "The hardest hitter hurts itself the most on the spikes."
	},
	{
		x: "thorns",
		y: "speedster",
		intended: "even",
		reason: "Reflection answers its contact hits, but it hits softly and often."
	},
	{
		x: "thorns",
		y: "frost",
		intended: "even",
		reason: "Two contact balls: the Frost hits hard into the spikes, but slows Thorns."
	}
];
// src/sim/counter-map-hit-kinds-chrono.ts
/**
* The Chrono. Every edge here is a kind of hit meeting a defence that works the same on any ball: a
* rewind undoes a big hit, a fade makes the hits just after a hit miss, regrowth heals between hits,
* and poison ticks are small.
*/
var HIT_KIND_CHRONO_ENTRIES = [
	{
		x: "chrono",
		y: "brawler",
		intended: "even",
		reason: "Its bumps are never big enough to rewind: plain trades decide it."
	},
	{
		x: "chrono",
		y: "speedster",
		intended: "even",
		reason: "Its bumps outweigh the Speedster’s plain ones, but a stacked rush hits harder: even."
	},
	{
		x: "chrono",
		y: "frost",
		intended: "even",
		reason: "The cold’s hits are never big enough to rewind: plain trades decide it."
	},
	{
		x: "chrono",
		y: "thorns",
		intended: "even",
		reason: "No big hits either way: plain trades decide it."
	},
	{
		x: "chrono",
		y: "venom",
		intended: "y",
		level: "strong",
		reason: "Poison ticks are too small to rewind."
	},
	{
		x: "chrono",
		y: "magnet",
		intended: "even",
		reason: "Its pull brings bumps, never a big hit to rewind."
	},
	{
		x: "chrono",
		y: "necromancer",
		intended: "even",
		reason: "Bites are too small to rewind, but each one is light: plain trades decide it."
	},
	{
		x: "chrono",
		y: "titan",
		intended: "even",
		reason: "Even a giant’s bump is too small to rewind: plain trades decide it."
	},
	{
		x: "chrono",
		y: "inferno",
		intended: "y",
		level: "strong",
		reason: "Burns are too small to rewind."
	},
	{
		x: "chrono",
		y: "bomber",
		intended: "x",
		level: "strong",
		reason: "Each big blast is big enough to rewind."
	},
	{
		x: "chrono",
		y: "bloom",
		intended: "y",
		level: "strong",
		reason: "Bumps only, and slow: the Bloom gets its 2 s alone again and again, and regrows."
	}
];
// src/sim/counter-map-hit-kinds-ghost-bloom-venom.ts
/**
* The Ghost, the Bloom and the Venom. Every edge here is a kind of hit meeting a defence that works the same on any
* ball: a rewind undoes a big hit, armor takes a bit off every hit (a big share of a small one), a
* fade makes the hits just after a hit miss, regrowth heals all the time, and poison ticks are small.
*/
var HIT_KIND_GHOST_BLOOM_VENOM_ENTRIES = [
	{
		x: "bloom",
		y: "brawler",
		intended: "even",
		reason: "Hard bumps take more than it regrows between them: plain trades decide it."
	},
	{
		x: "bloom",
		y: "speedster",
		intended: "even",
		reason: "Rushes shut the bud often, but its hard bumps win back what they cost: even."
	},
	{
		x: "bloom",
		y: "frost",
		intended: "x",
		level: "strong",
		reason: "The slow keeps the cold’s bumps rare, and it regrows in the gaps."
	},
	{
		x: "bloom",
		y: "thorns",
		intended: "x",
		level: "edge",
		reason: "The slow Thorns lets it regrow between bumps, more than the spikes take back."
	},
	{
		x: "bloom",
		y: "venom",
		intended: "y",
		level: "strong",
		reason: "Every poison tick is a hit, so its wait never runs out."
	},
	{
		x: "bloom",
		y: "magnet",
		intended: "even",
		reason: "Its pull drags the Bloom into hard bumps, but they come slowly: neither pulls ahead."
	},
	{
		x: "bloom",
		y: "necromancer",
		intended: "even",
		reason: "The skeleton’s bites restart the wait, but its own bumps are hard: even."
	},
	{
		x: "bloom",
		y: "titan",
		intended: "y",
		level: "edge",
		reason: "Its late bumps grow bigger than anything the Bloom regrows between them."
	},
	{
		x: "bloom",
		y: "inferno",
		intended: "y",
		level: "strong",
		reason: "Burning patches hurt every half second, so the bud never opens."
	},
	{
		x: "bloom",
		y: "bomber",
		intended: "y",
		level: "edge",
		reason: "A blast takes over half its health and shuts the bud, more than it regrows between bombs."
	},
	{
		x: "venom",
		y: "brawler",
		intended: "even",
		reason: "Poison chips while the Brawler hits hard: plain trades decide it."
	},
	{
		x: "venom",
		y: "speedster",
		intended: "x",
		level: "edge",
		reason: "Every rush poisons the Speedster, and the ticks add up to more than the rush took."
	},
	{
		x: "venom",
		y: "frost",
		intended: "even",
		reason: "Poison works through the cold, and the cold slows the Venom: plain trades decide it."
	},
	{
		x: "venom",
		y: "thorns",
		intended: "x",
		level: "strong",
		reason: "Poison never touches the spikes, and its light bumps barely feel them."
	},
	{
		x: "venom",
		y: "magnet",
		intended: "even",
		reason: "The pull brings more poisoned bumps, and harder ones back."
	},
	{
		x: "venom",
		y: "necromancer",
		intended: "x",
		level: "edge",
		reason: "Poison ticks on the Necromancer while its skeleton bites only now and then."
	},
	{
		x: "venom",
		y: "titan",
		intended: "even",
		reason: "Poison chips the giant, and its bumps grow harder: neither pulls ahead."
	},
	{
		x: "venom",
		y: "inferno",
		intended: "even",
		reason: "Both chip: poison over time, fire along its trail."
	},
	{
		x: "venom",
		y: "bomber",
		intended: "even",
		reason: "Both chip between contacts: poison over time, bombs where it was."
	}
];
// src/sim/counter-map-rules-out-archer-sniper.ts
/**
* The three interaction rules are gone (ADR 0045), so every edge here comes from what one ball does
* the same way to any ball: lightning and shockwaves strike an area, arrows, shots and boomerangs hit
* from range, lifesteal drinks most of what its bumps deal, and rage grows with every hit taken.
*/
var RULES_OUT_ARCHER_SNIPER_ENTRIES = [
	{
		x: "archer",
		y: "bloom",
		intended: "x",
		level: "strong",
		reason: "Arrows keep coming, and every one restarts its 2 s wait."
	},
	{
		x: "archer",
		y: "bomber",
		intended: "even",
		reason: "Arrows hit from range, but the frail Archer runs over bombs like anyone."
	},
	{
		x: "archer",
		y: "boomerang",
		intended: "even",
		reason: "Both chip from range: arrows lead their aim, a boomerang hits twice."
	},
	{
		x: "archer",
		y: "chrono",
		intended: "x",
		level: "edge",
		reason: "Arrows are too small to rewind, and they keep landing between the Chrono’s bumps."
	},
	{
		x: "archer",
		y: "inferno",
		intended: "x",
		level: "edge",
		reason: "Arrows hit from range, more than the fire burns back when the Archer crosses it."
	},
	{
		x: "archer",
		y: "sniper",
		intended: "even",
		reason: "Two ranged balls: arrows lead their target, the shot hits harder."
	},
	{
		x: "archer",
		y: "thorns",
		intended: "x",
		level: "edge",
		reason: "Arrows never touch the spikes, but the frail Archer pays when the Thorns closes in."
	},
	{
		x: "brawler",
		y: "archer",
		intended: "even",
		reason: "No tricks either way: plain hits decide it."
	},
	{
		x: "frost",
		y: "archer",
		intended: "y",
		level: "edge",
		reason: "The slow Frost is easy to lead, so arrows land more often than its bumps."
	},
	{
		x: "magnet",
		y: "archer",
		intended: "x",
		level: "strong",
		reason: "Every arrow that lands starts a pull, and the frail Archer is dragged into its bumps."
	},
	{
		x: "necromancer",
		y: "archer",
		intended: "x",
		level: "strong",
		reason: "A minion nearer than its owner draws the arrows."
	},
	{
		x: "speedster",
		y: "archer",
		intended: "x",
		level: "strong",
		reason: "Closes the distance faster than arrows can stop it."
	},
	{
		x: "titan",
		y: "archer",
		intended: "even",
		reason: "Arrows chip it while it is small; grown, its bumps flatten the frail Archer: even."
	},
	{
		x: "venom",
		y: "archer",
		intended: "even",
		reason: "Arrows chip Venom from range, but every contact poisons the frail Archer."
	},
	{
		x: "brawler",
		y: "sniper",
		intended: "even",
		reason: "No tricks either way: plain hits decide it."
	},
	{
		x: "chrono",
		y: "sniper",
		intended: "x",
		level: "edge",
		reason: "A shot is a big hit, and the rewind undoes it."
	},
	{
		x: "inferno",
		y: "sniper",
		intended: "y",
		level: "edge",
		reason: "A heavy shot every 2 s outweighs the small burns it takes while locking on."
	},
	{
		x: "magnet",
		y: "sniper",
		intended: "even",
		reason: "The pull drags the Sniper into contact, but its heavy shot still lands: neither pulls ahead."
	},
	{
		x: "necromancer",
		y: "sniper",
		intended: "x",
		level: "edge",
		reason: "The skull draws shots, and the sturdy Necromancer outlasts the ones that land."
	},
	{
		x: "sniper",
		y: "bloom",
		intended: "even",
		reason: "Shots are big, but they come with time to regrow between."
	},
	{
		x: "sniper",
		y: "bomber",
		intended: "even",
		reason: "It shoots from range and seldom crosses the bombs, but it misses a moving target."
	},
	{
		x: "sniper",
		y: "boomerang",
		intended: "even",
		reason: "A shot and a throw from range each, and neither stops the other."
	},
	{
		x: "sniper",
		y: "frost",
		intended: "even",
		reason: "The Frost takes several shots to bring down, and wins the contacts in between."
	},
	{
		x: "sniper",
		y: "thorns",
		intended: "x",
		level: "strong",
		reason: "The shot never touches the spikes, and the slow Thorns can’t slip its line."
	},
	{
		x: "sniper",
		y: "venom",
		intended: "even",
		reason: "A shot outdamages the poison, but every contact poisons the Sniper."
	},
	{
		x: "speedster",
		y: "sniper",
		intended: "x",
		level: "strong",
		reason: "The fastest ball, faster still with stacks, is off the locked line before the shot."
	},
	{
		x: "titan",
		y: "sniper",
		intended: "even",
		reason: "A huge target for the shot, but the Titan wins every meeting up close."
	}
];
// src/sim/counter-map-rules-out-berserker-vampire.ts
/**
* The three interaction rules are gone (ADR 0045), so every edge here comes from what one ball does
* the same way to any ball: lightning and shockwaves strike an area, arrows, shots and boomerangs hit
* from range, lifesteal drinks most of what its bumps deal, and rage grows with every hit taken.
*/
var RULES_OUT_BERSERKER_VAMPIRE_ENTRIES = [
	{
		x: "berserker",
		y: "archer",
		intended: "x",
		level: "edge",
		reason: "Every arrow stores rage, so each bump it lands on the frail Archer hits far harder."
	},
	{
		x: "berserker",
		y: "bloom",
		intended: "y",
		level: "strong",
		reason: "Its raging bumps come with long gaps, and the Bloom regrows in each."
	},
	{
		x: "berserker",
		y: "bomber",
		intended: "even",
		reason: "A blast stores just one rage, and its big health soaks the blast: neither pulls ahead."
	},
	{
		x: "berserker",
		y: "boomerang",
		intended: "x",
		level: "strong",
		reason: "Every boomerang hit stores rage, and the thrower can’t keep away from its bumps."
	},
	{
		x: "berserker",
		y: "frost",
		intended: "y",
		level: "edge",
		reason: "Slowed, it reaches the Frost less often, and the Frost’s big health outlasts its rage."
	},
	{
		x: "berserker",
		y: "inferno",
		intended: "x",
		level: "strong",
		reason: "Every burn stores rage, so the Inferno takes a raging bump each time they meet."
	},
	{
		x: "berserker",
		y: "necromancer",
		intended: "x",
		level: "edge",
		reason: "Every skull bite stores rage, so it meets the Necromancer with a full next bump."
	},
	{
		x: "berserker",
		y: "speedster",
		intended: "even",
		reason: "Every rush stores rage, but the fastest ball lands more often: neither pulls ahead."
	},
	{
		x: "berserker",
		y: "venom",
		intended: "x",
		level: "strong",
		reason: "Every poison tick stores rage, so each bump it lands hits far harder."
	},
	{
		x: "brawler",
		y: "berserker",
		intended: "even",
		reason: "No tricks either way: plain hits decide it."
	},
	{
		x: "chrono",
		y: "berserker",
		intended: "even",
		reason: "A raging bump is never big enough to rewind: plain trades decide it."
	},
	{
		x: "magnet",
		y: "berserker",
		intended: "even",
		reason: "Both want a brawl: the pull feeds its rage as much as the Magnet’s hits."
	},
	{
		x: "sniper",
		y: "berserker",
		intended: "even",
		reason: "Shots hurt it from range, but each one stores rage for its next bump: neither pulls ahead."
	},
	{
		x: "thorns",
		y: "berserker",
		intended: "x",
		level: "edge",
		reason: "Its raging bumps come back off the spikes, and the spikes store it no rage."
	},
	{
		x: "titan",
		y: "berserker",
		intended: "even",
		reason: "Every growing bump stores rage, and the rage pays it back: neither pulls ahead."
	},
	{
		x: "vampire",
		y: "berserker",
		intended: "x",
		level: "strong",
		reason: "The Berserker only bumps, and the Vampire drinks back most of every bump it trades."
	},
	{
		x: "archer",
		y: "vampire",
		intended: "x",
		level: "edge",
		reason: "Arrows never touch it, though each one makes it thirsty and quick to close in."
	},
	{
		x: "brawler",
		y: "vampire",
		intended: "even",
		reason: "No tricks either way: plain hits decide it."
	},
	{
		x: "frost",
		y: "vampire",
		intended: "y",
		level: "edge",
		reason: "Being slowed doesn’t change a bump trade, and it drinks back most of every one."
	},
	{
		x: "magnet",
		y: "vampire",
		intended: "even",
		reason: "Pulled into brawls, the Vampire heals off them as fast as it loses."
	},
	{
		x: "necromancer",
		y: "vampire",
		intended: "even",
		reason: "Minion pops chip it, but it heals off its hits on the Necromancer."
	},
	{
		x: "sniper",
		y: "vampire",
		intended: "even",
		reason: "Lifesteal cannot answer a shot, but the Vampire wins the contacts in between."
	},
	{
		x: "thorns",
		y: "vampire",
		intended: "y",
		level: "edge",
		reason: "The spikes hurt it back, but its lifesteal heals more than they take."
	},
	{
		x: "vampire",
		y: "bloom",
		intended: "x",
		level: "edge",
		reason: "Each bump shuts the bud and is drunk back, so the Bloom never regrows its lead."
	},
	{
		x: "vampire",
		y: "bomber",
		intended: "y",
		level: "strong",
		reason: "A blast takes three quarters of its small health, and a blast heals it nothing."
	},
	{
		x: "vampire",
		y: "boomerang",
		intended: "even",
		reason: "The boomerang never touches it, but each hit sends it in fast to drink: even."
	},
	{
		x: "vampire",
		y: "chrono",
		intended: "x",
		level: "edge",
		reason: "Bumps are never rewound, and it drinks back most of each one it trades."
	},
	{
		x: "vampire",
		y: "inferno",
		intended: "x",
		level: "edge",
		reason: "Burns make it thirsty, so it closes in fast and drinks back the fire."
	},
	{
		x: "vampire",
		y: "speedster",
		intended: "x",
		level: "strong",
		reason: "Its bumps drink back each rush, and the rush’s extra hit makes it thirsty."
	},
	{
		x: "vampire",
		y: "titan",
		intended: "x",
		level: "edge",
		reason: "It drinks back most of each trade before the Titan grows big enough to outhit it."
	},
	{
		x: "vampire",
		y: "venom",
		intended: "x",
		level: "edge",
		reason: "Poison makes it thirsty, so it closes in and drinks back what drips."
	}
];
// src/sim/counter-map-rules-out-boomerang.ts
/**
* The three interaction rules are gone (ADR 0045), so every edge here comes from what one ball does
* the same way to any ball: lightning and shockwaves strike an area, arrows, shots and boomerangs hit
* from range, lifesteal drinks most of what its bumps deal, and rage grows with every hit taken.
*/
var RULES_OUT_BOOMERANG_ENTRIES = [
	{
		x: "bloom",
		y: "boomerang",
		intended: "y",
		level: "strong",
		reason: "Two hits a throw, out and back: it is never left alone for 2 s."
	},
	{
		x: "boomerang",
		y: "bomber",
		intended: "even",
		reason: "It throws from range and seldom crosses the bombs, but its hits are light."
	},
	{
		x: "boomerang",
		y: "inferno",
		intended: "x",
		level: "edge",
		reason: "Twice a throw from range, it hurts the Inferno more than the fire hurts it."
	},
	{
		x: "brawler",
		y: "boomerang",
		intended: "even",
		reason: "It chips from range, the Brawler hits hard up close: plain trades decide it."
	},
	{
		x: "chrono",
		y: "boomerang",
		intended: "y",
		level: "edge",
		reason: "Its light hits are far too small to rewind, and it hits twice a throw."
	},
	{
		x: "frost",
		y: "boomerang",
		intended: "even",
		reason: "The slow Frost is easy to hit going out and back, but its big health holds out: even."
	},
	{
		x: "magnet",
		y: "boomerang",
		intended: "x",
		level: "strong",
		reason: "Every boomerang that hits it starts a pull, and the thrower is dragged into a brawl."
	},
	{
		x: "necromancer",
		y: "boomerang",
		intended: "x",
		level: "strong",
		reason: "A skull nearer than its owner draws the throw, and a skull stops a boomerang dead."
	},
	{
		x: "speedster",
		y: "boomerang",
		intended: "x",
		level: "strong",
		reason: "It outruns the throw and closes in while the boomerang is away."
	},
	{
		x: "thorns",
		y: "boomerang",
		intended: "even",
		reason: "The boomerang never touches the spikes, and Thorns soaks its light hits."
	},
	{
		x: "titan",
		y: "boomerang",
		intended: "x",
		level: "edge",
		reason: "Its throws land while the Titan is small, but it grows big fast and its bumps then win."
	},
	{
		x: "venom",
		y: "boomerang",
		intended: "even",
		reason: "Poison works between throws, and its light hits can’t stop the boomerang."
	}
];
// src/sim/counter-map-rules-out-storm-quake.ts
/**
* The three interaction rules are gone (ADR 0045), so every edge here comes from what one ball does
* the same way to any ball: lightning and shockwaves strike an area, arrows, shots and boomerangs hit
* from range, lifesteal drinks most of what its bumps deal, and rage grows with every hit taken.
*/
var RULES_OUT_STORM_QUAKE_ENTRIES = [
	{
		x: "archer",
		y: "storm",
		intended: "even",
		reason: "Two ranged balls: arrows hit more often, a strike hits harder."
	},
	{
		x: "berserker",
		y: "storm",
		intended: "even",
		reason: "A strike stores only one rage, and its big health outlasts the lightning: neither pulls ahead."
	},
	{
		x: "brawler",
		y: "storm",
		intended: "even",
		reason: "No tricks either way: plain hits decide it."
	},
	{
		x: "chrono",
		y: "storm",
		intended: "x",
		level: "strong",
		reason: "A strike is a big hit, and the rewind undoes it."
	},
	{
		x: "magnet",
		y: "storm",
		intended: "even",
		reason: "The pull drags the caller into a brawl, but the strikes still land: neither pulls ahead."
	},
	{
		x: "necromancer",
		y: "storm",
		intended: "even",
		reason: "A strike clears the skull, but the Necromancer has the health to take it: even."
	},
	{
		x: "speedster",
		y: "storm",
		intended: "x",
		level: "edge",
		reason: "Fast enough to leave most warning circles, and its rushes land hard between strikes."
	},
	{
		x: "storm",
		y: "bloom",
		intended: "even",
		reason: "Strikes are big, but they come with time to regrow between."
	},
	{
		x: "storm",
		y: "bomber",
		intended: "even",
		reason: "Lightning from above against bombs below: both are dodged as often as not."
	},
	{
		x: "storm",
		y: "boomerang",
		intended: "even",
		reason: "Lightning and a boomerang both strike from afar, and neither stops the other."
	},
	{
		x: "storm",
		y: "frost",
		intended: "even",
		reason: "Slow to leave the warning circle, but sturdy enough to take a strike."
	},
	{
		x: "storm",
		y: "inferno",
		intended: "even",
		reason: "Both burn from afar: lightning against the trail of fire."
	},
	{
		x: "storm",
		y: "quake",
		intended: "even",
		reason: "One big strike against many small shockwaves: neither stops the other."
	},
	{
		x: "storm",
		y: "sniper",
		intended: "even",
		reason: "Lightning hits a wider area, the shot hits harder; neither is ever answered."
	},
	{
		x: "storm",
		y: "thorns",
		intended: "x",
		level: "edge",
		reason: "Lightning never touches the spikes, and a strike outweighs the bumps between them."
	},
	{
		x: "storm",
		y: "vampire",
		intended: "x",
		level: "strong",
		reason: "One strike takes most of its small health, and lightning gives it nothing to drink."
	},
	{
		x: "titan",
		y: "storm",
		intended: "even",
		reason: "A big target for lightning, but its heavy bumps pay the Storm back."
	},
	{
		x: "venom",
		y: "storm",
		intended: "even",
		reason: "Lightning outdamages poison per hit, but every Storm contact is poisoned too."
	},
	{
		x: "archer",
		y: "quake",
		intended: "even",
		reason: "Shockwaves and arrows both chip from afar; neither stops the other."
	},
	{
		x: "brawler",
		y: "quake",
		intended: "even",
		reason: "No tricks either way: plain hits decide it."
	},
	{
		x: "chrono",
		y: "quake",
		intended: "y",
		level: "strong",
		reason: "Shockwaves are far too small to rewind, and they chip it off every wall, again and again."
	},
	{
		x: "frost",
		y: "quake",
		intended: "even",
		reason: "Slowed, it reaches the walls less often, but each shockwave still chips the Frost: even."
	},
	{
		x: "inferno",
		y: "quake",
		intended: "y",
		level: "edge",
		reason: "Both hurt without a touch, but the Quake’s bumps hit twice as hard as the Inferno’s."
	},
	{
		x: "magnet",
		y: "quake",
		intended: "even",
		reason: "The pull drags it away from the walls, but into a brawl it can hold."
	},
	{
		x: "quake",
		y: "berserker",
		intended: "y",
		level: "edge",
		reason: "Every small shockwave stores rage, so its next bump hits far harder."
	},
	{
		x: "quake",
		y: "bloom",
		intended: "x",
		level: "edge",
		reason: "Each shockwave restarts its wait, and they go out from every wall, so the bud rarely opens."
	},
	{
		x: "quake",
		y: "bomber",
		intended: "even",
		reason: "It races to the walls for its shockwaves and crosses bombs on the way."
	},
	{
		x: "quake",
		y: "boomerang",
		intended: "even",
		reason: "Shockwaves and a boomerang both chip from afar; neither stops the other."
	},
	{
		x: "quake",
		y: "necromancer",
		intended: "x",
		level: "strong",
		reason: "Wide shockwaves pop the skull before it arrives, and chip the Necromancer too."
	},
	{
		x: "quake",
		y: "sniper",
		intended: "even",
		reason: "Shockwaves by the walls against one heavy shot: neither stops the other."
	},
	{
		x: "quake",
		y: "speedster",
		intended: "x",
		level: "edge",
		reason: "The fastest ball runs into the most shockwaves, more than its rushes win back."
	},
	{
		x: "quake",
		y: "thorns",
		intended: "even",
		reason: "Shockwaves are never reflected, but its contact hits are."
	},
	{
		x: "quake",
		y: "vampire",
		intended: "even",
		reason: "Shockwaves chip it from afar, and it drinks back from every bump."
	},
	{
		x: "quake",
		y: "venom",
		intended: "even",
		reason: "Both wear their enemy down between contacts: one on the walls, one over time."
	},
	{
		x: "titan",
		y: "quake",
		intended: "even",
		reason: "A big target for shockwaves, but its heavy bumps pay the Quake back."
	}
];
// src/sim/counter-map-ghost.ts
/**
* The reworked Ghost phases for just over a second in every four, and then nothing touches it: balls,
* shots, skulls and bombs pass through, and no hit lands. Passing through a ball deals its spectral
* hit. Over a quarter of every kind of hit misses alike, so it beats only the balls whose damage comes as
* a steady drip after the touch (Venom's poison, the Hex's curse), and loses to the Bloom, which
* regrows between its spread-out hits.
*/
var GHOST_ENTRIES = [
	{
		x: "ghost",
		y: "brawler",
		intended: "even",
		reason: "Phased it takes no bump and deals its spectral hit; solid, the hard bumps trade."
	},
	{
		x: "ghost",
		y: "speedster",
		intended: "even",
		reason: "A phased pass takes no speed hit, a solid one takes it whole: plain trades decide it."
	},
	{
		x: "ghost",
		y: "vampire",
		intended: "x",
		level: "edge",
		reason: "Its passes hit without a touch; Thirst speeds the Vampire up, but it drinks nothing."
	},
	{
		x: "archer",
		y: "ghost",
		intended: "even",
		reason: "Arrows fly through it while phased and land while solid: neither pulls ahead."
	},
	{
		x: "storm",
		y: "ghost",
		intended: "even",
		reason: "A strike that falls while it is phased misses; the rest land whole."
	},
	{
		x: "ghost",
		y: "frost",
		intended: "even",
		reason: "Phased it can’t be chilled, solid it is: neither pulls ahead."
	},
	{
		x: "ghost",
		y: "thorns",
		intended: "even",
		reason: "Its spectral hit is no bump, so no spikes, but its solid bumps meet them."
	},
	{
		x: "ghost",
		y: "venom",
		intended: "x",
		level: "strong",
		reason: "Poison ticks that fall while it is phased do nothing."
	},
	{
		x: "ghost",
		y: "berserker",
		intended: "even",
		reason: "Passing through stores no rage, but its big health outlasts the spectral hits."
	},
	{
		x: "sniper",
		y: "ghost",
		intended: "even",
		reason: "A shot that arrives while it is phased flies through; most arrive while it is solid."
	},
	{
		x: "quake",
		y: "ghost",
		intended: "even",
		reason: "Shockwaves that reach it while phased miss, the rest land: neither pulls ahead."
	},
	{
		x: "ghost",
		y: "magnet",
		intended: "even",
		reason: "The pull brings it in, phased or solid: plain trades and spectral hits decide it."
	},
	{
		x: "ghost",
		y: "necromancer",
		intended: "even",
		reason: "Skeletons pass through it while phased, but the Necromancer outlasts its passes: even."
	},
	{
		x: "chrono",
		y: "ghost",
		intended: "y",
		level: "edge",
		reason: "No big hit to rewind, and its spectral hits land while the Chrono’s bumps pass through."
	},
	{
		x: "ghost",
		y: "titan",
		intended: "even",
		reason: "A giant’s bumps miss it over a quarter of the time and land whole the rest."
	},
	{
		x: "ghost",
		y: "inferno",
		intended: "even",
		reason: "Burns that fall while it is phased miss, the rest land: neither pulls ahead."
	},
	{
		x: "boomerang",
		y: "ghost",
		intended: "even",
		reason: "The boomerang flies through it while phased and hits while solid."
	},
	{
		x: "ghost",
		y: "bomber",
		intended: "y",
		level: "edge",
		reason: "A phase lasts just over 1 s of every 4, so most blasts still catch it solid."
	},
	{
		x: "spartan",
		y: "ghost",
		intended: "even",
		reason: "The shield halves its hits, and phasing dodges the spear now and then."
	},
	{
		x: "ghost",
		y: "bloom",
		intended: "y",
		level: "strong",
		reason: "Phasing makes the fight stop-start, and every quiet 2 s is regrowth."
	}
];
// src/sim/counter-map-hex.ts
/**
* The Hex's bump curses, and 3 s later the mark bursts for over a quarter of the cursed ball's full
* health. A big ball takes a big burst, so it beats the sturdy balls (and the Inferno, whose light
* bumps barely hurt back), and loses to the frail ones that take a small burst and heal or halve
* it, and to the Ghost, which can't be cursed while phased.
*/
var HEX_ENTRIES = [
	{
		x: "hex",
		y: "brawler",
		intended: "even",
		reason: "A burst on top of each bump against the Brawler’s harder bumps: even."
	},
	{
		x: "hex",
		y: "speedster",
		intended: "x",
		level: "strong",
		reason: "Every bump that builds its speed hit curses it, and a burst is over a quarter of its health."
	},
	{
		x: "hex",
		y: "vampire",
		intended: "y",
		level: "strong",
		reason: "Its small health makes a small burst, and it drinks that back with its next bump."
	},
	{
		x: "hex",
		y: "archer",
		intended: "y",
		level: "edge",
		reason: "Arrows land from afar, and a frail Archer takes only a small burst."
	},
	{
		x: "hex",
		y: "storm",
		intended: "even",
		reason: "A strike can be dodged and the curse always bursts, but strikes land hard: even."
	},
	{
		x: "hex",
		y: "frost",
		intended: "x",
		level: "strong",
		reason: "Its big health makes a big burst, and slow as it is, it can’t trade bumps fast."
	},
	{
		x: "hex",
		y: "thorns",
		intended: "x",
		level: "strong",
		reason: "A burst is no bump, so the spikes never answer it, and big health makes it big."
	},
	{
		x: "hex",
		y: "venom",
		intended: "even",
		reason: "Poison and the curse both hurt after the touch: neither pulls ahead."
	},
	{
		x: "hex",
		y: "berserker",
		intended: "x",
		level: "strong",
		reason: "The most health makes the biggest burst, and one burst gives it one rage, not several."
	},
	{
		x: "hex",
		y: "sniper",
		intended: "x",
		level: "edge",
		reason: "Its big health makes a big burst, and its bumps come between the shots."
	},
	{
		x: "hex",
		y: "quake",
		intended: "even",
		reason: "Small shockwaves against a big burst now and then: neither pulls ahead."
	},
	{
		x: "hex",
		y: "magnet",
		intended: "even",
		reason: "The pull brings the bumps that curse it, and its hard bumps hit back."
	},
	{
		x: "hex",
		y: "ghost",
		intended: "y",
		level: "strong",
		reason: "Passing through it while phased lays no curse, and a burst on a phased Ghost misses."
	},
	{
		x: "hex",
		y: "necromancer",
		intended: "x",
		level: "edge",
		reason: "Its burst takes over a quarter of the Necromancer’s health, more than a skull bite takes."
	},
	{
		x: "hex",
		y: "chrono",
		intended: "even",
		reason: "Its burst is under the big hit it rewinds, so plain trades decide it."
	},
	{
		x: "hex",
		y: "titan",
		intended: "even",
		reason: "Its big health makes a big burst, but the Titan grows big soon and hits back hard: even."
	},
	{
		x: "hex",
		y: "inferno",
		intended: "x",
		level: "edge",
		reason: "Its big health makes a big burst, and its light bumps barely hurt back."
	},
	{
		x: "hex",
		y: "boomerang",
		intended: "even",
		reason: "It hits from afar twice a throw, but the Hex curses with each bump it lands: even."
	},
	{
		x: "hex",
		y: "bomber",
		intended: "even",
		reason: "A burst and a blast are both one big hit now and then: neither pulls ahead."
	},
	{
		x: "hex",
		y: "spartan",
		intended: "y",
		level: "edge",
		reason: "Its small health makes a small burst, halved again when its shield is planted."
	},
	{
		x: "hex",
		y: "bloom",
		intended: "even",
		reason: "Its burst restarts the wait, but it is small: neither pulls ahead."
	},
	{
		x: "hex",
		y: "spider",
		intended: "x",
		level: "edge",
		reason: "Its burst takes over a quarter of the Spider’s health, more than the webs nip back."
	}
];
// src/sim/counter-map-spider.ts
/**
* The Spider webs every wall it bounces off; a ball that bounces off a web is slowed and nipped.
* The slow is the decider, so it beats the balls whose ability feeds on speed or walls, and the
* Slime, whose two halves both bounce into webs. A web that catches is used up (ADR 0060), so a
* ball that keeps coming back to one wall (the Chrono) is even. It loses to the balls a slow costs nothing
* (the Archer's arrows, the Boomerang, the Bomber's blasts, the Spartan's spear behind its shield).
*/
var SPIDER_ENTRIES = [
	{
		x: "spider",
		y: "brawler",
		intended: "even",
		reason: "Webs slow and nip it, but its hard bumps still trade evenly."
	},
	{
		x: "spider",
		y: "speedster",
		intended: "x",
		level: "strong",
		reason: "The fastest ball hits the most walls, and every web slows it right down."
	},
	{
		x: "spider",
		y: "vampire",
		intended: "even",
		reason: "A nip is too small to matter to lifesteal: plain trades decide it."
	},
	{
		x: "spider",
		y: "archer",
		intended: "y",
		level: "strong",
		reason: "Its arrows don’t need speed, so a slow costs nothing, and they land from afar."
	},
	{
		x: "spider",
		y: "storm",
		intended: "even",
		reason: "Slowed, it leaves a strike late, but strikes come one at a time: neither pulls ahead."
	},
	{
		x: "spider",
		y: "frost",
		intended: "even",
		reason: "Both slow the other, so neither outruns anyone: plain trades decide it."
	},
	{
		x: "spider",
		y: "thorns",
		intended: "even",
		reason: "A nip is no bump, so the spikes never answer it, but they punish its bumps."
	},
	{
		x: "spider",
		y: "venom",
		intended: "even",
		reason: "Poison and nips both chip away: neither pulls ahead."
	},
	{
		x: "spider",
		y: "berserker",
		intended: "y",
		level: "edge",
		reason: "Its big health shrugs off the nips, and every nip stores rage for its next bump."
	},
	{
		x: "spider",
		y: "sniper",
		intended: "even",
		reason: "A heavy shot from afar against slowing webs: neither pulls ahead."
	},
	{
		x: "spider",
		y: "quake",
		intended: "even",
		reason: "Slowed, it reaches fewer walls and sends fewer shockwaves, but they still land: even."
	},
	{
		x: "spider",
		y: "magnet",
		intended: "even",
		reason: "The pull drags it off the walls, so fewer webs catch it: neither pulls ahead."
	},
	{
		x: "spider",
		y: "ghost",
		intended: "even",
		reason: "A phased bounce slips through the web, a solid one is caught: neither pulls ahead."
	},
	{
		x: "spider",
		y: "necromancer",
		intended: "even",
		reason: "Webs catch only the Necromancer, never its skeletons: neither pulls ahead."
	},
	{
		x: "spider",
		y: "chrono",
		intended: "x",
		level: "edge",
		reason: "Webs nip and slow it on every wall, and a nip is too small to rewind."
	},
	{
		x: "spider",
		y: "titan",
		intended: "even",
		reason: "A slowed giant still grows, and its bumps get heavier: neither pulls ahead."
	},
	{
		x: "spider",
		y: "inferno",
		intended: "even",
		reason: "Nips against burns, small hits both ways: neither pulls ahead."
	},
	{
		x: "spider",
		y: "boomerang",
		intended: "y",
		level: "edge",
		reason: "A slow costs a returning boomerang nothing, and each pass chips it as nips can’t keep up."
	},
	{
		x: "spider",
		y: "bomber",
		intended: "y",
		level: "strong",
		reason: "A slow doesn’t stop a blast, and each bomb it runs into costs more than nips win."
	},
	{
		x: "spider",
		y: "spartan",
		intended: "y",
		level: "edge",
		reason: "The shield halves the nips, and the spear lands however slow it is."
	},
	{
		x: "spider",
		y: "bloom",
		intended: "even",
		reason: "Webs and nips restart the wait, but they are small: neither pulls ahead."
	}
];
// src/sim/counter-map-spartan.ts
/**
* The Spartan plants its shield (every hit does half while it is up, and it slows down), then throws
* one heavy spear and fights in the open. Half of a hit is half whoever deals it, so the shield
* decides few pairs on its own: it beats the ball that lives on its own bumps, and loses to the
* strike it is too slow to leave and the rewind that undoes its spear.
*/
var SPARTAN_ENTRIES = [
	{
		x: "spartan",
		y: "brawler",
		intended: "even",
		reason: "Half a hard bump while planted, a whole one in the open: plain trades decide it."
	},
	{
		x: "spartan",
		y: "speedster",
		intended: "even",
		reason: "The shield halves its rushes, but the Speedster is gone before the spear lands."
	},
	{
		x: "spartan",
		y: "vampire",
		intended: "x",
		level: "strong",
		reason: "Its bumps do half against the planted shield, so the Vampire drinks half as much."
	},
	{
		x: "spartan",
		y: "archer",
		intended: "even",
		reason: "The shield halves the arrows that hit while it is up; the rest land whole."
	},
	{
		x: "spartan",
		y: "storm",
		intended: "y",
		level: "strong",
		reason: "Slowed behind its shield it can’t leave the circle, and half a strike is still big."
	},
	{
		x: "spartan",
		y: "frost",
		intended: "even",
		reason: "The shield halves its bumps and the slow Frost is an easy target, but it outlasts: even."
	},
	{
		x: "spartan",
		y: "thorns",
		intended: "x",
		level: "edge",
		reason: "Its spear never meets the spikes, and the shield halves the bumps it takes."
	},
	{
		x: "spartan",
		y: "venom",
		intended: "even",
		reason: "The shield halves the poison only while it is up: neither pulls ahead."
	},
	{
		x: "spartan",
		y: "berserker",
		intended: "even",
		reason: "Half of a raging bump is still a big one: plain trades decide it."
	},
	{
		x: "spartan",
		y: "sniper",
		intended: "y",
		level: "edge",
		reason: "Planted, it is too slow to leave a 0.2 s lock: the shots keep landing, halved or not."
	},
	{
		x: "spartan",
		y: "quake",
		intended: "even",
		reason: "The shield halves the shockwaves only while it is up: neither pulls ahead."
	},
	{
		x: "spartan",
		y: "magnet",
		intended: "even",
		reason: "The pull brings bumps either way, half or whole: plain trades decide it."
	},
	{
		x: "spartan",
		y: "necromancer",
		intended: "even",
		reason: "The shield halves the bites, and the spear clears a skeleton: neither pulls ahead."
	},
	{
		x: "spartan",
		y: "chrono",
		intended: "y",
		level: "strong",
		reason: "The spear is a big hit: the Chrono rewinds it."
	},
	{
		x: "spartan",
		y: "titan",
		intended: "x",
		level: "edge",
		reason: "The shield halves the giant’s bumps, and a big target never dodges the spear."
	},
	{
		x: "spartan",
		y: "inferno",
		intended: "x",
		level: "edge",
		reason: "Its shield cuts each burn to 1, and the Inferno’s light bumps can’t answer the spear."
	},
	{
		x: "spartan",
		y: "boomerang",
		intended: "even",
		reason: "The shield halves the boomerang only while it is up: neither pulls ahead."
	},
	{
		x: "spartan",
		y: "bomber",
		intended: "even",
		reason: "A blast halves on the planted shield, but a slow ball walks into bombs."
	},
	{
		x: "spartan",
		y: "bloom",
		intended: "even",
		reason: "The spear restarts the wait, the shield halves the bumps: neither pulls ahead."
	}
];
// src/sim/counter-map-battery.ts
/**
* The Battery stores part of every big strike, blast or burst and lets it out on its next bump, so
* it beats the balls built on one big hit (the Storm, Bomber and Hex). Against everyone else it is a
* fast, hard bumper: Thorns' spikes punish its bumps, and the Frost's and the Spider's slows take
* away the speed it fights with.
*/
var BATTERY_ENTRIES = [
	{
		x: "battery",
		y: "brawler",
		intended: "even",
		reason: "Two plain bumpers: nothing big to store, so bumps trade evenly."
	},
	{
		x: "battery",
		y: "speedster",
		intended: "even",
		reason: "Its speed hits come as bumps, which it never stores: an even race."
	},
	{
		x: "battery",
		y: "vampire",
		intended: "y",
		level: "edge",
		reason: "The Battery stores no bumps, and it drinks back most of each one they trade."
	},
	{
		x: "battery",
		y: "archer",
		intended: "even",
		reason: "Arrows are small and never stored; it closes in about as fast as they chip."
	},
	{
		x: "battery",
		y: "storm",
		intended: "x",
		level: "strong",
		reason: "It stores part of every big strike and bumps the Storm back with it."
	},
	{
		x: "battery",
		y: "frost",
		intended: "y",
		level: "strong",
		reason: "Its speed is its strength, and every frosty hit slows it right down."
	},
	{
		x: "battery",
		y: "thorns",
		intended: "y",
		level: "strong",
		reason: "Its hard bumps, and anything it lets out, meet the spikes."
	},
	{
		x: "battery",
		y: "venom",
		intended: "y",
		level: "edge",
		reason: "Poison ticks are small and never stored, and they wear the Battery down between bumps."
	},
	{
		x: "battery",
		y: "berserker",
		intended: "even",
		reason: "Neither has a big hit for the other to use: bump against bump."
	},
	{
		x: "battery",
		y: "sniper",
		intended: "even",
		reason: "Heavy shots are never stored, so it fights the Sniper as a plain ball."
	},
	{
		x: "battery",
		y: "quake",
		intended: "even",
		reason: "Shockwaves are small; nothing to store, nothing to let out."
	},
	{
		x: "battery",
		y: "ghost",
		intended: "y",
		level: "edge",
		reason: "Its stored bumps pass through a phased Ghost, wasted, while spectral hits land on it."
	},
	{
		x: "battery",
		y: "necromancer",
		intended: "even",
		reason: "Skulls nip and never feed it; it bumps through them evenly."
	},
	{
		x: "battery",
		y: "chrono",
		intended: "even",
		reason: "It hits by bumps, which the Chrono never rewinds: an even trade."
	},
	{
		x: "battery",
		y: "titan",
		intended: "y",
		level: "edge",
		reason: "Grown, the Titan bumps harder than the Battery and barely turns when it is hit."
	},
	{
		x: "battery",
		y: "inferno",
		intended: "even",
		reason: "Burns are small and never stored; it outruns the trail about as often as not."
	},
	{
		x: "battery",
		y: "boomerang",
		intended: "even",
		reason: "A returning boomerang is a shot, never stored: plain trades."
	},
	{
		x: "battery",
		y: "bomber",
		intended: "x",
		level: "strong",
		reason: "It stores part of every blast and bumps the Bomber back with it."
	},
	{
		x: "battery",
		y: "spartan",
		intended: "even",
		reason: "The spear is a shot, never stored, and the shield halves its bumps."
	},
	{
		x: "battery",
		y: "bloom",
		intended: "y",
		level: "edge",
		reason: "It has no big hit for the Battery to store, so it regrows between plain trades."
	},
	{
		x: "battery",
		y: "hex",
		intended: "x",
		level: "strong",
		reason: "It stores part of every curse burst, and its next bump answers it."
	},
	{
		x: "battery",
		y: "magnet",
		intended: "even",
		reason: "The pull only steers it into bumps, and bumps are never stored: an even trade."
	},
	{
		x: "battery",
		y: "spider",
		intended: "y",
		level: "edge",
		reason: "It bounces off walls at speed, and every web it hits slows it down."
	}
];
// src/sim/counter-map-slime.ts
/**
* At half health the Slime splits into two small, quick slimes, and the enemy must finish both. So
* it beats the balls that win with one aimed hit at a time (an arrow, a heavy shot only ever
* finishes one half), and loses to the balls that gain from two bodies: the Spider's webs catch
* both halves, and the Vampire drinks from two.
*/
var SLIME_ENTRIES = [
	{
		x: "slime",
		y: "brawler",
		intended: "even",
		reason: "Its hard bumps knock out a half as easily as they split it: even."
	},
	{
		x: "slime",
		y: "speedster",
		intended: "x",
		level: "edge",
		reason: "Quick halves keep up with its speed, and two bodies take two rushes to finish."
	},
	{
		x: "slime",
		y: "vampire",
		intended: "y",
		level: "edge",
		reason: "Two bodies to bite means twice the lifesteal."
	},
	{
		x: "slime",
		y: "archer",
		intended: "x",
		level: "edge",
		reason: "An arrow finishes one half at most; the other is already on it."
	},
	{
		x: "slime",
		y: "storm",
		intended: "even",
		reason: "A strike hits one half, and the halves rarely stand together."
	},
	{
		x: "slime",
		y: "frost",
		intended: "y",
		level: "edge",
		reason: "Its slow takes away the halves’ extra speed, and its big health outlasts them."
	},
	{
		x: "slime",
		y: "thorns",
		intended: "even",
		reason: "Two halves bump the spikes twice as often, for less each time."
	},
	{
		x: "slime",
		y: "venom",
		intended: "y",
		level: "edge",
		reason: "Each bump poisons again, and the poison keeps ticking whichever half it lands on."
	},
	{
		x: "slime",
		y: "berserker",
		intended: "even",
		reason: "Its rage grows on every hit, and both halves keep hitting: even."
	},
	{
		x: "slime",
		y: "sniper",
		intended: "x",
		level: "strong",
		reason: "One heavy shot finishes one half; the other closes in while it reloads."
	},
	{
		x: "slime",
		y: "quake",
		intended: "even",
		reason: "Shockwaves catch both halves, but each for little: even."
	},
	{
		x: "slime",
		y: "magnet",
		intended: "even",
		reason: "It never hits from range, so it meets only the timed pull: a plain brawl."
	},
	{
		x: "slime",
		y: "ghost",
		intended: "y",
		level: "edge",
		reason: "Phasing, it hits each half it passes through, and no half can touch it then."
	},
	{
		x: "slime",
		y: "necromancer",
		intended: "even",
		reason: "Skulls chase one half while the other bumps the Necromancer: even."
	},
	{
		x: "slime",
		y: "chrono",
		intended: "even",
		reason: "A rewind undoes a hit on one half, not the split: even."
	},
	{
		x: "slime",
		y: "titan",
		intended: "even",
		reason: "The grown Titan crushes a small half, but halves keep it from growing."
	},
	{
		x: "slime",
		y: "inferno",
		intended: "even",
		reason: "Its trail burns one half at a time: even."
	},
	{
		x: "slime",
		y: "boomerang",
		intended: "even",
		reason: "Its blade hits both halves on the way back, but rarely: even."
	},
	{
		x: "slime",
		y: "bomber",
		intended: "even",
		reason: "A blast can catch both halves together, but they rarely bunch: even."
	},
	{
		x: "slime",
		y: "spartan",
		intended: "x",
		level: "edge",
		reason: "The spear finishes one half, while the other bumps the frail Spartan."
	},
	{
		x: "slime",
		y: "bloom",
		intended: "y",
		level: "edge",
		reason: "The halves’ lighter bumps leave gaps it regrows in."
	},
	{
		x: "slime",
		y: "hex",
		intended: "x",
		level: "edge",
		reason: "Once it splits, a curse lands on one half, and the other bumps free."
	},
	{
		x: "slime",
		y: "spider",
		intended: "y",
		level: "edge",
		reason: "Both halves bounce off the walls, and every web slows the one it catches."
	},
	{
		x: "slime",
		y: "battery",
		intended: "even",
		reason: "Its stored hits are spent on one half: even."
	}
];
// src/sim/counter-map-balloon.ts
/**
* It floats: fire, bombs, shockwaves and lightning land at half, but every shot hits it harder. So
* it beats the balls that win through the court (the Inferno, Bomber, Storm and Quake) and loses
* to the shooters (the Archer, Sniper and Boomerang). Bumps, curses and heals meet it as anyone.
*/
var BALLOON_ENTRIES = [
	{
		x: "balloon",
		y: "brawler",
		intended: "even",
		reason: "Two heavy bumpers, with nothing to float over or shoot: even."
	},
	{
		x: "balloon",
		y: "speedster",
		intended: "x",
		level: "edge",
		reason: "Its big health and heavy bumps outlast the Speedster’s rushes."
	},
	{
		x: "balloon",
		y: "vampire",
		intended: "y",
		level: "edge",
		reason: "Bumps are all either has, and the Vampire heals from every one."
	},
	{
		x: "balloon",
		y: "archer",
		intended: "y",
		level: "strong",
		reason: "Every arrow hits it harder, from out of reach."
	},
	{
		x: "balloon",
		y: "storm",
		intended: "x",
		level: "strong",
		reason: "Lightning lands at half on it, and the Storm’s light bumps can’t make up the rest."
	},
	{
		x: "balloon",
		y: "frost",
		intended: "even",
		reason: "Bump for bump with the sturdy Frost; floating changes nothing here: even."
	},
	{
		x: "balloon",
		y: "thorns",
		intended: "y",
		level: "edge",
		reason: "Its heavy bumps feed the spikes, and floating doesn’t lift it off them."
	},
	{
		x: "balloon",
		y: "venom",
		intended: "even",
		reason: "Poison lands as it is, and its big health holds out against the drips: even."
	},
	{
		x: "balloon",
		y: "berserker",
		intended: "even",
		reason: "Each heavy bump it lands adds rage, but its big health holds out: even."
	},
	{
		x: "balloon",
		y: "sniper",
		intended: "y",
		level: "strong",
		reason: "A heavy shot hits it harder still: the Sniper’s lock-on pops it."
	},
	{
		x: "balloon",
		y: "quake",
		intended: "x",
		level: "strong",
		reason: "Shockwaves land at half on it, and the Quake lives on them."
	},
	{
		x: "balloon",
		y: "magnet",
		intended: "even",
		reason: "Pulled in or not, it bumps as hard as the Magnet: even."
	},
	{
		x: "balloon",
		y: "ghost",
		intended: "even",
		reason: "Phasing dodges its bumps for a while; its big health evens it out."
	},
	{
		x: "balloon",
		y: "necromancer",
		intended: "even",
		reason: "Skulls bite it as anyone, and its heavy bumps break them: even."
	},
	{
		x: "balloon",
		y: "chrono",
		intended: "even",
		reason: "The Chrono rewinds one heavy bump, but the Balloon keeps landing them: even."
	},
	{
		x: "balloon",
		y: "titan",
		intended: "even",
		reason: "Bump for bump with the growing Titan; neither floats nor shoots: even."
	},
	{
		x: "balloon",
		y: "inferno",
		intended: "x",
		level: "strong",
		reason: "Fire burns it at half, and the Inferno has little else."
	},
	{
		x: "balloon",
		y: "boomerang",
		intended: "y",
		level: "strong",
		reason: "The boomerang hits it harder going out, and again coming back."
	},
	{
		x: "balloon",
		y: "bomber",
		intended: "x",
		level: "strong",
		reason: "Bombs blow at half on it, and the Bomber’s light bumps can’t make up the rest."
	},
	{
		x: "balloon",
		y: "spartan",
		intended: "y",
		level: "edge",
		reason: "The spear is a shot, so it hits harder, and the shield halves its bumps."
	},
	{
		x: "balloon",
		y: "bloom",
		intended: "y",
		level: "edge",
		reason: "The Bloom regrows between its bumps, and floating doesn’t stop that."
	},
	{
		x: "balloon",
		y: "hex",
		intended: "y",
		level: "edge",
		reason: "The curse takes a share of its health, so its big health doesn’t help."
	},
	{
		x: "balloon",
		y: "spider",
		intended: "even",
		reason: "Webs slow it on the walls like anyone, and its bumps hit back: even."
	},
	{
		x: "balloon",
		y: "battery",
		intended: "x",
		level: "edge",
		reason: "Bumps aren’t stored, so the Battery meets it as a plain bumper with less health."
	},
	{
		x: "balloon",
		y: "slime",
		intended: "even",
		reason: "Its heavy bumps split the Slime as well as any: even."
	},
	{
		x: "balloon",
		y: "banshee",
		intended: "x",
		level: "edge",
		reason: "Nothing stops the wail, but its heavy bumps outweigh the Banshee’s weak ones."
	},
	{
		x: "balloon",
		y: "kraken",
		intended: "y",
		level: "edge",
		reason: "Tentacles aren’t an area hit: the crush lands whole on it."
	}
];
// src/sim/counter-map-banshee.ts
/**
* Its wail hits all around it and nothing blocks it. So it beats the balls whose defence is not
* being touched (the phased Ghost) and the frail Vampire, which heals only from bumps; and loses to
* the Chrono, which rewinds one big hit, to shooters outside its ring and to the grown Titan.
*/
var BANSHEE_ENTRIES = [
	{
		x: "banshee",
		y: "brawler",
		intended: "even",
		reason: "The wail lands every time, and the Brawler’s heavy bumps answer it: even."
	},
	{
		x: "banshee",
		y: "speedster",
		intended: "even",
		reason: "The Speedster rushes in and out of the ring: even."
	},
	{
		x: "banshee",
		y: "vampire",
		intended: "x",
		level: "edge",
		reason: "The wail needs no touch, though each one sends the thirsty Vampire in fast."
	},
	{
		x: "banshee",
		y: "archer",
		intended: "y",
		level: "strong",
		reason: "Arrows come from outside its ring, and it has little health."
	},
	{
		x: "banshee",
		y: "storm",
		intended: "even",
		reason: "Lightning and the wail trade big hits from afar: even."
	},
	{
		x: "banshee",
		y: "frost",
		intended: "even",
		reason: "The sturdy Frost soaks up the wails: even."
	},
	{
		x: "banshee",
		y: "thorns",
		intended: "even",
		reason: "The wail never touches the spikes, but the Thorns’ big health soaks it up: even."
	},
	{
		x: "banshee",
		y: "venom",
		intended: "even",
		reason: "The wail and the poison both hurt without a bump: even."
	},
	{
		x: "banshee",
		y: "berserker",
		intended: "y",
		level: "edge",
		reason: "Every wail builds rage, and its weak bump can’t stop the bump that lets it out."
	},
	{
		x: "banshee",
		y: "sniper",
		intended: "y",
		level: "edge",
		reason: "The heavy shot comes from outside the ring, and it has little health."
	},
	{
		x: "banshee",
		y: "quake",
		intended: "even",
		reason: "The wail and the shockwaves both hit all around: even."
	},
	{
		x: "banshee",
		y: "magnet",
		intended: "even",
		reason: "The pull drags it in close, where the wail lands anyway: even."
	},
	{
		x: "banshee",
		y: "ghost",
		intended: "x",
		level: "strong",
		reason: "Phasing slips every bump, but not the wail: nothing blocks it."
	},
	{
		x: "banshee",
		y: "necromancer",
		intended: "even",
		reason: "Skulls bite while the wail hits the Necromancer itself: even."
	},
	{
		x: "banshee",
		y: "chrono",
		intended: "y",
		level: "strong",
		reason: "One big wail is just what the Chrono rewinds."
	},
	{
		x: "banshee",
		y: "titan",
		intended: "y",
		level: "strong",
		reason: "The grown Titan has the health to take the wails, and bumps hard back."
	},
	{
		x: "banshee",
		y: "inferno",
		intended: "even",
		reason: "Fire and the wail both hurt without a bump: even."
	},
	{
		x: "banshee",
		y: "boomerang",
		intended: "y",
		level: "edge",
		reason: "The boomerang hits it from outside the ring, twice a throw."
	},
	{
		x: "banshee",
		y: "bomber",
		intended: "even",
		reason: "Bombs and wails trade big hits: even."
	},
	{
		x: "banshee",
		y: "spartan",
		intended: "even",
		reason: "The wail goes through the shield, and the spear comes back at it: even."
	},
	{
		x: "banshee",
		y: "bloom",
		intended: "even",
		reason: "Each wail makes the Bloom wait, but it wails only every few seconds: even."
	},
	{
		x: "banshee",
		y: "hex",
		intended: "even",
		reason: "The curse takes its share and the wail its own: even."
	},
	{
		x: "banshee",
		y: "spider",
		intended: "x",
		level: "edge",
		reason: "The wail reaches the Spider anywhere, and webs barely slow what it does."
	},
	{
		x: "banshee",
		y: "battery",
		intended: "even",
		reason: "Nothing blocks the wail, so the Battery stores none of it: even."
	},
	{
		x: "banshee",
		y: "slime",
		intended: "y",
		level: "edge",
		reason: "Its weak bump splits the Slime late, and the halves’ double bumps win."
	},
	{
		x: "banshee",
		y: "kraken",
		intended: "even",
		reason: "The wail reaches the Kraken while it anchors to squeeze: even."
	}
];
// src/sim/counter-map-kraken.ts
/**
* Its tentacles rise where its enemy is heading, hold it almost still and crush it, more for a
* bigger ball. A held ball loses its ability: the Vampire can't bump to heal, the Spider's anchored
* enemy never bounces into a web, and the grown Titan takes four tentacles. Standing still to
* squeeze makes it a target for heavy aimed hits (the Storm, Sniper and Spartan), and the phased
* Ghost slips the grab.
*/
var KRAKEN_ENTRIES = [
	{
		x: "kraken",
		y: "brawler",
		intended: "x",
		level: "edge",
		reason: "The plain Brawler runs onto its tentacles with nothing to slip them."
	},
	{
		x: "kraken",
		y: "speedster",
		intended: "y",
		level: "edge",
		reason: "Its wall bounces change its line, so the tentacles often rise where it isn’t."
	},
	{
		x: "kraken",
		y: "vampire",
		intended: "x",
		level: "edge",
		reason: "A held Vampire can’t bump to heal, though the crush makes it thirsty after."
	},
	{
		x: "kraken",
		y: "archer",
		intended: "y",
		level: "edge",
		reason: "Arrows keep hitting the anchored Kraken while it squeezes."
	},
	{
		x: "kraken",
		y: "storm",
		intended: "y",
		level: "strong",
		reason: "Anchored to squeeze, it stands still under the lightning."
	},
	{
		x: "kraken",
		y: "frost",
		intended: "x",
		level: "edge",
		reason: "The slow Frost is easy to wrap and crush."
	},
	{
		x: "kraken",
		y: "thorns",
		intended: "x",
		level: "edge",
		reason: "Tentacles crush without a bump, so the spikes never bite."
	},
	{
		x: "kraken",
		y: "venom",
		intended: "even",
		reason: "The poison drips while the tentacles crush: even."
	},
	{
		x: "kraken",
		y: "berserker",
		intended: "even",
		reason: "One crush is one hit, so it stores only one rage: even."
	},
	{
		x: "kraken",
		y: "sniper",
		intended: "y",
		level: "strong",
		reason: "The anchored Kraken is a still target for the heavy shot."
	},
	{
		x: "kraken",
		y: "quake",
		intended: "even",
		reason: "A held Quake makes no wall hits, but the grip is short: even."
	},
	{
		x: "kraken",
		y: "magnet",
		intended: "even",
		reason: "The pull and the grab each drag the other off its line: even."
	},
	{
		x: "kraken",
		y: "ghost",
		intended: "y",
		level: "strong",
		reason: "Phased, it slips the grab, and hits the anchored Kraken as it passes."
	},
	{
		x: "kraken",
		y: "necromancer",
		intended: "x",
		level: "edge",
		reason: "The tentacles ignore the skull and wrap the Necromancer itself."
	},
	{
		x: "kraken",
		y: "chrono",
		intended: "x",
		level: "edge",
		reason: "A crush of 12 is under the Chrono’s line of 20, so it never rewinds one."
	},
	{
		x: "kraken",
		y: "titan",
		intended: "x",
		level: "strong",
		reason: "A grown Titan is wrapped by four tentacles and crushed twice as hard."
	},
	{
		x: "kraken",
		y: "inferno",
		intended: "x",
		level: "edge",
		reason: "The slow Inferno is easy to wrap, and its fire barely fights back."
	},
	{
		x: "kraken",
		y: "boomerang",
		intended: "y",
		level: "edge",
		reason: "The boomerang hits the anchored Kraken going out and coming back."
	},
	{
		x: "kraken",
		y: "bomber",
		intended: "even",
		reason: "A held Bomber still drops its bombs where it stands: even."
	},
	{
		x: "kraken",
		y: "spartan",
		intended: "y",
		level: "strong",
		reason: "Anchored to squeeze, it takes the spear, and the shield halves the crush."
	},
	{
		x: "kraken",
		y: "bloom",
		intended: "even",
		reason: "The crush makes the Bloom wait, but only once a grip: even."
	},
	{
		x: "kraken",
		y: "hex",
		intended: "even",
		reason: "The curse and the crush each take a big bite: even."
	},
	{
		x: "kraken",
		y: "spider",
		intended: "x",
		level: "strong",
		reason: "Anchored, it never bounces into a web, and it wraps the Spider like anyone."
	},
	{
		x: "kraken",
		y: "battery",
		intended: "even",
		reason: "A crush of 12 is too small for the Battery to store: even."
	},
	{
		x: "kraken",
		y: "slime",
		intended: "even",
		reason: "It wraps both halves, but their double bumps even it out."
	}
];
// src/sim/counter-map-mirage.ts
/**
* Aimed attacks go for its shimmering copy: the Archer's arrows and the Boomerang's throws pop air
* while the real Mirage bumps in. Nothing else is fooled: spikes, poison, tentacles, a curse and a
* heal from bumps all find the real ball, and its heavy bump feeds the Thorns and the Vampire.
*/
var MIRAGE_ENTRIES = [
	{
		x: "mirage",
		y: "brawler",
		intended: "even",
		reason: "Plain bumps on both sides; the copy fools no bumper: even."
	},
	{
		x: "mirage",
		y: "speedster",
		intended: "even",
		reason: "The Speedster hits by bumping, so the copy never fools it: even."
	},
	{
		x: "mirage",
		y: "vampire",
		intended: "y",
		level: "edge",
		reason: "Its heavy bumps feed the Vampire’s heal, and the copy fools no bumper."
	},
	{
		x: "mirage",
		y: "archer",
		intended: "x",
		level: "strong",
		reason: "Arrows fly at the copy while the real Mirage bumps in from the side."
	},
	{
		x: "mirage",
		y: "storm",
		intended: "even",
		reason: "A bolt at the copy pops it, but the next one finds the Mirage: even."
	},
	{
		x: "mirage",
		y: "frost",
		intended: "even",
		reason: "The slow comes with a bump, so the copy takes none of it: even."
	},
	{
		x: "mirage",
		y: "thorns",
		intended: "y",
		level: "strong",
		reason: "Its heavy bumps come back off the spikes, and spikes aren’t aimed."
	},
	{
		x: "mirage",
		y: "venom",
		intended: "y",
		level: "edge",
		reason: "Poison comes with a bump, so the copy never takes any of it."
	},
	{
		x: "mirage",
		y: "berserker",
		intended: "even",
		reason: "Rage builds from bumps the copy can’t take: even."
	},
	{
		x: "mirage",
		y: "sniper",
		intended: "even",
		reason: "One shot pops the copy and the next locks onto the Mirage: even."
	},
	{
		x: "mirage",
		y: "quake",
		intended: "even",
		reason: "Shockwaves pop the copy and chip the Mirage alike: even."
	},
	{
		x: "mirage",
		y: "magnet",
		intended: "even",
		reason: "The pull drags the real Mirage, not its copy: even."
	},
	{
		x: "mirage",
		y: "ghost",
		intended: "even",
		reason: "The Ghost aims nothing, so the copy changes nothing: even."
	},
	{
		x: "mirage",
		y: "necromancer",
		intended: "even",
		reason: "The skeleton bites the real Mirage, but its heavy bump pops it: even."
	},
	{
		x: "mirage",
		y: "chrono",
		intended: "even",
		reason: "The rewind undoes bumps; the copy fools nothing it does: even."
	},
	{
		x: "mirage",
		y: "titan",
		intended: "even",
		reason: "The Titan only bumps; the copy changes nothing: even."
	},
	{
		x: "mirage",
		y: "inferno",
		intended: "even",
		reason: "The fire trail is never aimed, so the copy changes nothing: even."
	},
	{
		x: "mirage",
		y: "boomerang",
		intended: "x",
		level: "strong",
		reason: "Its boomerang flies at the copy, so most throws only pop air."
	},
	{
		x: "mirage",
		y: "bomber",
		intended: "even",
		reason: "Bombs blow when touched, aimed at nothing: even."
	},
	{
		x: "mirage",
		y: "spartan",
		intended: "x",
		level: "edge",
		reason: "Spears fly at the copy, so the shield alone has to hold it off."
	},
	{
		x: "mirage",
		y: "bloom",
		intended: "y",
		level: "edge",
		reason: "The Bloom regrows between bumps, and nothing it does is aimed."
	},
	{
		x: "mirage",
		y: "hex",
		intended: "y",
		level: "strong",
		reason: "The curse bursts for a share of health, and the Mirage has plenty."
	},
	{
		x: "mirage",
		y: "spider",
		intended: "even",
		reason: "Webs on the walls nip the real Mirage; the copy changes nothing: even."
	},
	{
		x: "mirage",
		y: "battery",
		intended: "even",
		reason: "The Battery aims nothing, so the copy changes nothing: even."
	},
	{
		x: "mirage",
		y: "slime",
		intended: "even",
		reason: "Two halves bump it twice; its heavy bump splits them fast: even."
	},
	{
		x: "mirage",
		y: "balloon",
		intended: "even",
		reason: "Two heavy bumpers, and the Balloon shoots nothing: even."
	},
	{
		x: "mirage",
		y: "banshee",
		intended: "even",
		reason: "The wail rings all around, copy or not: even."
	},
	{
		x: "mirage",
		y: "kraken",
		intended: "y",
		level: "edge",
		reason: "Tentacles rise where the real Mirage is heading, never at its copy."
	}
];
// src/sim/counter-map-jouster.ts
/**
* Its lance lands triple head-on and barely scratches at a glance. A still or frail target takes
* the whole lance (the anchored Kraken, the Vampire, the Bloom between regrowths); spikes throw it
* back, and the Slime's small halves and the wall-bouncing Quake turn its charges into glances.
*/
var JOUSTER_ENTRIES = [
	{
		x: "jouster",
		y: "brawler",
		intended: "x",
		level: "edge",
		reason: "A head-on lance hits three times as hard as the Brawler’s plain bump."
	},
	{
		x: "jouster",
		y: "speedster",
		intended: "even",
		reason: "Its wall bounces turn many charges into glances: even."
	},
	{
		x: "jouster",
		y: "vampire",
		intended: "x",
		level: "strong",
		reason: "One head-on lance takes most of the Vampire’s little health."
	},
	{
		x: "jouster",
		y: "archer",
		intended: "x",
		level: "edge",
		reason: "A charge closes the gap fast, and the Archer is frail up close."
	},
	{
		x: "jouster",
		y: "storm",
		intended: "even",
		reason: "Bolts hit it as it charges, but a lance hits back hard: even."
	},
	{
		x: "jouster",
		y: "frost",
		intended: "even",
		reason: "A slowed Jouster still charges straight: even."
	},
	{
		x: "jouster",
		y: "thorns",
		intended: "y",
		level: "strong",
		reason: "Its own lance comes back off the spikes, three times as hard."
	},
	{
		x: "jouster",
		y: "venom",
		intended: "y",
		level: "edge",
		reason: "Poison works between its charges, and its glancing bumps are light."
	},
	{
		x: "jouster",
		y: "berserker",
		intended: "even",
		reason: "A lance hit stores one rage like any other: even."
	},
	{
		x: "jouster",
		y: "sniper",
		intended: "even",
		reason: "The Sniper hits hard from afar, but a lance hits back: even."
	},
	{
		x: "jouster",
		y: "quake",
		intended: "y",
		level: "strong",
		reason: "Shockwaves chip it at every wall, and the bouncing Quake makes its lance glance."
	},
	{
		x: "jouster",
		y: "magnet",
		intended: "x",
		level: "edge",
		reason: "The pull lines it up head-on for its lance."
	},
	{
		x: "jouster",
		y: "ghost",
		intended: "even",
		reason: "A lance passes through the faded Ghost like any bump: even."
	},
	{
		x: "jouster",
		y: "necromancer",
		intended: "even",
		reason: "The skeleton gets in the way of its charges, but pops to a lance: even."
	},
	{
		x: "jouster",
		y: "chrono",
		intended: "even",
		reason: "A big lance hit is just what the rewind undoes: even."
	},
	{
		x: "jouster",
		y: "titan",
		intended: "even",
		reason: "A grown Titan is a big target, and hits back as hard: even."
	},
	{
		x: "jouster",
		y: "inferno",
		intended: "even",
		reason: "Its charges cross the fire, but a lance hits back: even."
	},
	{
		x: "jouster",
		y: "boomerang",
		intended: "x",
		level: "edge",
		reason: "A charge closes the gap fast, and the Boomerang is frail up close."
	},
	{
		x: "jouster",
		y: "bomber",
		intended: "even",
		reason: "Its charges run through bombs, but a lance hits back: even."
	},
	{
		x: "jouster",
		y: "spartan",
		intended: "even",
		reason: "The shield halves a lance hit, and the spear hits back: even."
	},
	{
		x: "jouster",
		y: "bloom",
		intended: "x",
		level: "strong",
		reason: "Big lance hits outpace the Bloom’s regrowth."
	},
	{
		x: "jouster",
		y: "hex",
		intended: "even",
		reason: "The curse and the lance each take a big bite: even."
	},
	{
		x: "jouster",
		y: "spider",
		intended: "even",
		reason: "Webs slow it at the walls, but its charges run straight: even."
	},
	{
		x: "jouster",
		y: "battery",
		intended: "even",
		reason: "A lance is a bump, which the Battery never stores: even."
	},
	{
		x: "jouster",
		y: "slime",
		intended: "y",
		level: "strong",
		reason: "Its small halves turn most charges into glancing scratches."
	},
	{
		x: "jouster",
		y: "balloon",
		intended: "even",
		reason: "The Balloon floats, but a lance pops it like any bump: even."
	},
	{
		x: "jouster",
		y: "banshee",
		intended: "x",
		level: "edge",
		reason: "Two head-on lances finish the frail Banshee between wails."
	},
	{
		x: "jouster",
		y: "kraken",
		intended: "x",
		level: "strong",
		reason: "It charges dead on into the anchored Kraken while it squeezes."
	},
	{
		x: "jouster",
		y: "mirage",
		intended: "even",
		reason: "The copy fools no lance, and the Mirage’s bump is heavy: even."
	}
];
// src/sim/counter-map.ts
/** Every pair of balls exactly once, with its intended result and why (a test checks coverage). */
var COUNTER_MAP = [
	...FIRST_ENTRIES,
	...BATCH_THREE_ENTRIES,
	...BATCH_FOUR_ENTRIES,
	...BATCH_FIVE_ENTRIES,
	...RULES_OUT_STORM_QUAKE_ENTRIES,
	...RULES_OUT_BERSERKER_VAMPIRE_ENTRIES,
	...RULES_OUT_ARCHER_SNIPER_ENTRIES,
	...RULES_OUT_BOOMERANG_ENTRIES,
	...HIT_KIND_CHRONO_ENTRIES,
	...HIT_KIND_GHOST_BLOOM_VENOM_ENTRIES,
	...SPARTAN_ENTRIES,
	...HEX_ENTRIES,
	...SPIDER_ENTRIES,
	...GHOST_ENTRIES,
	...BATTERY_ENTRIES,
	...SLIME_ENTRIES,
	...BALLOON_ENTRIES,
	...BANSHEE_ENTRIES,
	...KRAKEN_ENTRIES,
	...MIRAGE_ENTRIES,
	...JOUSTER_ENTRIES
];
/** The map entry for a pair, whichever order the pair comes in. */
function counterFor(a, b) {
	return COUNTER_MAP.find((entry) => entry.x === a && entry.y === b || entry.x === b && entry.y === a);
}
/** A pair's favoured ball and its level, or undefined for an even pair (or a mirror). */
function matchupOf(a, b) {
	const entry = a === b ? void 0 : counterFor(a, b);
	if (entry === void 0 || entry.intended === "even") return void 0;
	return {
		favoured: entry.intended === "x" ? entry.x : entry.y,
		level: entry.level
	};
}
function standingOf(ball, opponent) {
	const matchup = matchupOf(ball, opponent);
	if (matchup === void 0) return 0;
	const size = matchup.level === "strong" ? 2 : 1;
	return matchup.favoured === ball ? size : size === 2 ? -2 : -1;
}
// src/sim/bot-model.ts
/**
* Round odds the bot assumes for the favoured side, by level: the middle of each level's band, the
* same levels players read in the manual (ADR 0073). The other side's are what is left.
*/
var LEVEL_ODDS = {
	strong: .7,
	edge: .6,
	even: .5
};
/** The chance `ball` beats `opponent` in one round, by the counter map's level. */
var mapOdds = (ball, opponent) => {
	const standing = standingOf(ball, opponent);
	const size = standing < 0 ? -standing : standing;
	const odds = size === 2 ? LEVEL_ODDS.strong : size === 1 ? LEVEL_ODDS.edge : LEVEL_ODDS.even;
	return standing < 0 ? 1 - odds : odds;
};
var without = (balls, ball) => balls.filter((id) => id !== ball);
var keyOf = (p, lead) => `${p.format}|${[...p.own].sort().join()}|${[...p.opponent].sort().join()}|${String(p.wins)}-${String(p.losses)}/${String(p.winsNeeded)}|${lead}`;
/**
* Who shows first in the round after this one. Reveal alternates (ADR 0021); Showdown's winner
* shows first (ADR 0035).
*/
function nextLead(format, lead, botWon) {
	if (format === "reveal") return lead === "bot" ? "opponent" : "bot";
	return botWon ? "bot" : "opponent";
}
/** The bot's series chance once this round pairs `ball` with `against`, with best play after. */
function afterRound(position, lead, ball, against, memo = /* @__PURE__ */ new Map()) {
	const odds = (position.odds ?? mapOdds)(ball, against);
	const rest = {
		...position,
		own: without(position.own, ball),
		opponent: without(position.opponent, against)
	};
	const won = seriesValue({
		...rest,
		wins: position.wins + 1
	}, nextLead(position.format, lead, true), memo);
	const lost = seriesValue({
		...rest,
		losses: position.losses + 1
	}, nextLead(position.format, lead, false), memo);
	return odds * won + (1 - odds) * lost;
}
/**
* The bot's series chance from `position` when `lead` shows first this round, both sides choosing
* their best: the one showing first takes the choice whose best answer is least bad for it.
*/
function seriesValue(position, lead, memo = /* @__PURE__ */ new Map()) {
	if (position.wins >= position.winsNeeded) return 1;
	if (position.losses >= position.winsNeeded) return 0;
	const [own, against] = [position.own[0], position.opponent[0]];
	if (position.own.length === 1 && own !== void 0 && against !== void 0) return (position.odds ?? mapOdds)(own, against);
	const key = keyOf(position, lead);
	const known = memo.get(key);
	if (known !== void 0) return known;
	const value = (ball, other) => afterRound(position, lead, ball, other, memo);
	const result = lead === "bot" ? Math.max(...position.own.map((ball) => Math.min(...position.opponent.map((y) => value(ball, y))))) : Math.min(...position.opponent.map((y) => Math.max(...position.own.map((ball) => value(ball, y)))));
	memo.set(key, result);
	return result;
}
// src/sim/maximin.ts
/**
* The row mix that maximises the row player's worst case in the zero-sum game `matrix` (rows: the
* maximiser's choices, columns: the minimiser's). Up to 3 x 3 it is the exact small solver Best of
* 3 has always used, so its choices never change; larger games (a Best of 5's opener) use the
* general one.
*/
function maximinMix(matrix) {
	const columns = matrix[0]?.length ?? 0;
	return matrix.length <= 3 && columns <= 3 ? maximinMixSmall(matrix) : maximinMixAny(matrix);
}
/**
* The mix of rows that maximises the row player's worst case in the zero-sum game `matrix` (rows:
* the maximiser's choices, columns: the minimiser's), for up to three rows. Exact: the optimum of a
* game this small is a pure row, a mix of two rows that makes two columns equal, or a mix of three
* that makes three columns equal, so every candidate is tried. Ties keep the earliest candidate.
*/
function maximinMixSmall(matrix) {
	const rows = matrix.length;
	const columns = matrix[0]?.length ?? 0;
	const at = (row, column) => matrix[row]?.[column] ?? 0;
	const worst = (mix) => {
		let lowest = Infinity;
		for (let c = 0; c < columns; c++) {
			let sum = 0;
			for (let r = 0; r < rows; r++) sum += (mix[r] ?? 0) * at(r, c);
			lowest = Math.min(lowest, sum);
		}
		return lowest;
	};
	const pure = (row) => Array.from({ length: rows }, (_, r) => r === row ? 1 : 0);
	const candidates = Array.from({ length: rows }, (_, row) => pure(row));
	for (let i = 0; i < rows; i++) for (let j = i + 1; j < rows; j++) for (let c = 0; c < columns; c++) for (let d = c + 1; d < columns; d++) {
		const slope = at(i, c) - at(j, c) - (at(i, d) - at(j, d));
		if (slope === 0) continue;
		const t = (at(j, d) - at(j, c)) / slope;
		if (t <= 0 || t >= 1) continue;
		const mix = Array.from({ length: rows }, () => 0);
		mix[i] = t;
		mix[j] = 1 - t;
		candidates.push(mix);
	}
	if (rows === 3 && columns === 3) {
		const g = (r, c) => at(r, c) - at(2, c);
		const a1 = g(0, 0) - g(0, 1);
		const b1 = g(1, 0) - g(1, 1);
		const c1 = at(2, 1) - at(2, 0);
		const a2 = g(0, 0) - g(0, 2);
		const b2 = g(1, 0) - g(1, 2);
		const c2 = at(2, 2) - at(2, 0);
		const det = a1 * b2 - a2 * b1;
		if (det !== 0) {
			const x = (c1 * b2 - c2 * b1) / det;
			const y = (a1 * c2 - a2 * c1) / det;
			if (x > 0 && y > 0 && x + y < 1) candidates.push([
				x,
				y,
				1 - x - y
			]);
		}
	}
	let best = candidates[0] ?? [];
	let bestValue = worst(best);
	for (const mix of candidates) {
		const value = worst(mix);
		if (value > bestValue + 1e-12) {
			best = mix;
			bestValue = value;
		}
	}
	return best;
}
/** Solves `a x = b` by Gaussian elimination with partial pivoting; undefined when singular. */
function solve(a, b) {
	const n = b.length;
	const m = a.map((row, i) => [...row, b[i] ?? 0]);
	for (let col = 0; col < n; col++) {
		let pivot = col;
		for (let r = col + 1; r < n; r++) if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) pivot = r;
		if (Math.abs(m[pivot]?.[col] ?? 0) < 1e-12) return void 0;
		[m[col], m[pivot]] = [m[pivot] ?? [], m[col] ?? []];
		const top = m[col] ?? [];
		for (let r = 0; r < n; r++) {
			if (r === col) continue;
			const row = m[r] ?? [];
			const f = (row[col] ?? 0) / (top[col] ?? 1);
			for (let c = col; c <= n; c++) row[c] = (row[c] ?? 0) - f * (top[c] ?? 0);
		}
	}
	return m.map((row, i) => (row[n] ?? 0) / (row[i] ?? 1));
}
function subsets(n, k) {
	if (k === 0) return [[]];
	const out = [];
	const go = (start, picked) => {
		if (picked.length === k) {
			out.push(picked);
			return;
		}
		for (let i = start; i < n; i++) go(i + 1, [...picked, i]);
	};
	go(0, []);
	return out;
}
/**
* The same for any size (ADR 0048, from the Best of 5 measurement's bot): every square support of
* rows and columns, mixed so those columns pay the same. Ties keep the earliest candidate (smallest
* supports first).
*/
function maximinMixAny(matrix) {
	const rows = matrix.length;
	const columns = matrix[0]?.length ?? 0;
	const at = (r, c) => matrix[r]?.[c] ?? 0;
	const worst = (mix) => {
		let lowest = Infinity;
		for (let c = 0; c < columns; c++) {
			let sum = 0;
			for (let r = 0; r < rows; r++) sum += (mix[r] ?? 0) * at(r, c);
			lowest = Math.min(lowest, sum);
		}
		return lowest;
	};
	let best = [];
	let bestValue = -Infinity;
	for (let k = 1; k <= Math.min(rows, columns); k++) for (const rs of subsets(rows, k)) for (const cs of subsets(columns, k)) {
		const a = cs.map((c) => [...rs.map((r) => at(r, c)), -1]);
		a.push([...rs.map(() => 1), 0]);
		const x = solve(a, [...cs.map(() => 0), 1]);
		if (x === void 0 || rs.some((_, i) => (x[i] ?? 0) < -1e-12)) continue;
		const mix = Array.from({ length: rows }, () => 0);
		rs.forEach((r, i) => mix[r] = Math.max(0, x[i] ?? 0));
		const value = worst(mix);
		if (value > bestValue + 1e-12) {
			best = mix;
			bestValue = value;
		}
	}
	return best;
}
// src/sim/series-seeds.ts
/** Salts, so a round seed, an attempt seed and a coin flip never share a stream. */
var ROUND_SALT = 6189317;
var ATTEMPT_SALT = 175629239;
var SUDDEN_DEATH_SALT = 6151751;
/** Reveal's coin toss for who shows first in round 1 (ADR 0029). */
var TOSS_SALT = 1884647509;
/** The seed of round `round` (0-based) of a series. 32-bit integer maths only, exact everywhere. */
function roundSeed(seriesSeed, round) {
	return deriveSeed([
		seriesSeed,
		ROUND_SALT,
		round
	]);
}
/** The seed of play `attempt` (0-based) of a round: the round seed first, then derived ones. */
function attemptSeed(seedOfRound, attempt) {
	return attempt === 0 ? seedOfRound : deriveSeed([
		seedOfRound,
		ATTEMPT_SALT,
		attempt
	]);
}
/** Who wins a round that drew MAX_ATTEMPTS times: a coin flip seeded from the round seed. */
function suddenDeathWinner(seedOfRound) {
	return nextFloat(deriveSeed([seedOfRound, SUDDEN_DEATH_SALT])).value < .5 ? "a" : "b";
}
var sideOfToss = (tossSeed) => nextFloat(tossSeed).value < .5 ? "a" : "b";
/** Reveal's coin toss (ADR 0029) from a series seed alone: the side that shows first in round 1. */
function revealFirst(seriesSeed) {
	return sideOfToss(deriveSeed([seriesSeed, TOSS_SALT]));
}
/** The seed of a series' round `round` (0-based): its own, else derived from the series seed. */
function roundSeedOf(setup, round) {
	const seeds = setup.seeds;
	if (seeds === void 0) return roundSeed(setup.seed, round);
	const own = seeds.rounds[round];
	if (own === void 0) throw new Error(`The series has no seed for round ${String(round + 1)}`);
	return own;
}
/** Who shows first in round 1 of a Reveal series: its own toss, else the series seed's. */
function firstToShowOf(setup) {
	const toss = setup.seeds?.toss;
	return toss === void 0 ? revealFirst(setup.seed) : sideOfToss(toss);
}
/** The seed of the bot's choice stream: its own, else the series seed (as before ADR 0052). */
var botSeedOf = (setup) => setup.seeds?.bot ?? setup.seed;
// src/sim/series.ts
var BEST_OF = [3, 5];
var DEFAULT_BEST_OF = 3;
var FORMATS = [
	"blind",
	"reveal",
	"showdown"
];
var bestOfOf = (setup) => setup.bestOf ?? 3;
/** Round wins that take a series of this length: a majority of its rounds. */
var winsNeededOf = (bestOf) => (bestOf + 1) / 2;
/** A length a link or a save names, if it is one the game plays. */
var asBestOf = (value) => BEST_OF.find((length) => length === value);
/** True for `size` different ids, all in `validIds`. */
function isValidLineup(ids, validIds, size) {
	return ids.length === size && new Set(ids).size === size && ids.every((id) => validIds.includes(id));
}
function startSeries(setup) {
	return {
		setup,
		rounds: [],
		pending: [],
		winner: void 0,
		picks: []
	};
}
var formatOf = (setup) => setup.format ?? "blind";
var otherSide = (side) => side === "a" ? "b" : "a";
/** A side's balls not yet played in a finished round, in the order it set. */
function remainingOf(state, side) {
	const played = new Set(state.rounds.map((round) => round[side]));
	return state.setup[side].filter((id) => !played.has(id));
}
/** The ball a side plays in the coming round: its pick for that round, else its next in order. */
function nextBallOf(state, side) {
	const round = state.rounds.length;
	return state.picks.find((p) => p.round === round && p.side === side)?.ball ?? remainingOf(state, side)[0];
}
/**
* Who shows first in each round of a `reveal` series, then who answers (ADR 0021, 0029, 0048): the
* toss winner shows first in round 1, then the sides alternate. The last round has no picks: each
* side plays the ball it has left.
*/
function revealTurnsOf(setup) {
	const first = firstToShowOf(setup);
	return Array.from({ length: bestOfOf(setup) - 1 }, (_, round) => {
		const shows = round % 2 === 0 ? first : otherSide(first);
		return [shows, otherSide(shows)];
	});
}
/**
* Who picks in each round of a `showdown` series, in the order the picks are recorded (ADR 0035,
* 0048): round 1 both at once (A's recorded first, but neither sees the other's); in every later
* round but the last, the winner of the round before shows first and the loser answers. The last
* round has no picks. Only rounds whose turns are known yet are listed.
*/
function showdownTurnsOf(state) {
	const picking = bestOfOf(state.setup) - 1;
	return [["a", "b"], ...state.rounds.slice(0, picking - 1).map((round) => [round.winner, otherSide(round.winner)])];
}
/**
* The side that must pick its ball before the next round, if any: whoever's turn it is in the
* round (`revealTurnsOf`, `showdownTurnsOf`), until every side due has picked. A blind series has
* no picks.
*/
function awaitingPick(state) {
	const format = formatOf(state.setup);
	if (state.winner !== void 0 || state.pending.length > 0 || format === "blind") return void 0;
	const round = state.rounds.length;
	const turns = format === "reveal" ? revealTurnsOf(state.setup) : showdownTurnsOf(state);
	const picked = (side) => state.picks.some((p) => p.round === round && p.side === side);
	return turns[round]?.find((side) => !picked(side));
}
/** Records the due pick. Throws when no pick is due or the ball isn't one the side has left. */
function recordPick(state, ball) {
	const side = awaitingPick(state);
	if (side === void 0) throw new Error("No pick is due");
	if (!remainingOf(state, side).includes(ball)) throw new Error(`"${ball}" is not a ball side ${side} has left`);
	return {
		...state,
		picks: [...state.picks, {
			round: state.rounds.length,
			side,
			ball
		}]
	};
}
/** The setup with every pick so far: what a link stores to replay the series. */
function setupWithPicks(state) {
	if (formatOf(state.setup) === "blind") return state.setup;
	return {
		...state.setup,
		picks: state.picks.map((pick) => pick.ball)
	};
}
/** Round wins so far for each side. */
function scoreOf(state) {
	const wins = (side) => state.rounds.filter((round) => round.winner === side).length;
	return {
		a: wins("a"),
		b: wins("b")
	};
}
/** The next match to play, or undefined once the series is decided or while a pick is due. */
function nextMatch(state) {
	if (state.winner !== void 0 || awaitingPick(state) !== void 0) return void 0;
	const round = state.rounds.length;
	const a = nextBallOf(state, "a");
	const b = nextBallOf(state, "b");
	if (a === void 0 || b === void 0) return void 0;
	const attempt = state.pending.length;
	return {
		round,
		attempt,
		seed: attemptSeed(roundSeedOf(state.setup, round), attempt),
		a,
		b
	};
}
/**
* Records how the next match ended. A win ends the round; a draw replays it with the next attempt
* seed, and the MAX_ATTEMPTS-th draw goes to sudden death. The series ends as soon as a side has
* the wins it needs, so a 2-0 never plays round 3 (nor a 3-0 or 3-1 round 5). Throws once the
* series is decided.
*/
function recordOutcome(state, outcome) {
	const match = nextMatch(state);
	if (match === void 0) throw new Error(awaitingPick(state) === void 0 ? "The series is already decided" : "A pick is due before the next round");
	const outcomes = [...state.pending, outcome];
	if (outcome === "draw" && outcomes.length < 3) return {
		...state,
		pending: outcomes
	};
	const seedOfRound = roundSeedOf(state.setup, match.round);
	const suddenDeath = outcome === "draw";
	const record = {
		round: match.round,
		a: match.a,
		b: match.b,
		seeds: outcomes.map((_, attempt) => attemptSeed(seedOfRound, attempt)),
		outcomes,
		winner: suddenDeath ? suddenDeathWinner(seedOfRound) : outcome,
		suddenDeath
	};
	const next = {
		...state,
		rounds: [...state.rounds, record],
		pending: []
	};
	const score = scoreOf(next);
	const needed = winsNeededOf(bestOfOf(state.setup));
	const winner = score.a >= needed ? "a" : score.b >= needed ? "b" : void 0;
	return {
		...next,
		winner
	};
}
/** Which side a finished match's result favours: slot A is ball-0, slot B is ball-1. */
function outcomeOf(result, world) {
	if (result.kind === "draw") return "draw";
	return result.winnerId === world.balls[0]?.id ? "a" : "b";
}
// src/sim/bot-draw.ts
/** Keeps each of the bot's choices on its own stream, apart from the series' round seeds. */
var BOT_SALT = 2823;
var SHOW_SALT = 21513;
var ANSWER_SALT = 42078;
var OPEN_SALT = 3047;
/** Normal and Hard draw on streams of their own, so a level never shares another's draws. */
var LEVEL_SALTS = {
	easy: 3749,
	normal: 460705,
	hard: 19069
};
var ROLE_SALTS = {
	show: SHOW_SALT,
	answer: ANSWER_SALT,
	open: OPEN_SALT
};
/**
* Different balls uniformly at random, in a random order: every level picks this way. Each ball is
* one draw on the stream, so a Best of 5 lineup is its Best of 3 lineup and two more.
*/
function pickLineup(seed, roster, size = 3) {
	if (new Set(roster).size < size) throw new Error(`A lineup needs ${String(size)} different balls`);
	const random = createStream(deriveSeed([seed, BOT_SALT]));
	const pool = [...new Set(roster)];
	const picked = [];
	while (picked.length < size) {
		const index = Math.floor(random() * pool.length);
		picked.push(...pool.splice(index, 1));
	}
	return picked;
}
var uniform = (balls) => balls.map((ball) => [ball, 1 / balls.length]);
/** The balls in `balls` with the highest score, in their order. */
function bestBy(balls, score, margin = 1e-9) {
	const scores = balls.map(score);
	const best = Math.max(...scores);
	return balls.filter((_, index) => (scores[index] ?? -Infinity) >= best - margin);
}
/** Mixes two weightings: `share` of the first, the rest of the second. */
function blend(share, first, second) {
	const total = /* @__PURE__ */ new Map();
	for (const [ball, weight] of first) total.set(ball, (total.get(ball) ?? 0) + share * weight);
	for (const [ball, weight] of second) total.set(ball, (total.get(ball) ?? 0) + (1 - share) * weight);
	return [...total].filter(([, weight]) => weight > 0);
}
/** A seeded draw from `weights`, in their order. */
function draw(weights, seed) {
	const roll = createStream(seed)();
	let sum = 0;
	for (const [ball, weight] of weights) {
		sum += weight;
		if (roll < sum) return ball;
	}
	const last = weights.at(-1);
	if (last === void 0) throw new Error("No ball to choose from");
	return last[0];
}
// src/sim/ruleset.ts
var RULESET_VERSION = 23;
/**
* Older rulesets whose series this build still verifies and replays exactly (ADR 0073): their
* fights, roster, series rules, seeds and salts are today's, and only their bots differ, which
* are kept (`botFor`). `golden.test.ts` checks each one's frozen known results are today's. A
* bump that changes anything but a bot empties this list (and its retired bots go): ruleset 22
* changed fights (three new balls and the Archer's health, ADR 0075), so ruleset 21 links show the
* older-link notice.
*/
var SAME_FIGHTS_AS = [];
/** True when a series or link made under `ruleset` replays exactly in this build. */
function replaysHere(ruleset) {
	return ruleset === 23 || SAME_FIGHTS_AS.includes(ruleset);
}
// src/sim/bot.ts
/** How often Normal plays the counter map's best choice; otherwise it picks at random. */
var NORMAL_COUNTER_SHARE = .6;
/** Hard mixes the balls it may show first whose value is this close to its best (ADR 0035). */
var HARD_SHOW_MARGIN = .03;
/** The three levels: strong 2, edge 1, even 0, and the levels' odds. */
var LEVELS_READING = {
	standing: standingOf,
	odds: mapOdds
};
/** Its best counter to `shown` by the map: the ball that stands best against it. */
var counterTo = (map, own, shown) => uniform(bestBy(own, (ball) => map.standing(ball, shown)));
/** The balls that do best by the map against the opponent's whole lineup. */
var bestAgainstLineup = (map, own, opponent) => uniform(bestBy(own, (ball) => opponent.reduce((sum, y) => sum + map.standing(ball, y), 0)));
var positionOf = (view, odds) => ({
	format: view.format,
	own: view.own,
	opponent: view.opponent,
	wins: view.wins,
	losses: view.losses,
	winsNeeded: winsNeededOf(view.bestOf ?? 3),
	odds
});
function shownOf(view) {
	if (view.shown === void 0) throw new Error("An answer needs the ball shown first");
	return view.shown;
}
/** A bot level: its weights, and choices drawn from them on its own streams. */
function level(id, weights) {
	const salt = LEVEL_SALTS[id] ?? 0;
	return {
		id,
		pickLineup,
		weights,
		choose(view) {
			return draw(weights(view), deriveSeed([
				view.seed,
				salt,
				ROLE_SALTS[view.role],
				view.round
			]));
		}
	};
}
/** Easy: any of its balls, at random, for every choice. Good for learning the balls. */
var easyBot = level("easy", (view) => uniform(view.own));
/**
* Normal: usually its counter-map best, sometimes anything. Answering, its best counter to the
* shown ball (a strong counter, else an edge, else even...); opening a Showdown, its balls that
* fare best against the opponent's lineup; each NORMAL_COUNTER_SHARE of the time, otherwise at
* random. It shows first at random.
*/
var normalWeights = (map) => (view) => {
	if (view.role === "show") return uniform(view.own);
	return blend(NORMAL_COUNTER_SHARE, view.role === "answer" ? counterTo(map, view.own, shownOf(view)) : bestAgainstLineup(map, view.own, view.opponent), uniform(view.own));
};
var normalBot = level("normal", normalWeights(LEVELS_READING));
/**
* Hard: plays the whole series, not just the round (ADR 0035), valuing positions by the counter
* map (bot-model.ts), at any length (ADR 0048: the bot the Best of 5 measurement played, whose Best
* of 3 choices are the ones Hard always made). Answering, the ball that leaves it the best series
* chance, the last round included.
* Showing first, a ball whose worst answer leaves it within HARD_SHOW_MARGIN of its best, at random
* among them. Opening a Showdown, the mix of balls that no opener of the opponent's can exploit.
*/
var hardWeights = (map) => (view) => {
	const position = positionOf(view, map.odds);
	const memo = /* @__PURE__ */ new Map();
	if (view.role === "answer") {
		const shown = shownOf(view);
		return uniform(bestBy(view.own, (ball) => afterRound(position, "opponent", ball, shown, memo)));
	}
	if (view.role === "show") {
		const worstAnswer = (ball) => Math.min(...view.opponent.map((y) => afterRound(position, "bot", ball, y, memo)));
		return uniform(bestBy(view.own, worstAnswer, HARD_SHOW_MARGIN));
	}
	const mix = maximinMix(view.own.map((ball) => view.opponent.map((y) => afterRound(position, "bot", ball, y, memo))));
	return view.own.map((ball, index) => [ball, mix[index] ?? 0]).filter(([, weight]) => weight > 0);
};
var hardBot = level("hard", hardWeights(LEVELS_READING));
/** Favoured or not, at either level: how the first bot reads the map (it predates levels). */
var SIDES_READING = {
	standing: (ball, opponent) => Math.sign(standingOf(ball, opponent)),
	odds: mapOdds
};
/**
* The first bot (ADR 0017, 0021, 0029), kept so links played against it still replay: it shows
* first at random and answers with its best counter, ties on a seeded coin. Not offered to new
* series. Its streams are the ones it always used.
*/
function firstBot(map) {
	const weights = (view) => view.role === "answer" ? counterTo(map, view.own, shownOf(view)) : uniform(view.own);
	return {
		id: "random",
		pickLineup,
		weights,
		choose(view) {
			const pool = weights(view).map(([ball]) => ball);
			const random = createStream(deriveSeed([
				view.seed,
				ROLE_SALTS[view.role],
				view.round
			]));
			const choice = pool[Math.floor(random() * pool.length)];
			if (choice === void 0) throw new Error("No ball to choose from");
			return choice;
		}
	};
}
var randomBot = firstBot(SIDES_READING);
/** The levels a player can choose, easiest first. */
var BOT_LEVELS = [
	easyBot,
	normalBot,
	hardBot
];
var DEFAULT_BOT = normalBot;
/** Every bot, by id: what a series setup's opponent names (ADR 0022). */
var BOTS = new Map([...BOT_LEVELS, randomBot].map((bot) => [bot.id, bot]));
/**
* The bots of each older ruleset that still replays here (`SAME_FIGHTS_AS`, ADR 0073), by ruleset
* and id: a bot-only change keeps the old bots here, reading the map as they did, so their series
* still verify. Empty since ruleset 21 changed fights (ADR 0074); ruleset 19's went with it.
*/
var KEPT_BOTS = /* @__PURE__ */ new Map();
/** The bot named `id` as it played under `ruleset`, if any. */
function botNamed(id, ruleset = 23) {
	return (KEPT_BOTS.get(ruleset) ?? BOTS).get(id);
}
/** The bot an opponent names under a ruleset, or the default level for a player or unknown id. */
function botFor(opponent, ruleset = 23) {
	return (opponent.kind === "bot" ? botNamed(opponent.bot, ruleset) : void 0) ?? DEFAULT_BOT;
}
/**
* What side B may know before its due pick: the shown ball only when it answers. In a Showdown's
* round 1 the player's opener is recorded first, but the view leaves it out.
*/
function botViewOf(state) {
	if (awaitingPick(state) !== "b") return void 0;
	const format = formatOf(state.setup);
	const round = state.rounds.length;
	const score = scoreOf(state);
	const base = {
		format,
		seed: botSeedOf(state.setup),
		round,
		own: remainingOf(state, "b"),
		opponent: remainingOf(state, "a"),
		wins: score.b,
		losses: score.a,
		...state.setup.bestOf === void 0 ? {} : { bestOf: state.setup.bestOf }
	};
	if (format === "showdown" && round === 0) return {
		...base,
		role: "open"
	};
	const shown = state.picks.find((pick) => pick.round === round && pick.side === "a");
	return shown === void 0 ? {
		...base,
		role: "show"
	} : {
		...base,
		role: "answer",
		shown: shown.ball
	};
}
/** The bot's pick when side B (the bot) is due to pick, else undefined. */
function botPick(bot, state) {
	const view = botViewOf(state);
	return view === void 0 ? void 0 : bot.choose(view);
}
// src/sim/series-decode.ts
/** Every field a setup may have (SeriesSetup). */
var FIELDS = [
	"ruleset",
	"seed",
	"a",
	"b",
	"opponent",
	"format",
	"picks",
	"bestOf",
	"seeds"
];
var refuse = (reason) => ({
	ok: false,
	reason
});
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** A 32-bit unsigned integer: a seed, a ruleset, a lineup seed. */
var isUint32 = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 4294967295;
/** `value` as a list of roster ids no longer than `most`, else undefined. */
function idsOf(value, roster, most) {
	if (!Array.isArray(value) || value.length > most) return void 0;
	const ids = [];
	for (const id of value) {
		if (typeof id !== "string" || !roster.includes(id)) return void 0;
		ids.push(id);
	}
	return ids;
}
function opponentOf(value) {
	if (!isRecord(value)) return "Unknown opponent kind";
	const allowed = value["kind"] === "bot" ? [
		"kind",
		"bot",
		"lineupSeed"
	] : ["kind"];
	if (value["kind"] !== "bot" && value["kind"] !== "player") return "Unknown opponent kind";
	const extra = Object.keys(value).find((key) => !allowed.includes(key));
	if (extra !== void 0) return `Unknown opponent field "${extra}"`;
	if (value["kind"] === "player") return { kind: "player" };
	const { bot, lineupSeed } = value;
	if (typeof bot !== "string" || !BOTS.has(bot)) return `No bot "${String(bot)}"`;
	if (!isUint32(lineupSeed)) return "The lineup seed is not a 32-bit integer";
	return {
		kind: "bot",
		bot,
		lineupSeed
	};
}
/**
* A server series' seeds (ADR 0052): exactly the seeds the series uses, so a stored setup has one
* form and no rule quietly falls back to the series seed. One per round; a toss for Reveal only;
* a bot seed only for a bot that makes choices (any format but Blind).
*/
function seedsOf(value, length, format, opponent) {
	if (!isRecord(value)) return "The seeds are not an object";
	const extra = Object.keys(value).find((key) => ![
		"rounds",
		"toss",
		"bot"
	].includes(key));
	if (extra !== void 0) return `Unknown seeds field "${extra}"`;
	const { rounds, toss, bot } = value;
	const list = Array.isArray(rounds) && rounds.length === length ? Array.from(rounds) : [];
	if (list.length !== length || !list.every(isUint32)) return "The round seeds are not one 32-bit integer per round";
	if (format === "reveal" && !isUint32(toss)) return "A Reveal series needs a toss seed";
	if (format !== "reveal" && toss !== void 0) return "Only a Reveal series has a toss seed";
	const chooses = opponent.kind === "bot" && format !== "blind";
	if (chooses && !isUint32(bot)) return "A bot that chooses needs a bot seed";
	if (!chooses && bot !== void 0) return "Only a bot that chooses has a bot seed";
	return {
		rounds: list,
		...isUint32(toss) ? { toss } : {},
		...isUint32(bot) ? { bot } : {}
	};
}
/**
* The setup `raw` holds, as a fresh object with exactly its fields, or why it isn't one. The
* roster is the ids a lineup may use, in the order the bot picks from.
*/
function decodeSeriesSetup(raw, roster) {
	if (!isRecord(raw)) return refuse("The series is not an object");
	const unknown = Object.keys(raw).find((key) => !FIELDS.includes(key));
	if (unknown !== void 0) return refuse(`Unknown field "${unknown}"`);
	const { ruleset, seed, a, b, format, picks, bestOf, seeds } = raw;
	if (!isUint32(ruleset)) return refuse("The ruleset is not a 32-bit unsigned integer");
	if (!isUint32(seed)) return refuse("The seed is not a 32-bit unsigned integer");
	const length = bestOf === void 0 ? 3 : asBestOf(bestOf);
	if (length === void 0) return refuse("The series is not Best of 3 or Best of 5");
	const lineupA = idsOf(a, roster, length);
	const lineupB = idsOf(b, roster, length);
	if (lineupA === void 0 || lineupB === void 0 || !isValidLineup(lineupA, roster, length) || !isValidLineup(lineupB, roster, length)) return refuse(`A lineup is not ${String(length)} different balls from the roster`);
	const opponent = opponentOf(raw["opponent"]);
	if (typeof opponent === "string") return refuse(opponent);
	const named = FORMATS.find((name) => name === format);
	if (format !== void 0 && named === void 0) return refuse("Unknown format");
	const most = 2 * (length - 1);
	if (Array.isArray(picks) && picks.length > most) return refuse("More picks than any series makes");
	const made = picks === void 0 ? void 0 : idsOf(picks, roster, most);
	if (picks !== void 0 && made === void 0) return refuse("The picks are not balls from the roster");
	const own = seeds === void 0 ? void 0 : seedsOf(seeds, length, named ?? "blind", opponent);
	if (typeof own === "string") return refuse(own);
	return {
		ok: true,
		setup: {
			ruleset,
			seed,
			a: lineupA,
			b: lineupB,
			opponent,
			...named === void 0 || named === "blind" ? {} : { format: named },
			...made === void 0 || made.length === 0 ? {} : { picks: made },
			...length === 3 ? {} : { bestOf: length },
			...own === void 0 ? {} : { seeds: own }
		}
	};
}
/** `decodeSeriesSetup` over JSON text, refusing text that isn't JSON. */
function parseSeriesSetup(json, roster) {
	let raw;
	try {
		raw = JSON.parse(json);
	} catch {
		return refuse("The series is not valid JSON");
	}
	return decodeSeriesSetup(raw, roster);
}
// src/sim/abilities/split.ts
/** True when `ball` has split or was split off another: it never splits again (once per ball). */
function hasSplit(ball) {
	return ball.side !== void 0;
}
var clamp$3 = (value, min, max) => Math.min(max, Math.max(min, value));
var inside = (position, radius, arenaSize) => ({
	x: clamp$3(position.x, radius, arenaSize - radius),
	y: clamp$3(position.y, radius, arenaSize - radius)
});
/**
* `owner` split in two (no trig, ADR 0001): both halves step sideways from its heading, half the
* spread each, and turn 45 degrees from it, one each way. The new ball is a copy (statuses too) on
* the owner's side, appended after every other ball, with id `<side>~<n>`.
*/
function splitBall(owner, request, balls, arenaSize, tick) {
	if (![
		request.keepHealth,
		request.splitHealth,
		request.spread
	].every(Number.isFinite) || request.keepHealth < 1 || request.splitHealth < 1) throw new Error(`"${owner.id}" tried an invalid split`);
	const { x: vx, y: vy } = owner.velocity;
	const speed = Math.sqrt(vx * vx + vy * vy);
	const ux = speed > 0 ? vx / speed : 1;
	const uy = speed > 0 ? vy / speed : 0;
	const px = -uy;
	const py = ux;
	const half = request.spread / 2;
	const diagonal = speed / Math.sqrt(2);
	const side = sideOf(owner);
	const count = balls.filter((ball) => sideOf(ball) === side).length;
	const position = inside({
		x: owner.position.x + px * half,
		y: owner.position.y + py * half
	}, owner.radius, arenaSize);
	const newPosition = inside({
		x: owner.position.x - px * half,
		y: owner.position.y - py * half
	}, owner.radius, arenaSize);
	const added = {
		...owner,
		id: `${side}~${String(count)}`,
		side,
		position: newPosition,
		velocity: {
			x: (ux - px) * diagonal,
			y: (uy - py) * diagonal
		},
		health: Math.round(request.splitHealth),
		abilityState: request.state
	};
	return {
		owner: {
			...owner,
			side,
			position,
			velocity: {
				x: (ux + px) * diagonal,
				y: (uy + py) * diagonal
			},
			health: Math.round(request.keepHealth)
		},
		added,
		event: {
			type: "split",
			tick,
			ballId: owner.id,
			newBallId: added.id,
			position,
			newPosition
		}
	};
}
// src/sim/minions/spawn.ts
/** Gap between the owner's edge and a new minion's edge, so it never starts inside it. */
var SPAWN_GAP$1 = 1;
function assertValid$2(owner, request) {
	const { velocity, radius, damage, lifetimeTicks, maxAlive } = request;
	const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
	if (!(Number.isFinite(speed) && speed > 0 && Number.isFinite(radius) && radius > 0 && Number.isFinite(damage) && damage >= 0 && Number.isInteger(lifetimeTicks) && lifetimeTicks > 0 && Number.isInteger(maxAlive) && maxAlive > 0)) throw new Error(`An ability of "${owner.id}" tried to summon an invalid minion`);
	return speed;
}
/**
* A minion just outside `owner`'s edge, heading along the requested velocity (ADR 0026), or
* nothing when the owner already has `maxAlive` minions or that point is outside the arena (a
* summon into an adjacent wall). Nothing is summoned and no id is used in either case.
*/
function spawnMinion(owner, request, existing, id, arenaSize, tick) {
	const speed = assertValid$2(owner, request);
	if (existing.filter((minion) => minion.ownerId === owner.id).length >= request.maxAlive) return void 0;
	const { velocity, radius } = request;
	const offset = (owner.radius + radius + SPAWN_GAP$1) / speed;
	const position = {
		x: owner.position.x + velocity.x * offset,
		y: owner.position.y + velocity.y * offset
	};
	const max = arenaSize - radius;
	if (!(position.x >= radius && position.x <= max && position.y >= radius && position.y <= max)) return void 0;
	return {
		minion: {
			id,
			ownerId: owner.id,
			position,
			velocity,
			radius,
			damage: request.damage,
			ticksLeft: request.lifetimeTicks
		},
		event: {
			type: "minionSpawned",
			tick,
			minionId: id,
			ownerId: owner.id,
			position,
			velocity
		}
	};
}
// src/sim/projectiles/spawn.ts
/** Gap between the owner's edge and a new projectile's edge, so it never starts touching it. */
var SPAWN_GAP = 1;
function assertValid$1(owner, request) {
	const { velocity, radius, damage, lifetimeTicks } = request;
	const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
	if (!(Number.isFinite(speed) && speed > 0 && Number.isFinite(radius) && radius > 0 && Number.isFinite(damage) && Number.isInteger(lifetimeTicks) && lifetimeTicks > 0 && (request.returnAfterTicks === void 0 || Number.isInteger(request.returnAfterTicks) && request.returnAfterTicks >= 1))) throw new Error(`An ability of "${owner.id}" tried to spawn an invalid projectile`);
	return speed;
}
/**
* Creates a projectile just outside `owner`'s edge, heading along the requested velocity. If that
* point is outside the arena (e.g. fired into an adjacent wall), no projectile is created, but it
* still gets `id` and reports projectileFired then projectileExpired('wall'), so every fired
* projectile has a matching end.
*/
function spawnProjectile(owner, request, id, arenaSize, tick) {
	const speed = assertValid$1(owner, request);
	const { velocity, radius } = request;
	const offset = (owner.radius + radius + SPAWN_GAP) / speed;
	const position = {
		x: owner.position.x + velocity.x * offset,
		y: owner.position.y + velocity.y * offset
	};
	const fired = {
		type: "projectileFired",
		tick,
		projectileId: id,
		ownerId: owner.id,
		position,
		velocity
	};
	const max = arenaSize - radius;
	if (!(position.x >= radius && position.x <= max && position.y >= radius && position.y <= max)) return {
		projectile: void 0,
		events: [fired, {
			type: "projectileExpired",
			tick,
			projectileId: id,
			ownerId: owner.id,
			reason: "wall"
		}]
	};
	return {
		projectile: {
			id,
			ownerId: owner.id,
			position,
			velocity,
			radius,
			damage: request.damage,
			ticksLeft: request.lifetimeTicks,
			...request.returnAfterTicks === void 0 ? {} : { returning: {
				turnTick: tick + request.returnAfterTicks,
				back: false,
				hitIds: []
			} }
		},
		events: [fired]
	};
}
// src/sim/zones/spawn.ts
var clamp$2 = (value, min, max) => Math.min(max, Math.max(min, value));
function assertValid(owner, request, arenaSize) {
	const { position, radius, damage, delayTicks } = request;
	if (!(Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(radius) && radius > 0 && radius * 2 <= arenaSize && Number.isFinite(damage) && damage >= 0 && Number.isInteger(delayTicks) && delayTicks >= 1 && (request.status === void 0 || Number.isInteger(request.status.durationTicks) && request.status.durationTicks >= 1) && (request.linger === void 0 || Number.isInteger(request.linger.ticks) && request.linger.ticks >= 1 && Number.isInteger(request.linger.pulseEveryTicks) && request.linger.pulseEveryTicks >= 1) && (request.trigger === void 0 || request.linger === void 0 && Number.isFinite(request.trigger.radius) && request.trigger.radius > 0 && request.trigger.radius <= radius && Number.isInteger(request.trigger.armTicks) && request.trigger.armTicks >= 1))) throw new Error(`An ability of "${owner.id}" tried to spawn an invalid zone`);
}
/**
* Creates a zone for `owner` that strikes `delayTicks` after `tick`, and keeps pulsing until
* `linger.ticks` after that when it lingers (ADR 0034). Its centre is clamped on each axis to
* [radius, arenaSize - radius], so the whole circle is inside the arena (ADR 0006).
*/
function spawnZone(owner, request, id, arenaSize, tick) {
	assertValid(owner, request, arenaSize);
	const { radius } = request;
	const max = arenaSize - radius;
	const zone = {
		id,
		ownerId: owner.id,
		position: {
			x: clamp$2(request.position.x, radius, max),
			y: clamp$2(request.position.y, radius, max)
		},
		radius,
		damage: request.damage,
		spawnTick: tick,
		strikeTick: tick + request.delayTicks,
		...request.status === void 0 ? {} : { status: request.status },
		...request.linger === void 0 ? {} : {
			endTick: tick + request.delayTicks + request.linger.ticks,
			pulseEveryTicks: request.linger.pulseEveryTicks
		},
		...request.trigger === void 0 ? {} : { trigger: {
			radius: request.trigger.radius,
			armTick: tick + request.trigger.armTicks
		} }
	};
	return {
		zone,
		event: {
			type: "zoneSpawned",
			tick,
			zoneId: id,
			ownerId: owner.id,
			position: zone.position,
			radius,
			strikeTick: zone.strikeTick
		}
	};
}
// src/sim/abilities/rewind.ts
var clamp$1 = (value, min, max) => Math.min(max, Math.max(min, value));
/**
* `ball` put back at `request`: its position (kept inside the arena), velocity and health (a whole
* number from 1 to `maxHealth`). Statuses, projectiles and zones are not rewound. Throws for a
* non-finite value, which only a bug can produce.
*/
function rewindBall(ball, request, maxHealth, arenaSize, tick) {
	const { position, velocity, health } = request;
	if (![
		position.x,
		position.y,
		velocity.x,
		velocity.y,
		health
	].every(Number.isFinite)) throw new Error(`"${ball.id}" tried to rewind to a non-finite state`);
	const max = arenaSize - ball.radius;
	const to = {
		x: clamp$1(position.x, ball.radius, max),
		y: clamp$1(position.y, ball.radius, max)
	};
	const healthAfter = clamp$1(Math.round(health), 1, maxHealth);
	return {
		ball: {
			...ball,
			position: to,
			velocity,
			health: healthAfter
		},
		event: {
			type: "rewound",
			tick,
			ballId: ball.id,
			from: ball.position,
			to,
			healthBefore: ball.health,
			healthAfter
		}
	};
}
// src/sim/abilities/apply-actions.ts
/** A scene of just these balls, with nothing in flight: for applying one-off actions. */
function sceneOf(balls) {
	return {
		balls,
		projectiles: [],
		nextProjectileId: 0,
		zones: [],
		nextZoneId: 0,
		minions: [],
		nextMinionId: 0
	};
}
function assertFinite(velocity, ownerId) {
	if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) throw new Error(`An ability of "${ownerId}" produced a non-finite velocity`);
	return velocity;
}
/**
* Applies one hook's actions, in the order returned, on behalf of `ownerId`. Pure: returns the
* changed scene and the events the actions produced. Actions on a defeated target or from a
* defeated owner do nothing (a heal never revives); an unknown target id throws because only a
* bug can produce one.
*/
function applyActions(scene, ownerId, actions, definitions, tick, arenaSize, via) {
	const next = [...scene.balls];
	const projectiles = [...scene.projectiles];
	let { nextProjectileId } = scene;
	const zones = [...scene.zones];
	let { nextZoneId } = scene;
	const minions = [...scene.minions];
	let { nextMinionId } = scene;
	const events = [];
	const indexOf = (id) => {
		const index = next.findIndex((ball) => ball.id === id);
		if (index === -1) throw new Error(`An ability of "${ownerId}" targeted unknown ball "${id}"`);
		return index;
	};
	const update = (id, change) => {
		const index = indexOf(id);
		const ball = next[index];
		if (ball === void 0 || !isAlive(ball)) return;
		const changed = change(ball);
		if (changed !== void 0) next[index] = changed;
	};
	for (const action of actions) switch (action.kind) {
		case "damage":
			update(action.targetId, (target) => {
				const requested = Math.max(0, action.amount);
				const defended = action.unblockable === true ? {
					rest: requested,
					event: void 0,
					raised: 0
				} : defendHit(target, ownerId, requested, definitions, tick, via ?? "onTick");
				if (defended.event !== void 0) events.push(defended.event);
				const amount = Math.min(target.health, defended.rest);
				if (amount <= 0) return void 0;
				const healthAfter = target.health - amount;
				events.push({
					type: "damage",
					tick,
					targetId: target.id,
					sourceId: ownerId,
					cause: "ability",
					amount,
					healthAfter,
					multiplier: 1,
					survivedLethal: false,
					...via === void 0 ? {} : { via },
					...defended.event === void 0 ? {} : { reduced: defended.event.reduced },
					...defended.raised > 0 ? { raised: defended.raised } : {}
				});
				return {
					...target,
					health: healthAfter
				};
			});
			break;
		case "heal":
			update(action.targetId, (target) => {
				const { maxHealth } = getDefinition(definitions, target.definitionId);
				const requested = Math.max(0, action.amount);
				const amount = Math.min(maxHealth, target.health + requested) - target.health;
				if (amount <= 0) return void 0;
				const healthAfter = target.health + amount;
				events.push({
					type: "healed",
					tick,
					ballId: target.id,
					sourceId: ownerId,
					amount,
					healthAfter
				});
				return {
					...target,
					health: healthAfter
				};
			});
			break;
		case "setVelocity":
			update(ownerId, (self) => ({
				...self,
				velocity: assertFinite(action.velocity, ownerId)
			}));
			break;
		case "steer":
			assertSteerShare(action.share, ownerId);
			update(action.targetId, (target) => ({
				...target,
				velocity: steerToward(target.position, target.velocity, assertFinite(action.toward, ownerId), action.share)
			}));
			break;
		case "setAbilityState":
			update(ownerId, (self) => ({
				...self,
				abilityState: action.state
			}));
			break;
		case "spawnProjectile":
			update(ownerId, (self) => {
				const id = `projectile-${nextProjectileId}`;
				nextProjectileId++;
				const spawned = spawnProjectile(self, action, id, arenaSize, tick);
				if (spawned.projectile !== void 0) projectiles.push(spawned.projectile);
				events.push(...spawned.events);
			});
			break;
		case "spawnZone":
			update(ownerId, (self) => {
				const spawned = spawnZone(self, action, `zone-${nextZoneId}`, arenaSize, tick);
				nextZoneId++;
				zones.push(spawned.zone);
				events.push(spawned.event);
			});
			break;
		case "spawnMinion":
			update(ownerId, (self) => {
				const spawned = spawnMinion(self, action, minions, `minion-${nextMinionId}`, arenaSize, tick);
				if (spawned === void 0) return void 0;
				nextMinionId++;
				minions.push(spawned.minion);
				events.push(spawned.event);
			});
			break;
		case "applyStatus":
			update(action.targetId, (target) => {
				assertStatusDuration(action.status, action.durationTicks, ownerId);
				const keeps = getDefinition(definitions, target.definitionId).statusResistance;
				const durationTicks = resistedDuration(action.durationTicks, keeps?.[action.status]);
				if (durationTicks === 0) return void 0;
				const applied = withStatus(target, {
					kind: action.status,
					durationTicks
				}, ownerId, tick);
				events.push(applied.event);
				return applied.ball;
			});
			break;
		case "rewind": {
			const index = indexOf(ownerId);
			const self = next[index];
			if (self === void 0) break;
			const { maxHealth } = getDefinition(definitions, self.definitionId);
			const rewound = rewindBall(self, action, maxHealth, arenaSize, tick);
			next[index] = rewound.ball;
			events.push(rewound.event);
			break;
		}
		case "split": {
			const index = indexOf(ownerId);
			const self = next[index];
			if (self === void 0 || !isAlive(self) || hasSplit(self)) break;
			const split = splitBall(self, action, next, arenaSize, tick);
			next[index] = split.owner;
			next.push(split.added);
			events.push(split.event);
			break;
		}
		default: throw new Error(`Unhandled ability action ${JSON.stringify(action)}`);
	}
	return {
		balls: next,
		projectiles,
		nextProjectileId,
		zones,
		nextZoneId,
		minions,
		nextMinionId,
		events
	};
}
/**
* Ability damage from `ownerId` to one ball, through the same path as the `damage` action. Used
* by projectile hits, zone strikes, minions and poison, each naming itself as `via`. `damage` is
* the event, or undefined if nothing was removed (the target was already defeated, the amount was
* 0, or a defence took it all). `events` is what the hit produced: its damage event, and the
* `hitReduced` of a defence that took any of it (ADR 0045).
*/
function dealAbilityDamage(balls, ownerId, targetId, amount, definitions, tick, via) {
	const result = applyActions(sceneOf(balls), ownerId, [{
		kind: "damage",
		targetId,
		amount
	}], definitions, tick, Infinity, via);
	const damage = result.events.find((event) => event.type === "damage");
	return {
		balls: result.balls,
		damage,
		events: result.events
	};
}
// src/sim/abilities/run-hooks.ts
var HOOK_CODES = {
	onTick: 1,
	onWallHit: 2,
	onHitBall: 3,
	onDamageDealt: 4,
	onDamageTaken: 5,
	onKnockedOut: 6
};
/**
* Runs one hook phase: every invocation sees the same snapshot of the world (collect), then all
* returned actions are applied in invocation order, each hook's actions in the order returned
* (apply). Hooks only run for balls alive at the start of the phase. Each hook call that returned
* actions emits `abilityTriggered` just before the events its actions produced.
*/
function runPhase(world, invocations, definitions) {
	const snapshot = world.balls;
	const collected = [];
	const callCounts = /* @__PURE__ */ new Map();
	const isPhased$1 = (ball) => isPhased(ball, getDefinition(definitions, ball.definitionId));
	const maxHealthOf = (ball) => getDefinition(definitions, ball.definitionId).maxHealth;
	const aimPointOf = (ball) => getDefinition(definitions, ball.definitionId).decoyOf?.(ball, world.arena.size) ?? ball.position;
	for (const invocation of invocations) {
		const ballIndex = snapshot.findIndex((ball) => ball.id === invocation.ballId);
		const self = snapshot[ballIndex];
		if (self === void 0 || !isAlive(self) && invocation.hook !== "onKnockedOut") continue;
		const definition = getDefinition(definitions, self.definitionId);
		const call = callCounts.get(self.id) ?? 0;
		callCounts.set(self.id, call + 1);
		const base = {
			world,
			self,
			stats: definition,
			random: createStream(deriveSeed([
				world.rngState,
				world.tick,
				ballIndex,
				HOOK_CODES[invocation.hook],
				call
			])),
			isPhased: isPhased$1,
			maxHealthOf,
			aimPointOf
		};
		const actions = invocation.call(definition, base, snapshot);
		if (actions !== void 0 && actions.length > 0) collected.push({
			ballId: invocation.ballId,
			hook: invocation.hook,
			actions
		});
	}
	let scene = {
		balls: snapshot,
		projectiles: world.projectiles,
		nextProjectileId: world.nextProjectileId,
		zones: world.zones,
		nextZoneId: world.nextZoneId,
		minions: world.minions,
		nextMinionId: world.nextMinionId
	};
	const events = [];
	for (const { ballId, hook, actions } of collected) {
		events.push({
			type: "abilityTriggered",
			tick: world.tick,
			ballId,
			hook
		});
		const result = applyActions(scene, ballId, actions, definitions, world.tick, world.arena.size, hook);
		scene = result;
		events.push(...result.events);
	}
	return {
		balls: scene.balls,
		projectiles: scene.projectiles,
		nextProjectileId: scene.nextProjectileId,
		zones: scene.zones,
		nextZoneId: scene.nextZoneId,
		minions: scene.minions,
		nextMinionId: scene.nextMinionId,
		events
	};
}
function tickInvocations(balls) {
	return balls.map((ball) => ({
		ballId: ball.id,
		hook: "onTick",
		call: (definition, base) => definition.hooks.onTick?.(base)
	}));
}
function wallHitInvocations(bounces) {
	return [...bounces].filter(([, count]) => count > 0).map(([ballId, count]) => ({
		ballId,
		hook: "onWallHit",
		call: (definition, base) => definition.hooks.onWallHit?.({
			...base,
			bounces: count
		})
	}));
}
/**
* Both balls of each new contact, in contact order. A pass through a phased ball (ADR 0026) is no
* hit for the other ball, so only the phased ball's own hook runs: on-touch effects (slow, poison,
* a Speedster's cash-in) need contact.
*/
function hitBallInvocations(newContacts, isPhasedId = () => false) {
	return newContacts.flatMap(({ ballIds: [idA, idB], phased }) => [[idA, idB], [idB, idA]].filter(([ballId]) => !phased || isPhasedId(ballId)).map(([ballId, otherId]) => ({
		ballId,
		hook: "onHitBall",
		call: (definition, base, snapshot) => {
			const other = snapshot.find((ball) => ball.id === otherId);
			return other === void 0 ? void 0 : definition.hooks.onHitBall?.({
				...base,
				other
			});
		}
	})));
}
/** One call per damage event, for the ball that dealt it. */
function damageDealtInvocations(damage) {
	return damage.filter((event) => event.amount > 0).map((event) => ({
		ballId: event.sourceId,
		hook: "onDamageDealt",
		call: (definition, base, snapshot) => {
			const target = snapshot.find((ball) => ball.id === event.targetId);
			return target === void 0 ? void 0 : definition.hooks.onDamageDealt?.({
				...base,
				target,
				amount: event.amount,
				cause: event.cause
			});
		}
	}));
}
/** One call per damage event, for the ball that took it (ADR 0012). */
function damageTakenInvocations(damage) {
	return damage.filter((event) => event.amount > 0).map((event) => ({
		ballId: event.targetId,
		hook: "onDamageTaken",
		call: (definition, base, snapshot) => {
			const attacker = snapshot.find((ball) => ball.id === event.sourceId);
			return attacker === void 0 ? void 0 : definition.hooks.onDamageTaken?.({
				...base,
				attacker,
				amount: event.amount,
				cause: event.cause,
				reduced: event.reduced ?? 0,
				via: event.cause === "contact" ? "contact" : event.via ?? "onTick"
			});
		}
	}));
}
/**
* One call for each ball that was alive at the start of the tick and is at 0 health now, before it
* is defeated (ADR 0034).
*/
function knockedOutInvocations(before, now) {
	const down = new Set(now.filter((ball) => !isAlive(ball)).map((ball) => ball.id));
	return before.filter((ball) => isAlive(ball) && down.has(ball.id)).map((ball) => ({
		ballId: ball.id,
		hook: "onKnockedOut",
		call: (definition, base) => definition.hooks.onKnockedOut?.(base)
	}));
}
// src/sim/vec2.ts
function vec2(x, y) {
	return {
		x,
		y
	};
}
function scale(v, factor) {
	return {
		x: v.x * factor,
		y: v.y * factor
	};
}
/** Returns `v + direction * distance`. */
function addScaled(v, direction, distance) {
	return {
		x: v.x + direction.x * distance,
		y: v.y + direction.y * distance
	};
}
// src/sim/collision.ts
/** Used when two centres coincide exactly and there is no direction to separate along. */
var FALLBACK_NORMAL = {
	x: 1,
	y: 0
};
/**
* Extra distance added when separating, in world units. Far below anything visible, but enough
* that rounding can never leave two balls overlapping by a hair and colliding again next tick.
*/
var SEPARATION_MARGIN = 1e-9;
/** Wall-blocked separations try again from the new positions, at most this many times. */
var MAX_SEPARATION_PASSES = 4;
/** Mass is proportional to area, so bigger balls shove smaller ones around. */
function massOf(ball) {
	return ball.radius * ball.radius;
}
function clampToArena(position, radius, arenaSize) {
	const max = arenaSize - radius;
	return vec2(Math.min(max, Math.max(radius, position.x)), Math.min(max, Math.max(radius, position.y)));
}
function overlaps$1(a, b, minDistance) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	return dx * dx + dy * dy < minDistance * minDistance;
}
/** Unit vector from `from` to `to`, or the fallback if they coincide. */
function directionBetween(from, to) {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const length = Math.sqrt(dx * dx + dy * dy);
	return length === 0 ? FALLBACK_NORMAL : vec2(dx / length, dy / length);
}
/**
* Pushes two overlapping balls apart along the normal, each moving in proportion to the other's
* mass. A ball against a wall cannot take its share, so if they still overlap after clamping to
* the arena, the free ball is moved to just touch the blocked one.
*/
function separate(a, b, normal, penetration, arenaSize) {
	const inverseA = 1 / massOf(a);
	const shareA = inverseA / (inverseA + 1 / massOf(b));
	const minDistance = a.radius + b.radius;
	const push = penetration + SEPARATION_MARGIN;
	let positionA = clampToArena(addScaled(a.position, normal, -push * shareA), a.radius, arenaSize);
	let positionB = clampToArena(addScaled(b.position, normal, push * (1 - shareA)), b.radius, arenaSize);
	const touching = minDistance + SEPARATION_MARGIN;
	for (let pass = 0; pass < MAX_SEPARATION_PASSES; pass++) {
		if (!overlaps$1(positionA, positionB, minDistance)) break;
		const direction = directionBetween(positionA, positionB);
		positionB = clampToArena(addScaled(positionA, direction, touching), b.radius, arenaSize);
		if (!overlaps$1(positionA, positionB, minDistance)) break;
		positionA = clampToArena(addScaled(positionB, direction, -touching), a.radius, arenaSize);
	}
	return [positionA, positionB];
}
/**
* Detects and resolves a collision between two balls. Returns undefined if they do not overlap.
* Otherwise separates them and, if they are approaching, applies an elastic impulse that
* conserves momentum and kinetic energy. Uses only + - * / and Math.sqrt (ADR 0001).
*/
function resolvePair(a, b, arenaSize) {
	const minDistance = a.radius + b.radius;
	if (!overlaps$1(a.position, b.position, minDistance)) return;
	const normal = directionBetween(a.position, b.position);
	const dx = b.position.x - a.position.x;
	const dy = b.position.y - a.position.y;
	const [positionA, positionB] = separate(a, b, normal, minDistance - Math.sqrt(dx * dx + dy * dy), arenaSize);
	const inverseA = 1 / massOf(a);
	const inverseB = 1 / massOf(b);
	const approachA = a.velocity.x * normal.x + a.velocity.y * normal.y;
	const approachB = -(b.velocity.x * normal.x + b.velocity.y * normal.y);
	const closingSpeed = -(approachA + approachB);
	const speedA = Math.sqrt(a.velocity.x * a.velocity.x + a.velocity.y * a.velocity.y);
	const speedB = Math.sqrt(b.velocity.x * b.velocity.x + b.velocity.y * b.velocity.y);
	const impulse = closingSpeed < 0 ? -2 * closingSpeed / (inverseA + inverseB) : 0;
	return {
		a: {
			...a,
			position: positionA,
			velocity: addScaled(a.velocity, normal, -impulse * inverseA)
		},
		b: {
			...b,
			position: positionB,
			velocity: addScaled(b.velocity, normal, impulse * inverseB)
		},
		contact: {
			point: addScaled(positionA, normal, a.radius),
			normal,
			impulse,
			approachSpeeds: [approachA, approachB],
			directness: [speedA === 0 ? 0 : approachA / speedA, speedB === 0 ? 0 : approachB / speedB]
		}
	};
}
/**
* The contact of two overlapping balls that pass through each other (ADR 0026): reported like a
* collision, but nothing moves and no impulse is exchanged.
*/
function passThrough(a, b) {
	const normal = directionBetween(a.position, b.position);
	const approachA = a.velocity.x * normal.x + a.velocity.y * normal.y;
	const approachB = -(b.velocity.x * normal.x + b.velocity.y * normal.y);
	const speedA = Math.sqrt(a.velocity.x * a.velocity.x + a.velocity.y * a.velocity.y);
	const speedB = Math.sqrt(b.velocity.x * b.velocity.x + b.velocity.y * b.velocity.y);
	return {
		point: addScaled(a.position, normal, a.radius),
		normal,
		impulse: 0,
		approachSpeeds: [approachA, approachB],
		directness: [speedA === 0 ? 0 : approachA / speedA, speedB === 0 ? 0 : approachB / speedB]
	};
}
/**
* Resolves every overlapping pair once, in array order (i < j) so the result is deterministic.
* Balls for which `isActive` is false are skipped entirely. A pair for which `passesThrough` is
* true overlaps without being separated or bounced, and is reported with `phased` (ADR 0026).
*/
function resolveCollisions(balls, arenaSize, isActive, passesThrough = () => false) {
	const next = [...balls];
	const contacts = [];
	for (let i = 0; i < next.length; i++) for (let j = i + 1; j < next.length; j++) {
		const a = next[i];
		const b = next[j];
		if (a === void 0 || b === void 0 || !isActive(a) || !isActive(b)) continue;
		if (sideOf(a) === sideOf(b)) continue;
		if (passesThrough(a, b)) {
			if (overlaps$1(a.position, b.position, a.radius + b.radius)) contacts.push({
				ballIds: [a.id, b.id],
				...passThrough(a, b),
				phased: true
			});
			continue;
		}
		const resolution = resolvePair(a, b, arenaSize);
		if (resolution === void 0) continue;
		next[i] = resolution.a;
		next[j] = resolution.b;
		contacts.push({
			ballIds: [a.id, b.id],
			...resolution.contact,
			phased: false
		});
	}
	return {
		balls: next,
		contacts
	};
}
// src/sim/cruise.ts
/**
* The speed a ball travels at in its current ability state: its definition's `cruiseSpeed` if it
* declares one, otherwise its definition speed, reduced while it is slowed (ADR 0012) and again
* while it is held (ADR 0075). Throws for a
* non-finite or non-positive speed, which only a bug can produce.
*/
function cruiseSpeedOf(ball, definition) {
	const own = definition.cruiseSpeed?.(ball.abilityState, definition) ?? definition.speed;
	const slowed = hasStatus(ball, "slowed") ? slowedSpeed(own) : own;
	const speed = hasStatus(ball, "held") ? slowed * HELD_SHARE : slowed;
	if (!Number.isFinite(speed) || speed <= 0) throw new Error(`Ball "${ball.id}" has an invalid cruise speed (${String(speed)})`);
	return speed;
}
/**
* Rescales every live ball's velocity to its cruise speed, keeping its direction (ADR 0008).
* Collisions change where a ball is heading, never how fast it goes. A ball with zero velocity has
* no direction and is left as it is; defeated balls are left alone. Pure: returns new states only
* for balls whose velocity changed.
*/
function applyCruiseSpeed(balls, definitions) {
	return balls.map((ball) => {
		if (!isAlive(ball)) return ball;
		const { x, y } = ball.velocity;
		const current = Math.sqrt(x * x + y * y);
		if (current === 0) return ball;
		const target = cruiseSpeedOf(ball, getDefinition(definitions, ball.definitionId));
		if (current === target) return ball;
		return {
			...ball,
			velocity: scale(ball.velocity, target / current)
		};
	});
}
// src/sim/size.ts
var clamp = (value, min, max) => Math.min(max, Math.max(min, value));
/**
* Sets every live ball that declares `radiusOf` to its radius for `tick`, and moves it back inside
* the arena if it grew into a wall (ADR 0034). An overlap with another ball is left to the next
* tick's collision pass, which separates it like any other. Throws for a radius that isn't a
* positive number fitting the arena, which only a bug can produce. Pure: returns new states only
* for balls whose size changed.
*/
function applySize(balls, definitions, tick, arenaSize) {
	return balls.map((ball) => {
		if (!isAlive(ball)) return ball;
		const radiusOf = getDefinition(definitions, ball.definitionId).radiusOf;
		if (radiusOf === void 0) return ball;
		const radius = radiusOf(ball, tick);
		if (!Number.isFinite(radius) || radius <= 0 || radius * 2 > arenaSize) throw new Error(`Ball "${ball.id}" has an invalid radius (${String(radius)})`);
		if (radius === ball.radius) return ball;
		const max = arenaSize - radius;
		const { x, y } = ball.position;
		return {
			...ball,
			radius,
			position: {
				x: clamp(x, radius, max),
				y: clamp(y, radius, max)
			}
		};
	});
}
// src/sim/match.ts
var RUNNING = { status: "running" };
function sidesOf(balls) {
	const sides = /* @__PURE__ */ new Map();
	for (const ball of balls) {
		const side = sideOf(ball);
		const members = sides.get(side);
		if (members === void 0) sides.set(side, [ball]);
		else members.push(ball);
	}
	return [...sides].map(([id, members]) => ({
		id,
		balls: members
	}));
}
/**
* The side with the highest health fraction wins (its balls' health over its first ball's full
* health); a tie for the top is a draw.
*/
function decideOnHealth(sides, definitions) {
	let leaders = [];
	let best = -1;
	for (const side of sides) {
		const [first] = side.balls;
		if (first === void 0) continue;
		let health = 0;
		for (const ball of side.balls) health += ball.health;
		const fraction = health / getDefinition(definitions, first.definitionId).maxHealth;
		if (fraction > best) {
			best = fraction;
			leaders = [side];
		} else if (fraction === best) leaders.push(side);
	}
	const [winner] = leaders;
	return leaders.length === 1 && winner !== void 0 ? {
		kind: "win",
		winnerId: winner.id
	} : { kind: "draw" };
}
/**
* Decides whether the match is over after `tick`. A side is out when every ball on it is out.
* Knockouts take precedence over the time limit: no side left is a draw, one left wins. Otherwise,
* at the time limit the sides still in are judged on health fraction.
*/
function evaluateMatch(balls, tick, definitions) {
	const alive = sidesOf(balls).filter((side) => side.balls.some(isAlive));
	const [survivor] = alive;
	if (alive.length === 0) return {
		status: "finished",
		result: { kind: "draw" },
		reason: "knockout",
		endTick: tick
	};
	if (alive.length === 1 && survivor !== void 0) return {
		status: "finished",
		result: {
			kind: "win",
			winnerId: survivor.id
		},
		reason: "knockout",
		endTick: tick
	};
	if (tick >= 3600) return {
		status: "finished",
		result: decideOnHealth(alive, definitions),
		reason: "timeLimit",
		endTick: tick
	};
	return RUNNING;
}
// src/sim/movement.ts
/**
* Folds a position that may have travelled past either wall back into [min, max], flipping the
* velocity once per wall hit. Movement is treated as a straight line that reflects off the walls
* like light between two mirrors, so the result is exact no matter how far the ball travelled in
* one tick: a very fast ball bounces several times instead of tunnelling out.
*/
function reflectAxis(position, velocity, min, max) {
	if (position >= min && position <= max) return {
		position,
		velocity,
		bounces: 0
	};
	const range = max - min;
	if (range <= 0) return {
		position: min,
		velocity: 0,
		bounces: 0
	};
	const travelled = position - min;
	const bounces = travelled > range ? Math.floor(travelled / range) : Math.floor(-travelled / range) + 1;
	const period = 2 * range;
	let offset = (position - min) % period;
	if (offset < 0) offset += period;
	const onReturnLeg = offset > range;
	const folded = onReturnLeg ? min + (period - offset) : min + offset;
	return {
		position: Math.min(max, Math.max(min, folded)),
		velocity: onReturnLeg ? -velocity : velocity,
		bounces
	};
}
/** Moves a ball (or any body) one tick along its velocity, bouncing off the arena walls. */
function moveBall(ball, arenaSize) {
	const { position, velocity, radius } = ball;
	if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) throw new Error(`Ball "${ball.id}" has a non-finite velocity`);
	const min = radius;
	const max = arenaSize - radius;
	const x = reflectAxis(position.x + velocity.x * DT, velocity.x, min, max);
	const y = reflectAxis(position.y + velocity.y * DT, velocity.y, min, max);
	return {
		ball: {
			...ball,
			position: vec2(x.position, y.position),
			velocity: vec2(x.velocity, y.velocity)
		},
		bounces: x.bounces + y.bounces,
		bouncesX: x.bounces,
		bouncesY: y.bounces
	};
}
// src/sim/projectiles/sweep.ts
var dot = (a, b) => a.x * b.x + a.y * b.y;
/**
* Swept circle test on relative motion. A point starts at offset `start` from a circle's centre
* and moves by `travel` (both relative to the circle) over one tick; returns the earliest fraction
* of the tick, in [0, 1], at which it comes within `reach` of the centre, or undefined if it never
* does. Solves |start + s·travel|² = reach² with only + − * / and Math.sqrt (ADR 0001).
*/
function sweepHitTime(start, travel, reach) {
	const c = dot(start, start) - reach * reach;
	if (c <= 0) return 0;
	const a = dot(travel, travel);
	const halfB = dot(start, travel);
	if (a === 0 || halfB >= 0) return void 0;
	const discriminant = halfB * halfB - a * c;
	if (discriminant < 0) return void 0;
	const s = (-halfB - Math.sqrt(discriminant)) / a;
	return s <= 1 ? s : void 0;
}
/**
* Earliest fraction of the tick, in [0, 1], at which a circle of radius `radius` starting at
* `start` and moving by `travel` touches a wall of a `size` × `size` arena, or undefined.
*/
function wallHitTime(start, travel, radius, size) {
	const axis = (position, delta) => {
		if (delta > 0) return (size - radius - position) / delta;
		if (delta < 0) return (radius - position) / delta;
	};
	let earliest;
	for (const s of [axis(start.x, travel.x), axis(start.y, travel.y)]) if (s !== void 0 && s <= 1 && (earliest === void 0 || s < earliest)) earliest = Math.max(0, s);
	return earliest;
}
// src/sim/minions/resolve.ts
var lerp = (a, b, s) => ({
	x: a.x + (b.x - a.x) * s,
	y: a.y + (b.y - a.y) * s
});
var subtract$2 = (a, b) => ({
	x: a.x - b.x,
	y: a.y - b.y
});
/** Time along `travel` (0 to 1) at which a body moving from `position` meets one axis's wall. */
function axisTime(position, delta, min, max) {
	if (delta > 0) return (max - position) / delta;
	if (delta < 0) return (min - position) / delta;
	return Infinity;
}
/**
* The straight pieces of a body's path over one tick, split where it bounces off a wall, so a hit
* test can follow the bend. The same mirror reflection `moveBall` folds into its end position; a
* corner hit splits once and flips both axes.
*/
function pathSegments(start, travel, radius, size) {
	const segments = [];
	const min = radius;
	const max = size - radius;
	let from = start;
	let delta = travel;
	let s0 = 0;
	for (let bend = 0; bend < 4; bend++) {
		const tx = axisTime(from.x, delta.x, min, max);
		const ty = axisTime(from.y, delta.y, min, max);
		const t = Math.max(0, Math.min(tx, ty));
		if (t >= 1) break;
		const to = {
			x: from.x + delta.x * t,
			y: from.y + delta.y * t
		};
		const s1 = s0 + (1 - s0) * t;
		segments.push({
			from,
			to,
			s0,
			s1
		});
		const rest = 1 - t;
		delta = {
			x: (tx <= ty ? -delta.x : delta.x) * rest,
			y: (ty <= tx ? -delta.y : delta.y) * rest
		};
		from = to;
		s0 = s1;
	}
	segments.push({
		from,
		to: {
			x: from.x + delta.x,
			y: from.y + delta.y
		},
		s0,
		s1: 1
	});
	return segments;
}
/**
* The earliest fraction of the tick at which the minion's path touches `ball`, whose centre moves
* in a straight line from `ballStart` to its position now. Swept on relative motion per segment
* (ADR 0005), so a small fast minion can't skip through a ball.
*/
function hitTime(segments, minionRadius, ball, ballStart) {
	for (const { from, to, s0, s1 } of segments) {
		const c0 = lerp(ballStart, ball.position, s0);
		const c1 = lerp(ballStart, ball.position, s1);
		const u = sweepHitTime(subtract$2(from, c0), subtract$2(subtract$2(to, from), subtract$2(c1, c0)), minionRadius + ball.radius);
		if (u !== void 0) return s0 + (s1 - s0) * u;
	}
}
/**
* Moves every minion one tick and resolves what it reaches (ADR 0026). Each moves like a ball:
* straight, folded off the walls by `moveBall`, and given the same seeded turn on a bounce (one
* draw from the world RNG per bouncing minion, in minion order). Its path is swept against every
* live enemy ball's motion this tick; the first it touches takes its damage as the owner's ability
* damage, and the minion pops. Minions ignore each other and their owner. One whose lifetime runs
* out crumbles.
*/
function resolveMinions(minions, balls, startPositions, definitions, arenaSize, rngState, tick) {
	let current = balls;
	let state = rngState;
	const remaining = [];
	const events = [];
	for (const minion of minions) {
		const segments = pathSegments(minion.position, {
			x: minion.velocity.x * DT,
			y: minion.velocity.y * DT
		}, minion.radius, arenaSize);
		const moved = moveBall(minion, arenaSize);
		let { velocity } = moved.ball;
		if (moved.bounces > 0) {
			const draw = nextRange(state, -BOUNCE_MAX_HALF_TAN, BOUNCE_MAX_HALF_TAN);
			state = draw.state;
			velocity = turnBounce(velocity, draw.value, moved.bouncesX > 0, moved.bouncesY > 0);
		}
		let nearest;
		for (const ball of current) {
			if (isAllyOf(current, ball, minion.ownerId) || !isAlive(ball) || isPhased(ball, getDefinition(definitions, ball.definitionId))) continue;
			const s = hitTime(segments, minion.radius, ball, startPositions.get(ball.id) ?? ball.position);
			if (s !== void 0 && (nearest === void 0 || s < nearest.s)) nearest = {
				s,
				ball
			};
		}
		const base = {
			tick,
			minionId: minion.id,
			ownerId: minion.ownerId
		};
		if (nearest !== void 0) {
			const { s, ball } = nearest;
			const segment = segments.find(({ s1 }) => s <= s1) ?? segments[segments.length - 1];
			const point = segment === void 0 ? minion.position : lerp(segment.from, segment.to, segment.s1 === segment.s0 ? 0 : (s - segment.s0) / (segment.s1 - segment.s0));
			const hit = dealAbilityDamage(current, minion.ownerId, ball.id, minion.damage, definitions, tick, "minion");
			current = hit.balls;
			events.push({
				type: "minionHit",
				...base,
				targetId: ball.id,
				point,
				amount: hit.damage?.amount ?? 0
			});
			events.push(...hit.events);
		} else if (minion.ticksLeft <= 1) events.push({
			type: "minionDestroyed",
			...base,
			position: moved.ball.position,
			reason: "lifetime"
		});
		else remaining.push({
			...minion,
			position: moved.ball.position,
			velocity,
			ticksLeft: minion.ticksLeft - 1
		});
	}
	return {
		balls: current,
		minions: remaining,
		rngState: state,
		events
	};
}
// src/sim/projectiles/returning.ts
var subtract$1 = (a, b) => ({
	x: a.x - b.x,
	y: a.y - b.y
});
/** The velocity that heads from `from` straight at `to` at `speed`; unchanged if already there. */
function homing(from, to, speed, fallback) {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const distance = Math.sqrt(dx * dx + dy * dy);
	return distance === 0 ? fallback : {
		x: dx / distance * speed,
		y: dy / distance * speed
	};
}
/** Earliest swept touch of `projectile` moving by `travel` against a body moving start → now. */
function touchTime(projectile, travel, body, start) {
	return sweepHitTime(subtract$1(projectile.position, start), subtract$1(travel, subtract$1(body.position, start)), body.radius + projectile.radius);
}
/**
* Moves one returning projectile a tick. In order of where along its path it happens: an enemy
* minion it reaches first destroys it (minions soak shots, ADR 0026); the nearest enemy ball it has
* not hit on this leg takes its damage, and it flies on; on the way back, reaching its owner is a
* catch, and it is gone. On the way out a wall turns it back; on the way back (its path always
* heads into the arena, where its owner is) a wall or a defeated owner drops it.
*/
function resolveReturning(projectile, flight, balls, startPositions, minions, minionStarts, definitions, arenaSize, tick) {
	const base = {
		tick,
		projectileId: projectile.id,
		ownerId: projectile.ownerId
	};
	const leg = !flight.back && tick >= flight.turnTick ? {
		...flight,
		back: true,
		hitIds: []
	} : flight;
	const owner = balls.find((ball) => ball.id === projectile.ownerId);
	if (leg.back && (owner === void 0 || !isAlive(owner))) return {
		balls,
		projectile: void 0,
		destroyedMinionId: void 0,
		events: [{
			type: "projectileExpired",
			...base,
			reason: "lifetime"
		}]
	};
	const speed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + projectile.velocity.y * projectile.velocity.y);
	const velocity = leg.back && owner !== void 0 ? homing(projectile.position, owner.position, speed, projectile.velocity) : projectile.velocity;
	const travel = scale(velocity, DT);
	let ballHit;
	for (const ball of balls) {
		if (isAllyOf(balls, ball, projectile.ownerId) || !isAlive(ball) || leg.hitIds.includes(ball.id)) continue;
		if (isPhased(ball, getDefinition(definitions, ball.definitionId))) continue;
		const s = touchTime(projectile, travel, ball, startPositions.get(ball.id) ?? ball.position);
		if (s !== void 0 && (ballHit === void 0 || s < ballHit.s)) ballHit = {
			s,
			ball
		};
	}
	let minionHit;
	for (const minion of minions) {
		if (sideOfId(balls, minion.ownerId) === sideOfId(balls, projectile.ownerId)) continue;
		const s = touchTime(projectile, travel, minion, minionStarts.get(minion.id) ?? minion.position);
		if (s !== void 0 && (minionHit === void 0 || s < minionHit.s)) minionHit = {
			s,
			minion
		};
	}
	const catchS = leg.back && owner !== void 0 ? touchTime(projectile, travel, owner, startPositions.get(owner.id) ?? owner.position) : void 0;
	const wallS = wallHitTime(projectile.position, travel, projectile.radius, arenaSize);
	const endS = Math.min(catchS ?? Infinity, wallS ?? Infinity);
	if (minionHit !== void 0 && minionHit.s <= endS && minionHit.s < (ballHit?.s ?? Infinity)) {
		const destroyed = minionHit.minion;
		return {
			balls,
			projectile: void 0,
			destroyedMinionId: destroyed.id,
			events: [{
				type: "projectileExpired",
				...base,
				reason: "minion"
			}, {
				type: "minionDestroyed",
				tick,
				minionId: destroyed.id,
				ownerId: destroyed.ownerId,
				position: destroyed.position,
				reason: "projectile",
				byId: projectile.ownerId
			}]
		};
	}
	let current = balls;
	const events = [];
	let hitIds = leg.hitIds;
	if (ballHit !== void 0 && ballHit.s <= endS) {
		const hit = dealAbilityDamage(current, projectile.ownerId, ballHit.ball.id, projectile.damage, definitions, tick, "projectile");
		current = hit.balls;
		hitIds = [...hitIds, ballHit.ball.id];
		events.push({
			type: "projectileHit",
			...base,
			targetId: ballHit.ball.id,
			point: addScaled(projectile.position, travel, ballHit.s),
			amount: hit.damage?.amount ?? 0
		}, ...hit.events);
	}
	const done = (reason) => ({
		balls: current,
		projectile: void 0,
		destroyedMinionId: void 0,
		events: [...events, {
			type: "projectileExpired",
			...base,
			reason
		}]
	});
	if (catchS !== void 0 && catchS <= (wallS ?? Infinity)) return done("caught");
	if (wallS !== void 0) {
		if (leg.back) return done("wall");
		return {
			balls: current,
			projectile: {
				...projectile,
				position: addScaled(projectile.position, travel, wallS),
				velocity,
				ticksLeft: projectile.ticksLeft - 1,
				returning: {
					...leg,
					back: true,
					hitIds: []
				}
			},
			destroyedMinionId: void 0,
			events
		};
	}
	if (projectile.ticksLeft <= 1) return done("lifetime");
	return {
		balls: current,
		projectile: {
			...projectile,
			position: addScaled(projectile.position, travel, 1),
			velocity,
			ticksLeft: projectile.ticksLeft - 1,
			returning: {
				...leg,
				hitIds
			}
		},
		destroyedMinionId: void 0,
		events
	};
}
// src/sim/projectiles/resolve.ts
var subtract = (a, b) => ({
	x: a.x - b.x,
	y: a.y - b.y
});
/**
* Moves every projectile one tick and resolves what it touches (ADR 0005). Each projectile's path
* is swept against each live enemy ball's motion over the tick (from `startPositions` to where the
* ball is now). The nearest hit along the path wins if it comes before the wall; otherwise a wall
* or an exhausted lifetime removes it. Projectiles resolve in creation order and each hit is
* applied before the next is checked, so a ball brought to 0 health by one projectile is passed
* through by the rest. Enemy minions are targets too (ADR 0026), swept on their motion this tick
* (from `minionStarts`): a projectile that reaches one first destroys it and is used up, which is
* how minions soak shots meant for their owner.
*/
function resolveProjectiles(projectiles, balls, startPositions, definitions, arenaSize, tick, minions = [], minionStarts = /* @__PURE__ */ new Map()) {
	let current = balls;
	let standing = minions;
	const remaining = [];
	const events = [];
	for (const projectile of projectiles) {
		if (projectile.returning !== void 0) {
			const flown = resolveReturning(projectile, projectile.returning, current, startPositions, standing, minionStarts, definitions, arenaSize, tick);
			current = flown.balls;
			if (flown.destroyedMinionId !== void 0) standing = standing.filter((minion) => minion.id !== flown.destroyedMinionId);
			if (flown.projectile !== void 0) remaining.push(flown.projectile);
			events.push(...flown.events);
			continue;
		}
		const travel = scale(projectile.velocity, DT);
		let nearest;
		for (const ball of current) {
			if (isAllyOf(current, ball, projectile.ownerId) || !isAlive(ball)) continue;
			if (isPhased(ball, getDefinition(definitions, ball.definitionId))) continue;
			const ballStart = startPositions.get(ball.id) ?? ball.position;
			const s = sweepHitTime(subtract(projectile.position, ballStart), subtract(travel, subtract(ball.position, ballStart)), ball.radius + projectile.radius);
			if (s !== void 0 && (nearest === void 0 || s < nearest.s)) nearest = {
				s,
				ball
			};
		}
		let minionHit;
		for (const minion of standing) {
			if (sideOfId(current, minion.ownerId) === sideOfId(current, projectile.ownerId)) continue;
			const minionStart = minionStarts.get(minion.id) ?? minion.position;
			const s = sweepHitTime(subtract(projectile.position, minionStart), subtract(travel, subtract(minion.position, minionStart)), minion.radius + projectile.radius);
			if (s !== void 0 && (minionHit === void 0 || s < minionHit.s)) minionHit = {
				s,
				minion
			};
		}
		const wallS = wallHitTime(projectile.position, travel, projectile.radius, arenaSize);
		const base = {
			tick,
			projectileId: projectile.id,
			ownerId: projectile.ownerId
		};
		const minionFirst = minionHit !== void 0 && (wallS === void 0 || minionHit.s <= wallS) && (nearest === void 0 || minionHit.s < nearest.s);
		if (minionHit !== void 0 && minionFirst) {
			const destroyed = minionHit.minion;
			standing = standing.filter((minion) => minion.id !== destroyed.id);
			events.push({
				type: "projectileExpired",
				...base,
				reason: "minion"
			}, {
				type: "minionDestroyed",
				tick,
				minionId: destroyed.id,
				ownerId: destroyed.ownerId,
				position: destroyed.position,
				reason: "projectile",
				byId: projectile.ownerId
			});
		} else if (nearest !== void 0 && (wallS === void 0 || nearest.s <= wallS)) {
			const { balls: afterHit, damage, events: hitEvents } = dealAbilityDamage(current, projectile.ownerId, nearest.ball.id, projectile.damage, definitions, tick, "projectile");
			current = afterHit;
			events.push({
				type: "projectileHit",
				...base,
				targetId: nearest.ball.id,
				point: addScaled(projectile.position, travel, nearest.s),
				amount: damage?.amount ?? 0
			});
			events.push(...hitEvents);
		} else if (wallS !== void 0) events.push({
			type: "projectileExpired",
			...base,
			reason: "wall"
		});
		else if (projectile.ticksLeft <= 1) events.push({
			type: "projectileExpired",
			...base,
			reason: "lifetime"
		});
		else remaining.push({
			...projectile,
			position: addScaled(projectile.position, travel, 1),
			ticksLeft: projectile.ticksLeft - 1
		});
	}
	return {
		balls: current,
		projectiles: remaining,
		minions: standing,
		events
	};
}
// src/sim/status-effects.ts
/**
* Every live poisoned ball whose poison is due this tick takes POISON_DAMAGE as ability damage from
* the poison's source, through the same path as the `damage` action, so it is the source's damage
* and feeds its onDamageDealt. Balls resolve in array order. A poison whose source has been
* defeated still ticks, like an arrow still in flight (ADR 0005).
*/
function resolvePoison(balls, definitions, tick) {
	let current = balls;
	const damage = [];
	const events = [];
	for (const ball of balls) {
		const poison = ball.statuses.find((status) => status.kind === "poisoned");
		if (poison === void 0 || !isAlive(ball) || !isPoisonTick(poison.sinceTick, tick)) continue;
		const result = dealAbilityDamage(current, poison.sourceId, ball.id, 5, definitions, tick, "poison");
		current = result.balls;
		if (result.damage !== void 0) damage.push(result.damage);
		events.push(...result.events);
	}
	return {
		balls: current,
		damage,
		events
	};
}
// src/sim/zones/trigger.ts
/** True when a body moving from `start` to `now` touched a still circle at `centre`. */
function touched(centre, start, now, reach) {
	return sweepHitTime({
		x: start.x - centre.x,
		y: start.y - centre.y
	}, {
		x: now.x - start.x,
		y: now.y - start.y
	}, reach) !== void 0;
}
/**
* Who sets `zone` off on `tick`, or undefined: the first live, solid enemy ball (in ball order)
* whose path this tick touched its trigger circle. Only an armed zone that hasn't struck can be set
* off. Minions pass over it (a skull is no weight), and so does a phased ball, which passes through
* balls and skulls alike: setting one off is a touch (ADR 0026, 0028). Its strike still catches
* both.
*/
function triggeredBy(zone, tick, balls, startPositions, definitions) {
	const { trigger } = zone;
	if (trigger === void 0 || tick < trigger.armTick || tick >= zone.strikeTick) return void 0;
	for (const ball of balls) {
		if (isAllyOf(balls, ball, zone.ownerId) || !isAlive(ball)) continue;
		if (isPhased(ball, getDefinition(definitions, ball.definitionId))) continue;
		const start = startPositions.get(ball.id) ?? ball.position;
		if (touched(zone.position, start, ball.position, trigger.radius + ball.radius)) return ball.id;
	}
}
// src/sim/zones/resolve.ts
/** Strict overlap, as for ball collisions; squared distances, so no sqrt and no rounding. */
function overlaps(zone, ball) {
	const dx = ball.position.x - zone.position.x;
	const dy = ball.position.y - zone.position.y;
	const reach = zone.radius + ball.radius;
	return dx * dx + dy * dy < reach * reach;
}
/**
* Which strike of `zone` falls on `tick`: 0 for its first, then 1, 2, ... for a lasting zone's
* pulses (ADR 0034); undefined when it doesn't strike on this tick.
*/
function pulseAt(zone, tick) {
	if (tick === zone.strikeTick) return 0;
	const { endTick, pulseEveryTicks } = zone;
	if (endTick === void 0 || pulseEveryTicks === void 0) return void 0;
	if (tick < zone.strikeTick || tick > endTick) return void 0;
	const since = tick - zone.strikeTick;
	return since % pulseEveryTicks === 0 ? since / pulseEveryTicks : void 0;
}
/** True once a zone has nothing left to do after `tick`: it struck once, or its time is up. */
function isSpent(zone, tick) {
	return tick >= (zone.endTick ?? zone.strikeTick);
}
/**
* Strikes every zone whose strike tick is `tick` (ADR 0006), and every lasting zone whose pulse
* falls on it (ADR 0034). Each one deals its damage to every
* live ball other than its owner that overlaps it now, then is removed; the rest are kept as they
* are. Zones strike in spawn order and each strike is applied before the next, so a ball brought
* to 0 health by one zone is not hit by the next. One owner's lasting zones never stack (ADR 0045): a
* ball they all overlap on one tick is burned by the first only. A zone with a status applies it to each ball it
* hit, right after that ball's damage (ADR 0009); a ball the strike defeated gets none. Then it
* destroys every enemy minion inside it (ADR 0026). A zone with a trigger (ADR 0043) also strikes
* early, on the tick a solid enemy ball first touches its body once it is armed, swept on its
* motion this tick (from `startPositions`).
*/
function resolveZones(zones, balls, definitions, tick, minions = [], startPositions = /* @__PURE__ */ new Map()) {
	let current = balls;
	let standing = minions;
	const remaining = [];
	const events = [];
	const burned = /* @__PURE__ */ new Set();
	for (const zone of zones) {
		const setOffBy = triggeredBy(zone, tick, current, startPositions, definitions);
		const pulse = setOffBy === void 0 ? pulseAt(zone, tick) : 0;
		if (pulse === void 0) {
			if (!isSpent(zone, tick)) remaining.push(zone);
			continue;
		}
		if (setOffBy === void 0 && !isSpent(zone, tick)) remaining.push(zone);
		const hitIds = [];
		const damage = [];
		for (const ball of current) {
			if (isAllyOf(current, ball, zone.ownerId) || !isAlive(ball) || !overlaps(zone, ball)) continue;
			const lasting = zone.endTick !== void 0;
			const burnKey = `${zone.ownerId}>${ball.id}`;
			if (lasting && burned.has(burnKey)) continue;
			if (lasting) burned.add(burnKey);
			const result = dealAbilityDamage(current, zone.ownerId, ball.id, zone.damage, definitions, tick, zone.endTick === void 0 ? "zone" : "zonePulse");
			current = result.balls;
			damage.push(...result.events);
			if (result.damage === void 0) continue;
			hitIds.push(ball.id);
			if (zone.status !== void 0) {
				const applied = applyActions(sceneOf(current), zone.ownerId, [{
					kind: "applyStatus",
					targetId: ball.id,
					status: zone.status.kind,
					durationTicks: zone.status.durationTicks
				}], definitions, tick, Infinity);
				current = applied.balls;
				damage.push(...applied.events);
			}
		}
		events.push({
			type: "zoneStruck",
			tick,
			zoneId: zone.id,
			ownerId: zone.ownerId,
			position: zone.position,
			radius: zone.radius,
			hitIds,
			...zone.endTick === void 0 ? {} : { pulse },
			...setOffBy === void 0 ? {} : { triggeredBy: setOffBy }
		}, ...damage);
		const allied = (minion) => sideOfId(current, minion.ownerId) === sideOfId(current, zone.ownerId);
		for (const minion of standing) {
			if (allied(minion) || !overlaps(zone, minion)) continue;
			events.push({
				type: "minionDestroyed",
				tick,
				minionId: minion.id,
				ownerId: minion.ownerId,
				position: minion.position,
				reason: "zone",
				byId: zone.ownerId
			});
		}
		standing = standing.filter((minion) => allied(minion) || !overlaps(zone, minion));
	}
	return {
		balls: current,
		zones: remaining,
		minions: standing,
		events
	};
}
// src/sim/step.ts
/**
* Advances the world by exactly one tick of DT seconds and reports what happened. Pure: returns a
* new world and never mutates the input, so callers can keep earlier states for comparison or
* replay. `definitions` must be the same lookup every tick of a match.
*
* Order within a tick (ADR 0003, 0004, 0005, 0006, 0008, 0009, 0012, 0043); events come out in
* the same order. Wherever damage is dealt below, the target's `incomingDamageOf` (armor, a fade)
* takes its share first, and only the rest lands (ADR 0045):
*  1. A finished match is returned as is, with no events.
*  2. Statuses whose expiry tick is this tick are removed (ADR 0009), so every hook below already
*     sees them gone.
*  3. onTick hooks, then their actions.
*  4. Live balls move and bounce off walls; each ball that bounced gets a small seeded turn
*     (ADR 0004), which advances the world RNG.
*  5. onWallHit hooks for balls that bounced, then their actions.
*  6. Ball collisions: separation and elastic impulse (momentum-conserving physics). A pair with a
*     phased ball overlaps and passes through instead (ADR 0026).
*  7. Contact damage for new contacts (scaled by directness, lethal tiebreak); none for a pass
*     through a phased ball.
*  8. onHitBall hooks for both balls of each new contact, then their actions; for a pass through a
*     phased ball, only the phased ball's own hook (ADR 0026).
*  9. Minions move like balls (wall fold and seeded turn) and pop on the first enemy ball their
*     swept path touches, for ability damage (ADR 0026). Minions summoned in steps 3-8 already
*     move this tick.
* 9b. Projectiles move and resolve: swept against each ball's (and minion's) motion this tick,
*     the nearest hit before a wall deals ability damage (ADR 0005), or destroys an enemy minion
*     that comes first. Projectiles spawned in steps 3-8 already move this tick. A returning
*     projectile (ADR 0043) turns on its turn tick or at a wall, then homes on its owner; a hit
*     doesn't stop it (once per ball each way), its owner catches it, and a minion stops it.
* 10. Zones whose strike tick is this tick strike: each deals ability damage to every live ball
*     other than its owner that overlaps it now, then applies its status (if any) to the balls it
*     hit, destroys every enemy minion inside it, then is removed (ADR 0006, 0009, 0026). A zone
*     always strikes at least one tick after it was spawned. A zone with a trigger (a bomb,
*     ADR 0043) also strikes now if a solid enemy ball's swept path touched its body this tick, once
*     it is armed.
* 11. Poison ticks: every poisoned ball whose poison is due takes its source's ability damage
*     (ADR 0012).
* 12. onDamageDealt hooks for every damage event so far this tick (contact, projectile, zone and
*     poison), then their actions. Damage from these actions does not fire onDamageDealt again;
*     projectiles they spawn start moving next tick.
* 13. onDamageTaken hooks for every damage event so far this tick, including damage from step 12's
*     actions, then their actions (ADR 0012). Damage from these actions fires neither
*     onDamageDealt nor onDamageTaken, so nothing can chain or loop.
* 13b. onKnockedOut hooks for balls that went from alive to 0 health this tick, then their
*     actions: a `rewind` puts the ball back in the match (ADR 0034). Fires no other hooks.
* 14. ballDefeated for balls that went from alive to 0 health this tick.
* 15. Cruise speed: every live ball's velocity is rescaled to its cruise speed, keeping its
*     direction (ADR 0008); slowed balls go slower (ADR 0012). Then size: a ball that declares
*     `radiusOf` takes its radius for this tick and is kept inside the arena (ADR 0034). Last, so
*     both read ability state and statuses after every hook of the tick; they emit no events.
* 16. Contacts are updated and the match end is decided.
*
* Sides (ADR 0059): a `split` action (in any phase's actions, once per ball) appends a second ball
* on the owner's side. It runs every later phase like any ball; allies never touch or hit each
* other, and a side is out only when every ball on it is.
*/
function step$1(world, definitions) {
	if (world.match.status === "finished") return {
		world,
		events: []
	};
	for (const ball of world.balls) getDefinition(definitions, ball.definitionId);
	const tick = world.tick + 1;
	const { size } = world.arena;
	const events = [];
	const expiry = expireStatuses(world.balls, tick);
	let balls = expiry.balls;
	events.push(...expiry.events);
	let { rngState, projectiles, nextProjectileId, zones, nextZoneId, minions, nextMinionId } = world;
	const phase = (invocations) => {
		if (invocations.length === 0) return;
		const result = runPhase({
			...world,
			tick,
			balls,
			rngState,
			projectiles,
			nextProjectileId,
			zones,
			nextZoneId,
			minions,
			nextMinionId
		}, invocations, definitions);
		balls = result.balls;
		projectiles = result.projectiles;
		nextProjectileId = result.nextProjectileId;
		zones = result.zones;
		nextZoneId = result.nextZoneId;
		minions = result.minions;
		nextMinionId = result.nextMinionId;
		events.push(...result.events);
	};
	phase(tickInvocations(balls));
	const startPositions = new Map(balls.map((ball) => [ball.id, ball.position]));
	const movements = balls.map((ball) => isAlive(ball) ? moveBall(ball, size) : {
		ball,
		bounces: 0,
		bouncesX: 0,
		bouncesY: 0
	});
	const variance = applyBounceVariance(movements, rngState);
	balls = variance.balls;
	rngState = variance.rngState;
	phase(wallHitInvocations(new Map(movements.map(({ ball, bounces }) => [ball.id, bounces]))));
	const isPhasedBall = (ball) => isPhased(ball, getDefinition(definitions, ball.definitionId));
	const collisions = resolveCollisions(balls, size, isAlive, (a, b) => isPhasedBall(a) || isPhasedBall(b));
	balls = collisions.balls;
	const previousContacts = new Set(world.contacts);
	const collidedKeys = collisions.contacts.map(({ ballIds }) => pairKey(ballIds[0], ballIds[1]));
	const newContacts = collisions.contacts.filter((_contact, index) => !previousContacts.has(collidedKeys[index] ?? ""));
	events.push(...newContacts.map(({ ballIds, point, normal, impulse, phased }) => ({
		type: "collision",
		tick,
		ballIds,
		point,
		normal,
		impulse,
		...phased ? { phased } : {}
	})));
	const combat = applyContactDamage(balls, newContacts, definitions, tick);
	balls = combat.balls;
	events.push(...combat.reduced, ...combat.damage);
	const phasedIds = new Set(balls.filter(isPhasedBall).map((ball) => ball.id));
	phase(hitBallInvocations(newContacts, (id) => phasedIds.has(id)));
	const minionStarts = new Map(minions.map((minion) => [minion.id, minion.position]));
	const summoned = resolveMinions(minions, balls, startPositions, definitions, size, rngState, tick);
	balls = summoned.balls;
	minions = summoned.minions;
	rngState = summoned.rngState;
	events.push(...summoned.events);
	const flight = resolveProjectiles(projectiles, balls, startPositions, definitions, size, tick, minions, minionStarts);
	balls = flight.balls;
	projectiles = flight.projectiles;
	minions = flight.minions;
	events.push(...flight.events);
	const strikes = resolveZones(zones, balls, definitions, tick, minions, startPositions);
	balls = strikes.balls;
	zones = strikes.zones;
	minions = strikes.minions;
	events.push(...strikes.events);
	const poison = resolvePoison(balls, definitions, tick);
	balls = poison.balls;
	events.push(...poison.events);
	const damageSoFar = () => events.filter((event) => event.type === "damage");
	phase(damageDealtInvocations(damageSoFar()));
	phase(damageTakenInvocations(damageSoFar()));
	phase(knockedOutInvocations(world.balls, balls));
	events.push(...defeatsThisTick(world.balls, balls, events, tick));
	balls = applyCruiseSpeed(balls, definitions);
	balls = applySize(balls, definitions, tick, size);
	const match = evaluateMatch(balls, tick, definitions);
	if (match.status === "finished") events.push({
		type: "matchEnded",
		tick,
		result: match.result,
		reason: match.reason
	});
	return {
		world: {
			...world,
			tick,
			balls,
			rngState,
			projectiles,
			nextProjectileId,
			zones,
			nextZoneId,
			minions,
			nextMinionId,
			contacts: nextContacts(balls, world.contacts, collidedKeys),
			match
		},
		events
	};
}
// src/sim/world.ts
/**
* Uniformly random direction, using rejection sampling inside the unit circle. Avoids
* Math.cos/sin, which are not guaranteed identical across engines (ADR 0001).
*/
function randomDirection(state) {
	let current = state;
	for (;;) {
		const x = nextRange(current, -1, 1);
		const y = nextRange(x.state, -1, 1);
		current = y.state;
		const lengthSquared = x.value * x.value + y.value * y.value;
		if (lengthSquared > 1e-6 && lengthSquared <= 1) {
			const length = Math.sqrt(lengthSquared);
			return {
				value: vec2(x.value / length, y.value / length),
				state: current
			};
		}
	}
}
function newBall(definition, index, position, direction) {
	return {
		id: `ball-${index}`,
		definitionId: definition.id,
		position,
		velocity: scale(direction, definition.speed),
		radius: definition.radius,
		health: definition.maxHealth,
		abilityState: definition.initialAbilityState,
		statuses: []
	};
}
/**
* Each ball gets its own vertical strip of the arena so balls never start overlapping, a random
* position inside it, and a random launch direction.
*/
function randomStart(seed, definitions, size) {
	const stripWidth = size / definitions.length;
	let rngState = seedRng(seed);
	return {
		balls: definitions.map((definition, index) => {
			const { radius } = definition;
			if (radius * 2 > stripWidth) throw new Error(`Ball "${definition.id}" is too large for a ${definitions.length}-ball arena`);
			const stripStart = index * stripWidth;
			const x = nextRange(rngState, stripStart + radius, stripStart + stripWidth - radius);
			const y = nextRange(x.state, radius, size - radius);
			const direction = randomDirection(y.state);
			rngState = direction.state;
			return newBall(definition, index, vec2(x.value, y.value), direction.value);
		}),
		rngState
	};
}
/** Creates the opening state of a match. */
function createWorld$1(seed, definitions) {
	if (definitions.length < 2) throw new Error("A match needs at least two balls");
	const arena = { size: ARENA_SIZE };
	const { balls, rngState } = randomStart(seed, definitions, arena.size);
	return {
		tick: 0,
		arena,
		balls,
		rngState,
		contacts: [],
		match: { status: "running" },
		projectiles: [],
		nextProjectileId: 0,
		zones: [],
		nextZoneId: 0,
		minions: [],
		nextMinionId: 0
	};
}
// src/sim/series-verify.ts
/** The opening world of a series match. */
function matchWorld$1(match, definitions) {
	return createWorld$1(match.seed, [getDefinition(definitions, match.a), getDefinition(definitions, match.b)]);
}
/** Plays a match to its end, headlessly. Every match ends (ADR 0002), so this terminates. */
function playToEnd$1(world, definitions) {
	let current = world;
	while (current.match.status === "running") current = step$1(current, definitions).world;
	return current;
}
var fail = (reason) => ({
	ok: false,
	reason
});
/**
* Plays the whole series and says whether its setup is one the rules allow. It takes anything
* (a link, a save, a request body) and never throws. Valid means: a setup in form
* (`decodeSeriesSetup`: known fields, format and opponent; a length the game plays, Best of 3 or
* 5, ADR 0048; two lineups of that many different balls from the roster); played under today's
* ruleset or one whose fights are today's (`replaysHere`, ADR 0073); for a bot opponent, the lineup that bot picks from its lineup seed and, at every pick it
* was due, the pick it makes; every pick legal when it was made, none missing and none left over.
* The roster is the lookup's ids in insertion order (the order the bot picks from), which
* `indexDefinitions` keeps.
*/
function verifySeries$1(raw, definitions) {
	const roster = [...definitions.keys()];
	const decoded = decodeSeriesSetup(raw, roster);
	if (!decoded.ok) return fail(decoded.reason);
	const { setup } = decoded;
	if (!replaysHere(setup.ruleset)) return fail(`Played under ruleset ${String(setup.ruleset)}, not ${String(23)}`);
	const bestOf = setup.bestOf ?? 3;
	const { opponent } = setup;
	const bot = opponent.kind === "bot" ? botNamed(opponent.bot, setup.ruleset) : void 0;
	if (opponent.kind === "bot" && bot !== void 0) {
		if (bot.pickLineup(opponent.lineupSeed, roster, bestOf).some((id, index) => setup.b[index] !== id)) return fail(`Side B is not the lineup the ${opponent.bot} bot picks`);
	}
	let state = startSeries(setup);
	const picks = setup.picks ?? [];
	for (;;) {
		const due = awaitingPick(state);
		if (due !== void 0) {
			const pick = picks[state.picks.length];
			if (pick === void 0) return fail("The series needs a pick it was not given");
			if (due === "b" && bot !== void 0 && pick !== botPick(bot, state)) return fail(`Pick ${state.picks.length + 1} is not the one the bot makes`);
			if (!remainingOf(state, due).includes(pick)) return fail(`"${pick}" is not a ball side ${due} has left`);
			state = recordPick(state, pick);
			continue;
		}
		const match = nextMatch(state);
		if (match === void 0) break;
		const end = playToEnd$1(matchWorld$1(match, definitions), definitions);
		if (end.match.status !== "finished") return fail("A match ended without a result");
		state = recordOutcome(state, outcomeOf(end.match.result, end));
	}
	if (picks.length > state.picks.length) return fail("The series was given picks it never used");
	return {
		ok: true,
		state
	};
}
/**
* The whole series, played headlessly: `verifySeries` for callers that hold a setup they know is
* valid (tests, measurement scripts). Throws with the reason when it isn't.
*/
function playSeries$1(setup, definitions) {
	const verdict = verifySeries$1(setup, definitions);
	if (!verdict.ok) throw new Error(verdict.reason);
	return verdict.state;
}
// src/sim/index.ts
/** Every ball id, in the order the bot picks from. */
var ROSTER = [...BALL_LOOKUP.keys()];
/** The opening world of a match between two balls, by id. Throws on an id not in the roster. */
var createWorld = (seed, a, b) => createWorld$1(seed, [getDefinition(BALL_LOOKUP, a), getDefinition(BALL_LOOKUP, b)]);
/** One tick (ADR 0001): the next world and what happened in it. */
var step = (world) => step$1(world, BALL_LOOKUP);
/** Plays a match to its end, headlessly. */
var playToEnd = (world) => playToEnd$1(world, BALL_LOOKUP);
/** The opening world of a series match. */
var matchWorld = (match) => matchWorld$1(match, BALL_LOOKUP);
/** Whether a series setup (from anywhere: a link, a save, a request body) is valid; never throws. */
var verifySeries = (raw) => verifySeries$1(raw, BALL_LOOKUP);
/** The whole series of a setup known to be valid. Throws with the reason when it isn't. */
var playSeries = (setup) => playSeries$1(setup, BALL_LOOKUP);
export { BEST_OF, BOTS, BOT_LEVELS, DEFAULT_BEST_OF, FORMATS, ROSTER, RULESET_VERSION, awaitingPick, bestOfOf, botFor, botPick, botViewOf, createWorld, decodeSeriesSetup, formatOf, matchWorld, nextBallOf, nextMatch, outcomeOf, parseSeriesSetup, playSeries, playToEnd, recordOutcome, recordPick, remainingOf, revealTurnsOf, scoreOf, setupWithPicks, showdownTurnsOf, startSeries, step, verifySeries, winsNeededOf };
