/**
 * Game events from state updates, turned into client-side effects: attack and
 * cast animations, ability effects and VFX, hit sparks, screen shake,
 * floating damage/gold/XP numbers, camp timers and announcements.
 */

import { EntityType, GameEventType, getChampionDefinition, type GameEvent } from '@siege/shared';
import { getVFXManager } from '@/vfx';
import { WORLD_VFX } from '@/vfx/world';
import { shakeScreen } from '@/core/screenShake';
import type { InterpolatedEntity } from './entities';
import type { AbilityEffects } from './abilityEffects';
import type { FloatingNumbers } from './floatingNumbers';
import type { CampTimers } from './campTimers';
import { ANNOUNCEMENT_DURATION, type Announcements } from './announcements';
import type { DamageTaken } from './damageTaken';
import { spawnWorldVFX } from './entityVFX';

/**
 * What the event handlers read and write: the state manager's entity map,
 * the local player, and the stores the effects go into.
 */
export interface GameEventContext {
  readonly entities: ReadonlyMap<string, InterpolatedEntity>;
  readonly localEntityId: string;
  readonly localSide: number;
  readonly floatingNumbers: FloatingNumbers;
  readonly abilityEffects: AbilityEffects;
  readonly campTimers: CampTimers;
  readonly announcements: Announcements;
  /** Damage the local champion took recently (death recap) */
  readonly damageTaken: DamageTaken;
}

/** Jungle monsters' names in the death recap, by creature type */
const MONSTER_NAMES: Record<string, string> = {
  wolf: 'Hounds',
  spider: 'Gloom Crawlers',
  thornspitter: 'Thornspitter',
  blue_buff: 'Azure Warden',
  red_buff: 'Ember Brute',
  dragon: 'Dragon',
};

/**
 * What dealt damage, as the death recap names it: from the source if the
 * client has it, else from what the event says about it (a source out of
 * sight, or a minion that died with its shot in flight).
 */
function describeDamageSource(data: Record<string, unknown>, ctx: GameEventContext): string {
  const source = typeof data.sourceId === 'string' ? ctx.entities.get(data.sourceId) : undefined;
  const snapshot = (source?.snapshot ?? {
    entityType: data.sourceType,
    championId: data.sourceChampionId,
    creatureType: data.sourceCreatureType,
  }) as { entityType?: EntityType; championId?: string; creatureType?: string };
  switch (snapshot.entityType) {
    case EntityType.CHAMPION:
      return getChampionDefinition(snapshot.championId ?? '')?.name ?? 'Champion';
    case EntityType.MINION:
      return 'Minions';
    case EntityType.TOWER:
      return 'Tower';
    case EntityType.JUNGLE_CAMP:
      return MONSTER_NAMES[snapshot.creatureType ?? ''] ?? 'Jungle monster';
    default:
      return 'Unknown';
  }
}

/**
 * Process a game event.
 */
export function processGameEvent(event: GameEvent, ctx: GameEventContext): void {
  const now = Date.now();

  switch (event.type) {
    case GameEventType.BASIC_ATTACK: {
      const entityId = event.data.entityId as string;
      const duration = (event.data.animationDuration as number) * 1000; // Convert to ms
      const entity = ctx.entities.get(entityId);
      if (entity) {
        entity.animation.isAttacking = true;
        entity.animation.attackStartTime = now;
        entity.animation.attackDuration = duration;
      }
      break;
    }
    case GameEventType.ABILITY_CAST: {
      const entityId = event.data.entityId as string;
      const abilityId = event.data.abilityId as string;
      const targetX = event.data.targetX as number | undefined;
      const targetY = event.data.targetY as number | undefined;
      const duration = ((event.data.animationDuration as number) ?? 0.5) * 1000;
      const entity = ctx.entities.get(entityId);

      if (entity) {
        entity.animation.isCastingAbility = true;
        entity.animation.abilityId = abilityId;
        entity.animation.abilityStartTime = now;
        entity.animation.abilityDuration = duration;

        // Create visual effect for the ability (legacy system)
        ctx.abilityEffects.create(entity, abilityId, targetX, targetY, now);

        // Spawn VFX for the ability (new VFX system)
        try {
          const vfxManager = getVFXManager();
          vfxManager.spawnAbilityVFX(
            abilityId,
            entity.position.x,
            entity.position.y,
            targetX,
            targetY,
            entityId,
            (event.data.targetEntityId as string | undefined) ?? undefined
          );
        } catch {
          // VFXManager not initialized yet, skip
        }
      }
      break;
    }
    case GameEventType.DAMAGE: {
      const entityId = event.data.entityId as string;
      const amount = event.data.amount as number;
      const shieldAbsorbed = (event.data.shieldAbsorbed as number) || 0;
      const damageType = event.data.damageType as 'physical' | 'magic' | 'true' | 'pure';
      const entity = ctx.entities.get(entityId);

      // A heavy hit on the local champion (over 15% of its health) shakes the screen
      if (entity && entityId === ctx.localEntityId && amount > ((entity.snapshot as any).maxHealth ?? Infinity) * 0.15) {
        shakeScreen(4, 0.25);
      }

      if (entityId === ctx.localEntityId && amount > 0) {
        ctx.damageTaken.record(describeDamageSource(event.data, ctx), amount, damageType, now);
      }

      if (entity && amount > 0) {
        entity.animation.hitTime = performance.now();
        const spark = damageType === 'magic' ? WORLD_VFX.HIT_MAGIC
          : damageType === 'physical' ? WORLD_VFX.HIT_PHYSICAL
          : WORLD_VFX.HIT_TRUE;
        spawnWorldVFX(spark, entity.position.x, entity.position.y - 10);
      }

      if (entity && (amount > 0 || shieldAbsorbed > 0)) {
        ctx.floatingNumbers.addDamage({
          entityId,
          x: entity.position.x,
          y: entity.position.y,
          amount,
          shieldAbsorbed,
          damageType,
          startTime: now,
        });
      }
      break;
    }
    case GameEventType.GOLD_EARNED: {
      const entityId = event.data.entityId as string;
      const amount = event.data.amount as number;
      const entity = ctx.entities.get(entityId);

      if (entity && amount > 0) {
        ctx.floatingNumbers.addGold({
          entityId,
          x: entity.position.x,
          y: entity.position.y,
          amount,
          startTime: now,
        });
      }
      break;
    }
    case GameEventType.CAMP_CLEARED: {
      ctx.campTimers.set({
        campId: event.data.campId as string,
        creatureType: event.data.creatureType as string,
        x: event.data.x as number,
        y: event.data.y as number,
        respawnAt: event.data.respawnAt as number,
      });
      break;
    }
    case GameEventType.CHAMPION_KILL: {
      announceChampionKill(event.data, now, ctx);
      break;
    }
    case GameEventType.TOWER_DESTROYED: {
      const ours = event.data.side === ctx.localSide;
      ctx.announcements.add({
        text: ours ? 'Your tower has been destroyed' : 'Your team destroyed a tower!',
        color: ours ? '#ec7063' : '#5dade2',
        startTime: now,
        duration: ANNOUNCEMENT_DURATION,
      });
      break;
    }
    case GameEventType.DRAGON_KILLED: {
      const allied = event.data.side === ctx.localSide;
      ctx.announcements.add({
        text: allied ? 'Your team slew the Dragon!' : 'The enemy team slew the Dragon!',
        detail: "Dragon's Might: +8% attack damage and ability power",
        color: allied ? '#5dade2' : '#ec7063',
        startTime: now,
        duration: ANNOUNCEMENT_DURATION,
      });
      break;
    }
    case GameEventType.HEAL: {
      const entityId = event.data.entityId as string;
      const amount = event.data.amount as number;
      const entity = ctx.entities.get(entityId);
      if (entity && amount > 0) {
        ctx.floatingNumbers.addHeal({ entityId, x: entity.position.x, y: entity.position.y, amount, startTime: now });
      }
      break;
    }

    case GameEventType.XP_EARNED: {
      const entityId = event.data.entityId as string;
      const amount = event.data.amount as number;
      const entity = ctx.entities.get(entityId);

      if (entity && amount > 0) {
        ctx.floatingNumbers.addXp({
          entityId,
          x: entity.position.x,
          y: entity.position.y,
          amount,
          startTime: now,
        });
      }
      break;
    }
  }
}

/**
 * "You have slain an enemy!" and friends, from the local player's point of view.
 */
function announceChampionKill(data: Record<string, unknown>, now: number, ctx: GameEventContext): void {
  const victimIsLocal = data.victimId === ctx.localEntityId;
  const killerIsLocal = data.killerId === ctx.localEntityId;
  const allyDied = data.victimSide === ctx.localSide;

  let text: string;
  if (victimIsLocal) text = 'You have been slain!';
  else if (killerIsLocal) text = 'You have slain an enemy!';
  else text = allyDied ? 'An ally has been slain' : 'An enemy has been slain';

  ctx.announcements.add({
    text: data.firstBlood ? 'First Blood!' : text,
    detail: data.firstBlood ? text : undefined,
    color: allyDied ? '#ec7063' : '#f5b041',
    startTime: now,
    duration: ANNOUNCEMENT_DURATION,
  });
}
