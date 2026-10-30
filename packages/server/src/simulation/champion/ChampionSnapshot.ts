/**
 * ChampionSnapshot - Network snapshot of a champion.
 *
 * Copies mutable state (ability states, effects, shields, items) so the
 * snapshot doesn't change along with the champion. Clearable values use
 * null, not undefined, so delta updates clear them (see CLAUDE.md).
 */

import { EntityType, type ChampionSnapshot } from '@siege/shared';
import { remainingForcedMovementDistance } from './ChampionForcedMovement';
import type { ServerChampion } from '../ServerChampion';

/**
 * Convert a champion to a network snapshot.
 */
export function buildChampionSnapshot(champion: ServerChampion): ChampionSnapshot {
  const stats = champion.getStats();
  const fm = champion.forcedMovement;

  return {
    entityId: champion.id,
    entityType: EntityType.CHAMPION,
    side: champion.side,
    championId: champion.definition.id,
    playerId: champion.playerId,

    x: champion.position.x,
    y: champion.position.y,
    // Use null for cleared values (not undefined) for proper delta updates
    targetX: champion.targetPosition?.x ?? null,
    targetY: champion.targetPosition?.y ?? null,
    targetEntityId: champion.targetEntityId,

    health: champion.health,
    maxHealth: stats.maxHealth,
    resource: champion.resource,
    maxResource: stats.maxResource,
    level: champion.level,
    experience: champion.experience,
    experienceToNextLevel: champion.experienceToNextLevel,
    skillPoints: champion.skillPoints,

    attackDamage: stats.attackDamage,
    abilityPower: stats.abilityPower,
    armor: stats.armor,
    magicResist: stats.magicResist,
    attackSpeed: stats.attackSpeed,
    movementSpeed: stats.movementSpeed,

    isDead: champion.isDead,
    respawnTimer: champion.respawnTimer,
    isRecalling: champion.isRecalling,
    recallProgress: champion.recallProgress,

    // Dash state for ability animations
    isDashing: fm?.type === 'dash' && champion.dashAbilityId != null,
    dashTargetX: fm ? champion.position.x + fm.direction.x * remainingForcedMovementDistance(fm) : undefined,
    dashTargetY: fm ? champion.position.y + fm.direction.y * remainingForcedMovementDistance(fm) : undefined,
    dashAbilityId: champion.dashAbilityId ?? undefined,

    abilities: {
      Q: { ...champion.abilityStates.Q },
      W: { ...champion.abilityStates.W },
      E: { ...champion.abilityStates.E },
      R: { ...champion.abilityStates.R },
    },
    passive: {
      isActive: champion.passiveState.isActive,
      cooldownRemaining: champion.passiveState.cooldownRemaining,
      stacks: champion.passiveState.stacks,
      stackTimeRemaining: champion.passiveState.stackTimeRemaining,
    },
    activeEffects: champion.activeEffects.map(e => ({ ...e })),
    shields: champion.shields.map(s => ({
      amount: s.amount,
      remainingDuration: s.remainingDuration,
      sourceId: s.sourceId ?? 'unknown',
      shieldType: s.shieldType ?? 'normal',
    })),
    items: champion.items.map(i => i ? { ...i } : null),
    gold: champion.gold,

    kills: champion.kills,
    deaths: champion.deaths,
    assists: champion.assists,
    cs: champion.cs,

    trinketCharges: champion.trinketCharges,
    trinketMaxCharges: champion.trinketMaxCharges,
    trinketCooldown: champion.trinketCooldown,
    trinketRechargeProgress: champion.getTrinketRechargeProgress(),
  };
}
