/**
 * Game events from state updates, turned into client-side effects: attack and
 * cast animations, ability effects and VFX, hit sparks, screen shake,
 * floating damage/gold/XP numbers, camp timers, announcements, pings and
 * emotes.
 *
 * Floating numbers are only for the local champion, as in the classic MOBA:
 * the damage it deals or takes, and its own gold, XP and heals. Units
 * trading hits elsewhere (minions in lane) show nothing over their bars.
 */

import { CHAMPION_DEFINITIONS, EntityType, GameEventType, getAbilityDefinition, getChampionDefinition, type EmoteId, type GameEvent, type PingType } from '@siege/shared';
import { getVFXManager } from '@/vfx';
import { WORLD_VFX } from '@/vfx/world';
import { punchCamera, shakeScreen } from '@/core/screenShake';
import { abilityImpactTime } from './abilityTiming';
import { multiKillName, type KillFeed } from './killFeed';
import type { InterpolatedEntity } from './entities';
import type { AbilityEffects } from './abilityEffects';
import type { FloatingNumbers } from './floatingNumbers';
import type { CampTimers } from './campTimers';
import { ANNOUNCEMENT_DURATION, type Announcements } from './announcements';
import type { DamageTaken } from './damageTaken';
import type { Signals } from './signals';
import type { ChatLog } from './chat';
import { spawnWorldVFX } from './entityVFX';
import { spawnRisingSprites } from '@/render/overlays/risingSprites';
import { playEventSound } from '@/audio/gameSounds';

/**
 * What the event handlers read and write: the state manager's entity map,
 * the local player, and the stores the effects go into.
 */
export interface GameEventContext {
  readonly entities: ReadonlyMap<string, InterpolatedEntity>;
  readonly localEntityId: string;
  readonly localSide: number;
  /** Players' names by their champion's entity id (those the match knows) */
  readonly playerNames: ReadonlyMap<string, string>;
  readonly floatingNumbers: FloatingNumbers;
  readonly abilityEffects: AbilityEffects;
  readonly campTimers: CampTimers;
  readonly announcements: Announcements;
  readonly killFeed: KillFeed;
  /** Damage the local champion took recently (death recap) */
  readonly damageTaken: DamageTaken;
  /** Champions' kills, deaths and assists, by entity id, from the kills they took part in */
  readonly scores: Map<string, ChampionScore>;
  /** Pings and emotes */
  readonly signals: Signals;
  /** The match's chat */
  readonly chat: ChatLog;
}

/** A champion's kills, deaths and assists */
export interface ChampionScore {
  kills: number;
  deaths: number;
  assists: number;
}

/** Seconds a cast animation goes on after its ability takes effect */
const CAST_FOLLOW_THROUGH = 0.25;
/** An ABILITY_CAST this long (ms) after its cast time's end still carries on its windup's animation */
const WINDUP_GRACE_MS = 300;
/**
 * A cast's point this close to the caster isn't where it's aimed but where
 * its effect is (Zhak'rul's cloud around him, his burst out of the ground):
 * the caster doesn't turn to it
 */
const AIM_MIN_DISTANCE = 30;

/** Jungle monsters' names in the death recap, by creature type */
const MONSTER_NAMES: Record<string, string> = {
  wolf: 'Hounds',
  spider: 'Gloom Crawlers',
  thornspitter: 'Thornspitter',
  blue_buff: 'Azure Warden',
  red_buff: 'Ember Brute',
  dragon: 'Dragon',
  rootwyrm: 'Rootwyrm',
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
 * Blows the server tells about when they land, after their ability's cast:
 * a targeted leap's `<id>_land` (a target_enemy dash), Lume's orb arriving,
 * and Nocthar's army's moments (hands bursting, Hollows rising, frenzying
 * and charging, the colossus rising, its bones and its charge landing)
 */
const FOLLOW_UPS = new Set([
  'nocthar_q_burst',
  'nocthar_hollow_rise',
  'nocthar_w_frenzy',
  'nocthar_e_charge',
  'nocthar_r_emerge',
  'nocthar_colossus_w_impact',
  'nocthar_colossus_e_end',
  ...Object.values(CHAMPION_DEFINITIONS).flatMap(champion => Object.values(champion.abilities))
    .filter(abilityId => {
      const definition = getAbilityDefinition(abilityId);
      return definition?.targetType === 'target_enemy' && definition.dash !== undefined;
    })
    .map(abilityId => `${abilityId}_land`),
  'lume_q_arrive',
]);

function isFollowUp(abilityId: string): boolean {
  return FOLLOW_UPS.has(abilityId);
}

/**
 * Orders whose mark on the ground only the caster's team sees (where Nocthar
 * sent his army); an order at a unit shows to everyone (it knows it's hunted)
 */
const TEAM_ONLY_GROUND_ORDERS = new Set(['nocthar_e', 'nocthar_colossus_r']);

function hidesOrderFrom(event: GameEvent, caster: InterpolatedEntity, localSide: number): boolean {
  return TEAM_ONLY_GROUND_ORDERS.has(event.data.abilityId as string) && !event.data.targetEntityId
    && caster.snapshot.side !== localSide;
}

/** How long (ms) a cast's animation lasts: long enough to show the ability taking effect (an area landing late) */
function castDuration(event: GameEvent, abilityId: string): number {
  return Math.max((event.data.animationDuration as number) ?? 0.5, abilityImpactTime(abilityId) + CAST_FOLLOW_THROUGH) * 1000;
}

/** Start an entity's cast animation, facing where the event aims (a point or a unit) */
function startCastAnimation(entity: InterpolatedEntity, event: GameEvent, abilityId: string, now: number, duration: number): void {
  const targetX = event.data.targetX as number | undefined;
  const targetY = event.data.targetY as number | undefined;
  entity.animation.isCastingAbility = true;
  entity.animation.abilityId = abilityId;
  entity.animation.abilityStartTime = now;
  entity.animation.abilityDuration = duration;
  const aimsAway = targetX !== undefined && targetY !== undefined
    && Math.hypot(targetX - entity.serverPosition.x, targetY - entity.serverPosition.y) >= AIM_MIN_DISTANCE;
  entity.animation.abilityTargetX = aimsAway ? targetX : null;
  entity.animation.abilityTargetY = aimsAway ? targetY : null;
  const targetId = event.data.targetEntityId as string | undefined;
  entity.animation.abilityTargetId = targetId && targetId !== event.data.entityId ? targetId : null;
}

/**
 * Process a game event.
 */
export function processGameEvent(event: GameEvent, ctx: GameEventContext): void {
  const now = Date.now();
  playEventSound(event, ctx);

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
    case GameEventType.ABILITY_WINDUP: {
      // The cast time: the caster plays its cast, facing its aim, standing
      // still; the ability's effects come with ABILITY_CAST when it goes off
      const entity = ctx.entities.get(event.data.entityId as string);
      if (entity) {
        const abilityId = event.data.abilityId as string;
        const castTime = (event.data.castTime as number) * 1000;
        startCastAnimation(entity, event, abilityId, now, castTime + castDuration(event, abilityId));
        entity.animation.windupAbilityId = abilityId;
        entity.animation.windupEndTime = now + castTime;
        // What it gathers in the cast time (Magnus's fire at his staff), if it has a look for it
        try {
          getVFXManager().spawnAbilityVFX(`${abilityId}_windup`, entity.position.x, entity.position.y,
            event.data.targetX as number | undefined, event.data.targetY as number | undefined, entity.snapshot.entityId);
        } catch {
          // VFXManager not initialized yet, skip
        }
      }
      break;
    }
    case GameEventType.ABILITY_INTERRUPTED: {
      // Stun or silence cancelled the cast in its cast time
      const entity = ctx.entities.get(event.data.entityId as string);
      if (entity && entity.animation.windupAbilityId === event.data.abilityId) {
        entity.animation.isCastingAbility = false;
        entity.animation.windupAbilityId = null;
      }
      break;
    }
    case GameEventType.ABILITY_CAST: {
      const entityId = event.data.entityId as string;
      const abilityId = event.data.abilityId as string;
      const targetX = event.data.targetX as number | undefined;
      const targetY = event.data.targetY as number | undefined;
      const entity = ctx.entities.get(entityId);

      if (entity && isFollowUp(abilityId)) {
        // A blow landing later (a leap, Lume's orb): its look only, no new cast
        try {
          getVFXManager().spawnAbilityVFX(abilityId, entity.position.x, entity.position.y, targetX, targetY, entityId,
            (event.data.targetEntityId as string | undefined) ?? undefined);
        } catch {
          // VFXManager not initialized yet, skip
        }
      } else if (entity) {
        // After a cast time its animation is already playing: it carries on
        const fromWindup = entity.animation.windupAbilityId === abilityId
          && entity.animation.isCastingAbility
          && now <= entity.animation.windupEndTime + WINDUP_GRACE_MS;
        entity.animation.windupAbilityId = null;
        if (fromWindup) {
          const elapsed = now - entity.animation.abilityStartTime;
          entity.animation.abilityDuration = Math.max(entity.animation.abilityDuration, elapsed + castDuration(event, abilityId));
        } else {
          startCastAnimation(entity, event, abilityId, now, castDuration(event, abilityId));
        }

        // Create visual effect for the ability (legacy system)
        ctx.abilityEffects.create(entity, abilityId, targetX, targetY, now);
        // What rises out of the ground where it's aimed (Nocthar's hands)
        if (targetX !== undefined && targetY !== undefined) spawnRisingSprites(abilityId, targetX, targetY, now);

        // Spawn VFX for the ability (new VFX system)
        try {
          if (hidesOrderFrom(event, entity, ctx.localSide)) break;
          const vfxManager = getVFXManager();
          // From where it starts: the caster, or elsewhere (Lume's Eclipse, from her orb)
          const originX = (event.data.originX as number | undefined) ?? entity.position.x;
          const originY = (event.data.originY as number | undefined) ?? entity.position.y;
          const aimed = event.data.originX === undefined ? lineEnd(abilityId, originX, originY, targetX, targetY) : undefined;
          vfxManager.spawnAbilityVFX(
            abilityId,
            originX,
            originY,
            aimed?.x ?? targetX,
            aimed?.y ?? targetY,
            entityId,
            (event.data.targetEntityId as string | undefined) ?? undefined
          );
        } catch {
          // VFXManager not initialized yet, skip
        }
      } else if (typeof event.data.x === 'number' && typeof event.data.y === 'number') {
        // From something this client never had (an enemy's stealthed trap
        // springing or bursting): its look where the server says it was
        try {
          getVFXManager().spawnAbilityVFX(abilityId, event.data.x, event.data.y, targetX, targetY, undefined,
            (event.data.targetEntityId as string | undefined) ?? undefined);
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

      // A heavy hit on the local champion (over 15% of its health) shakes the screen,
      // and so, a little, does a heavy hit of ours on a champion (over 12%)
      const maxHealth = (entity?.snapshot as { maxHealth?: number } | undefined)?.maxHealth ?? Infinity;
      if (entity && entityId === ctx.localEntityId && amount > maxHealth * 0.15) {
        shakeScreen(4, 0.25);
      } else if (entity?.snapshot.entityType === EntityType.CHAMPION && event.data.sourceId === ctx.localEntityId && amount > maxHealth * 0.12) {
        shakeScreen(2.5, 0.15);
      }

      if (entityId === ctx.localEntityId && amount > 0) {
        ctx.damageTaken.record(describeDamageSource(event.data, ctx), amount, damageType, now);
      }

      if (entity && amount > 0) {
        entity.animation.hitTime = performance.now();
        // Knocked back away from what hit it
        const source = typeof event.data.sourceId === 'string' ? ctx.entities.get(event.data.sourceId) : undefined;
        const dx = source ? entity.position.x - source.position.x : 0;
        const dy = source ? entity.position.y - source.position.y : 0;
        const length = Math.hypot(dx, dy);
        entity.animation.hitDirX = length > 0 ? dx / length : 0;
        entity.animation.hitDirY = length > 0 ? dy / length : 0;
        const spark = damageType === 'magic' ? WORLD_VFX.HIT_MAGIC
          : damageType === 'physical' ? WORLD_VFX.HIT_PHYSICAL
          : WORLD_VFX.HIT_TRUE;
        spawnWorldVFX(spark, entity.position.x, entity.position.y - 10);
      }

      // Ours, and our towers' shots on champions (the enemy ones show on us, so
      // without these our towers seemed not to hit back)
      const shooter = typeof event.data.sourceId === 'string' ? ctx.entities.get(event.data.sourceId) : undefined;
      const ourTowerOnChampion = shooter?.snapshot.entityType === EntityType.TOWER &&
        shooter.snapshot.side === ctx.localSide && entity?.snapshot.entityType === EntityType.CHAMPION;
      const ours = entityId === ctx.localEntityId || event.data.sourceId === ctx.localEntityId || ourTowerOnChampion;
      if (entity && ours && (amount > 0 || shieldAbsorbed > 0)) {
        ctx.floatingNumbers.addDamage({
          entityId,
          x: entity.position.x,
          y: entity.position.y,
          amount,
          shieldAbsorbed,
          damageType,
          crit: event.data.crit === true,
          startTime: now,
        });
      }
      break;
    }
    case GameEventType.GOLD_EARNED: {
      const entityId = event.data.entityId as string;
      const amount = event.data.amount as number;
      const entity = ctx.entities.get(entityId);

      if (entity && entityId === ctx.localEntityId && amount > 0) {
        ctx.floatingNumbers.addGold({
          entityId,
          x: entity.position.x,
          y: entity.position.y,
          amount,
          startTime: now,
        });
        // Our last hit: coins burst where the minion or monster fell
        const lastHit = event.data.sourceType === EntityType.MINION || event.data.sourceType === EntityType.JUNGLE_CAMP;
        if (lastHit && typeof event.data.x === 'number' && typeof event.data.y === 'number') {
          spawnWorldVFX(WORLD_VFX.LAST_HIT, event.data.x, event.data.y);
        }
      }
      break;
    }
    case GameEventType.SUMMONER_CAST: {
      const x = event.data.x as number;
      const y = event.data.y as number;
      try {
        getVFXManager().spawnAbilityVFX(
          `summoner_${event.data.spellId as string}`,
          x,
          y,
          (event.data.toX as number | undefined) ?? x,
          (event.data.toY as number | undefined) ?? y,
          event.data.entityId as string,
          event.data.targetId as string | undefined
        );
      } catch {
        // VFXManager not initialized yet, skip
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
      // The new totals of everyone in the kill, enemies out of sight included
      for (const score of (event.data.scores ?? []) as (ChampionScore & { entityId: string })[]) {
        ctx.scores.set(score.entityId, { kills: score.kills, deaths: score.deaths, assists: score.assists });
      }
      // We took a champion down, or went down: the camera punches in
      if (event.data.killerId === ctx.localEntityId || event.data.victimId === ctx.localEntityId) {
        punchCamera(0.05, 0.4);
        shakeScreen(5, 0.3);
      }
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
    case GameEventType.INHIBITOR_DESTROYED: {
      const ours = event.data.side === ctx.localSide;
      ctx.announcements.add({
        text: ours ? 'Your inhibitor has been destroyed' : 'Your team destroyed an inhibitor!',
        detail: ours ? 'Enemy super minions are coming down that lane' : 'Your super minions march down that lane',
        color: ours ? '#ec7063' : '#5dade2',
        startTime: now,
        duration: ANNOUNCEMENT_DURATION,
      });
      break;
    }
    case GameEventType.INHIBITOR_RESPAWNED: {
      const ours = event.data.side === ctx.localSide;
      ctx.announcements.add({
        text: ours ? 'Your inhibitor has respawned' : 'The enemy inhibitor has respawned',
        color: ours ? '#5dade2' : '#ec7063',
        startTime: now,
        duration: ANNOUNCEMENT_DURATION,
      });
      break;
    }
    case GameEventType.DRAGON_KILLED: {
      // An epic monster: the dragon or the Rootwyrm
      const allied = event.data.side === ctx.localSide;
      const rootwyrm = event.data.creatureType === 'rootwyrm';
      const monster = rootwyrm ? 'the Rootwyrm' : 'the Dragon';
      ctx.announcements.add({
        text: allied ? `Your team slew ${monster}!` : `The enemy team slew ${monster}!`,
        detail: rootwyrm
          ? 'Heartwood Pact: +12 armor and magic resist, +5 health regen'
          : "Dragon's Might: +8% attack damage and ability power",
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
      if (entity && entityId === ctx.localEntityId && amount > 0) {
        ctx.floatingNumbers.addHeal({ entityId, x: entity.position.x, y: entity.position.y, amount, startTime: now });
      }
      break;
    }

    case GameEventType.XP_EARNED: {
      const entityId = event.data.entityId as string;
      const amount = event.data.amount as number;
      const entity = ctx.entities.get(entityId);

      if (entity && entityId === ctx.localEntityId && amount > 0) {
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

    case GameEventType.PING: {
      // The server sends a ping to its team only
      ctx.signals.addPing({
        pingType: event.data.pingType as PingType,
        x: event.data.x as number,
        y: event.data.y as number,
        entityId: event.data.entityId as string,
        championId: event.data.championId as string,
        time: now,
      });
      break;
    }

    case GameEventType.EMOTE: {
      ctx.signals.addEmote(event.data.entityId as string, event.data.emote as EmoteId, now);
      break;
    }

    case GameEventType.CHAT: {
      // The server sends a team message to its team only
      const { text, entityId, championId, side, scope } = event.data;
      if (typeof text !== 'string') break;
      ctx.chat.add({
        text,
        scope: scope === 'all' ? 'all' : 'team',
        entityId: entityId as string,
        championId: championId as string,
        isAlly: side === ctx.localSide,
        isLocal: entityId === ctx.localEntityId,
        time: now,
        name: ctx.playerNames.get(entityId as string),
      });
      break;
    }

    case GameEventType.PLAYER_CONNECTION: {
      const { entityId, championId, side, status } = event.data;
      const isLocal = entityId === ctx.localEntityId;
      const name = getChampionDefinition(championId as string)?.name ?? String(championId);
      const text = status === 'bot' ? `${name} lost their connection: a bot plays for them until they are back`
        : status === 'back' ? (isLocal ? 'You are back: the bot let go of your champion' : `${name} is back`)
        : null;
      if (text === null) break;
      ctx.chat.add({
        text,
        scope: 'all',
        entityId: entityId as string,
        championId: championId as string,
        isAlly: side === ctx.localSide,
        isLocal,
        time: now,
        system: true,
      });
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
  const kill = ctx.killFeed.add({
    killerChampionId: (data.killerChampionId as string | null) ?? null,
    killerType: (data.killerType as EntityType | null) ?? null,
    killerSide: (data.killerSide as number | null) ?? null,
    victimChampionId: (data.victimChampionId as string | undefined) ?? '',
    victimSide: data.victimSide as number,
    time: now,
  }, (data.killerId as string | null) ?? null);

  const name = (championId: string | null) => (championId && getChampionDefinition(championId)?.name) || 'A champion';
  let text: string;
  if (victimIsLocal) text = 'You have been slain!';
  else if (killerIsLocal) text = 'You have slain an enemy!';
  else if (kill.killerChampionId) text = `${name(kill.killerChampionId)} has slain ${name(kill.victimChampionId)}`;
  else text = allyDied ? 'An ally has been slain' : 'An enemy has been slain';

  // A double kill or better takes the banner, with who did it
  const multiKill = multiKillName(kill.streak);
  const headline = data.firstBlood ? 'First Blood!' : multiKill
    ? (killerIsLocal ? multiKill : `${name(kill.killerChampionId)}: ${multiKill}`)
    : text;
  ctx.announcements.add({
    text: headline,
    detail: headline === text ? undefined : text,
    color: allyDied ? '#ec7063' : '#f5b041',
    startTime: now,
    duration: ANNOUNCEMENT_DURATION,
  });
}

/**
 * Where a line ability's VFX should end: its area always runs its full
 * range along the aim (generic/Line.ts), wherever the cursor was, so the
 * effect is drawn to there. Undefined for other abilities.
 */
function lineEnd(abilityId: string, fromX: number, fromY: number, targetX?: number, targetY?: number): { x: number; y: number } | undefined {
  const definition = getAbilityDefinition(abilityId);
  if (definition?.targetType !== 'ground_target' || definition.shape !== 'line' || !definition.range) return undefined;
  if (targetX === undefined || targetY === undefined) return undefined;
  const dx = targetX - fromX;
  const dy = targetY - fromY;
  const length = Math.hypot(dx, dy);
  if (length < 1) return undefined;
  return { x: fromX + (dx / length) * definition.range, y: fromY + (dy / length) * definition.range };
}
