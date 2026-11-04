/**
 * Nocthar's army: his Hollows and his colossus (summons he owns), raising
 * them, ordering them, and his W, E and R while the colossus lives.
 */

import {
  EntityType,
  GameConfig,
  GameEventType,
  NOCTHAR_KIT,
  NOCTHAR_COLOSSUS_SLOTS,
  calculateEffectiveCooldown,
  colossusScale,
  colossusStats,
  getAbilityDefinition,
  hollowStats,
  type Vector,
} from '@siege/shared';
import { ServerSummon, type SummonOrder } from '../../../simulation/ServerSummon';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import type { ServerGameContext } from '../../../game/ServerGameContext';
import { noctharState } from './state';

/** His living Hollows (rising ones too) */
export function hollowsOf(champion: ServerChampion, context: ServerGameContext): ServerSummon[] {
  return summonsOf(champion, context, 'hollow');
}

/** His colossus, if it lives */
export function colossusOf(champion: ServerChampion, context: ServerGameContext): ServerSummon | undefined {
  const id = noctharState(champion).colossusId;
  const colossus = id ? context.getEntity(id) : undefined;
  return colossus instanceof ServerSummon && !colossus.isDead ? colossus : undefined;
}

function summonsOf(champion: ServerChampion, context: ServerGameContext, type: 'hollow' | 'colossus'): ServerSummon[] {
  return context.getAllEntities().filter((entity): entity is ServerSummon =>
    entity instanceof ServerSummon && entity.ownerId === champion.id && entity.minionType === type && !entity.isDead);
}

/** A Hollow claws its way out of the ground at `at` (a big one from a champion) */
export function raiseHollow(champion: ServerChampion, at: Vector, big: boolean, context: ServerGameContext): ServerSummon {
  const hollow = new ServerSummon({
    id: context.generateEntityId(),
    position: at.clone(),
    side: champion.side,
    ownerId: champion.id,
    summonType: 'hollow',
    stats: hollowStats(champion.level, champion.getStats().abilityPower, big),
    leash: NOCTHAR_KIT.leash,
    riseTime: NOCTHAR_KIT.riseTime,
    scale: big ? NOCTHAR_KIT.bigHollowScale : 1,
  });
  context.addEntity(hollow);
  context.addEvent(GameEventType.ABILITY_CAST, {
    entityId: hollow.id,
    abilityId: 'nocthar_hollow_rise',
    targetX: at.x,
    targetY: at.y,
    x: at.x,
    y: at.y,
  });
  return hollow;
}

/** How much a Hollow adds to the colossus: a big one counts twice */
export function hollowWeight(hollow: ServerSummon): number {
  return hollow.scale > 1 ? 2 : 1;
}

/**
 * The Hollows sink and the colossus rises at `at`, grown by what it took;
 * his W, E and R become its own
 */
export function raiseColossus(champion: ServerChampion, at: Vector, context: ServerGameContext): ServerSummon {
  let absorbed = 0;
  for (const hollow of hollowsOf(champion, context)) {
    absorbed += hollowWeight(hollow);
    hollow.crumble(context);
  }
  const colossus = new ServerSummon({
    id: context.generateEntityId(),
    position: at.clone(),
    side: champion.side,
    ownerId: champion.id,
    summonType: 'colossus',
    stats: colossusStats(champion.level, champion.getStats().abilityPower, absorbed),
    leash: NOCTHAR_KIT.leash,
    scale: colossusScale(absorbed),
  });
  context.addEntity(colossus);
  noctharState(champion).colossusId = colossus.id;
  for (const [slot, abilityId] of Object.entries(NOCTHAR_COLOSSUS_SLOTS)) {
    champion.swapSlotAbility(slot as 'W' | 'E' | 'R', abilityId, context);
  }
  return colossus;
}

/** The colossus fell: his W, E and R are back, and R's cooldown starts */
export function endColossus(champion: ServerChampion, context: ServerGameContext): void {
  const state = noctharState(champion);
  if (!state.colossusId) return;
  state.colossusId = null;
  for (const slot of Object.keys(NOCTHAR_COLOSSUS_SLOTS) as ('W' | 'E' | 'R')[]) {
    champion.swapSlotAbility(slot, null, context);
  }
  const rank = Math.max(1, champion.abilityStates.R.rank);
  const base = getAbilityDefinition('nocthar_r')?.cooldown?.[rank - 1] ?? 0;
  const cooldown = calculateEffectiveCooldown(base, champion.getStats().abilityHaste, GameConfig.ABILITIES.MAX_CDR);
  champion.abilityStates.R.cooldownRemaining = cooldown;
  champion.abilityStates.R.cooldownTotal = cooldown;
}

/**
 * What an order at a unit or a point means: at himself (or right next to
 * him), come back; at an enemy, hunt it; anywhere else, go there
 */
export function orderFrom(
  champion: ServerChampion,
  targetPosition: Vector | undefined,
  targetEntityId: string | undefined,
  context: ServerGameContext,
): SummonOrder | null {
  const target: ServerEntity | undefined = targetEntityId ? context.getEntity(targetEntityId) : undefined;
  if (target && target.id === champion.id) return { kind: 'follow' };
  if (target && !target.isDead && target.side !== champion.side && isFightable(target)) {
    return { kind: 'attack', targetId: target.id };
  }
  const point = targetPosition ?? target?.position;
  if (!point) return null;
  if (point.distanceTo(champion.position) <= NOCTHAR_KIT.eReturnRadius) return { kind: 'follow' };
  return { kind: 'move', point: point.clone() };
}

function isFightable(entity: ServerEntity): boolean {
  return entity.entityType === EntityType.CHAMPION || entity.entityType === EntityType.MINION ||
    entity.entityType === EntityType.JUNGLE_CAMP || entity.entityType === EntityType.TOWER ||
    entity.entityType === EntityType.INHIBITOR || entity.entityType === EntityType.NEXUS;
}
