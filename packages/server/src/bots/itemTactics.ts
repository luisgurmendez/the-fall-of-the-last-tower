/**
 * When a bot uses its items (USE_ITEM), like summonerTactics.ts for
 * summoner spells: a potion when hurt, an elixir as soon as it has one,
 * Stillness about to die, Unchain when held, and fight actives (Frost Nova,
 * Shelter, Sanctuary, a dash at its target) in a fight.
 */

import { InputType, getItemCatalogEntry, type ItemActiveData } from '@siege/shared';
import type { BotInput } from './BotController';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerGameContext } from '../game/ServerGameContext';

export interface ItemSituation {
  /** The enemy champion it's dealing with, if any */
  enemy: ServerChampion | null;
  /** It's taking a fight */
  fighting: boolean;
  /** It's at its fountain */
  atBase: boolean;
}

/** Health ratio under which it drinks */
const DRINK_HEALTH = 0.55;
/** Health ratio under which it freezes in Stillness with an enemy near */
const STASIS_HEALTH = 0.2;

/**
 * The item it uses now, if any (one per decision).
 */
export function chooseItemUse(champion: ServerChampion, situation: ItemSituation, context: ServerGameContext): BotInput | null {
  const now = context.getGameTime();
  const healthRatio = champion.health / champion.maxHealth;
  const enemyDistance = situation.enemy ? situation.enemy.position.distanceTo(champion.position) : Infinity;

  for (let slot = 0; slot < champion.items.length; slot++) {
    const item = champion.items[slot];
    if (!item || (item.readyAt !== undefined && item.readyAt > now)) continue;
    const definition = getItemCatalogEntry(item.definitionId);
    const active = definition?.active;
    if (!active || (definition.consumable && (item.charges ?? 0) <= 0)) continue;
    if (wants(active, champion, situation, healthRatio, enemyDistance)) {
      const at = active.targeting === 'point' ? aimFor(active, champion, situation) : champion.position;
      return { type: InputType.USE_ITEM, slot, targetX: at.x, targetY: at.y };
    }
  }
  return null;
}

function wants(
  active: ItemActiveData,
  champion: ServerChampion,
  situation: ItemSituation,
  healthRatio: number,
  enemyDistance: number,
): boolean {
  switch (active.effectType) {
    case 'potion':
      return healthRatio < DRINK_HEALTH && !situation.atBase &&
        !champion.hasEffect('item_draught') && !champion.hasEffect('item_flask');
    case 'elixir':
      return !champion.hasEffect(String(active.effectData.effect));
    case 'stasis':
      return healthRatio < STASIS_HEALTH && enemyDistance < 500;
    case 'cleanse':
      return champion.ccStatus.isStunned || champion.ccStatus.isRooted;
    case 'frost_nova':
      return situation.fighting && enemyDistance < Number(active.effectData.radius) * 0.8;
    case 'shield_allies':
      return situation.fighting && healthRatio < 0.6;
    case 'heal_area':
      return situation.fighting && healthRatio < 0.5;
    case 'dash':
      // Close in on the enemy it's fighting when it's out of reach
      return situation.fighting && enemyDistance > champion.getAttackRange() + 60 && enemyDistance < 450;
  }
}

/** Where a point active goes: a dash at the enemy, a heal on itself */
function aimFor(active: ItemActiveData, champion: ServerChampion, situation: ItemSituation): { x: number; y: number } {
  if (active.effectType === 'dash' && situation.enemy) return situation.enemy.position;
  return champion.position;
}
