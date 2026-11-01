/**
 * Zhak'rul's Ancient Venom: the doses on each enemy he poisoned, kept on him
 * (passiveState.customData) because jungle monsters don't hold effects.
 *
 * - Each dose lasts ZHAKRUL_VENOM.duration from the last one, up to three
 * - Every second the poison deals magic damage per dose, by his level and
 *   ability power; at three doses it's ancient and deals more
 * - The ticks are scheduled on the game, so they keep going if he dies
 * - Champions and minions also get zhakrul_venom (its stacks are the doses)
 *   and zhakrul_ancient_venom, for their status icons; a champion cleansed
 *   of it is cured
 */

import { EntityType, ZHAKRUL_VENOM, type ActiveEffectState } from '@siege/shared';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import type { ServerGameContext } from '../../../game/ServerGameContext';

/** What can be poisoned: not buildings */
const POISONABLE = new Set([EntityType.CHAMPION, EntityType.MINION, EntityType.JUNGLE_CAMP]);
/** The status effects outlast the poison a little, so its last tick isn't taken for a cleanse */
const MARK_MARGIN = 0.25;
/** Scheduled ticks run on the game's next tick: a poison is still on this long after it ends */
const GRACE = 0.05;
const EPSILON = 1e-6;

interface Dose {
  stacks: number;
  expiresAt: number;
  nextTickAt: number;
  /** It holds the status effects (champions and minions) */
  marked: boolean;
}

interface VenomState {
  venom?: Record<string, Dose>;
}

function venomOf(champion: ServerChampion): Record<string, Dose> {
  return ((champion.passiveState.customData ??= {}) as VenomState).venom ??= {};
}

function effectsOf(entity: ServerEntity): ActiveEffectState[] | undefined {
  return (entity as ServerEntity & { activeEffects?: ActiveEffectState[] }).activeEffects;
}

/** Doses of his venom on an enemy now (0 when it's not poisoned) */
export function venomStacks(champion: ServerChampion, target: ServerEntity, context: ServerGameContext): number {
  const dose = venomOf(champion)[target.id];
  return dose && context.getGameTime() <= dose.expiresAt + GRACE ? dose.stacks : 0;
}

/** One tick's damage for this many doses */
export function venomTickDamage(champion: ServerChampion, stacks: number): number {
  const perStack = ZHAKRUL_VENOM.perStackBase + ZHAKRUL_VENOM.perStackPerLevel * champion.level
    + ZHAKRUL_VENOM.perStackApRatio * champion.getStats().abilityPower;
  const ancient = stacks >= ZHAKRUL_VENOM.maxStacks ? ZHAKRUL_VENOM.ancientMultiplier : 1;
  return perStack * stacks * ancient;
}

/** Give an enemy doses of his venom (and refresh it) */
export function poison(champion: ServerChampion, target: ServerEntity, doses: number, context: ServerGameContext): void {
  if (target.isDead || target.side === champion.side || !POISONABLE.has(target.entityType)) return;
  const venom = venomOf(champion);
  const now = context.getGameTime();
  let dose = venom[target.id];
  const fresh = !dose || now > dose.expiresAt + GRACE;
  if (fresh) {
    dose = { stacks: 0, expiresAt: now, nextTickAt: now + ZHAKRUL_VENOM.tickEvery, marked: false };
    venom[target.id] = dose;
  }
  dose.stacks = Math.min(ZHAKRUL_VENOM.maxStacks, dose.stacks + doses);
  dose.expiresAt = now + ZHAKRUL_VENOM.duration;
  mark(champion, target, dose);
  if (fresh) context.schedule(ZHAKRUL_VENOM.tickEvery, () => tick(champion, target.id, context));
}

/** The status effects on champions and minions, matching the doses */
function mark(champion: ServerChampion, target: ServerEntity, dose: Dose): void {
  if (!('applyEffect' in target)) return;
  const apply = (target as ServerEntity & { applyEffect(id: string, duration: number, sourceId?: string): void }).applyEffect;
  const duration = ZHAKRUL_VENOM.duration + MARK_MARGIN;
  apply.call(target, 'zhakrul_venom', duration, champion.id);
  if (dose.stacks >= ZHAKRUL_VENOM.maxStacks) apply.call(target, 'zhakrul_ancient_venom', duration, champion.id);
  const effect = effectsOf(target)?.find(e => e.definitionId === 'zhakrul_venom');
  if (effect) effect.stacks = dose.stacks;
  dose.marked = true;
}

/** Whether a marked enemy lost the venom's effect: cleansed */
function cleansed(target: ServerEntity, dose: Dose): boolean {
  return dose.marked && !(effectsOf(target)?.some(e => e.definitionId === 'zhakrul_venom') ?? false);
}

function tick(champion: ServerChampion, targetId: string, context: ServerGameContext): void {
  const venom = venomOf(champion);
  const dose = venom[targetId];
  if (!dose) return;
  const target = context.getEntity(targetId);
  const now = context.getGameTime();
  if (!target || target.isDead || now > dose.expiresAt + GRACE || cleansed(target, dose)) {
    delete venom[targetId];
    return;
  }
  if (now + EPSILON >= dose.nextTickAt) {
    target.takeDamage(venomTickDamage(champion, dose.stacks), 'magic', champion.id, context);
    dose.nextTickAt += ZHAKRUL_VENOM.tickEvery;
  }
  // The next tick, or the end of the poison if it comes first (a new dose may extend it)
  const next = Math.min(dose.nextTickAt, dose.expiresAt + GRACE) - now;
  context.schedule(Math.max(next, EPSILON), () => tick(champion, targetId, context));
}
