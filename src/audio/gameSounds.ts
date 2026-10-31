/**
 * Which sound each moment of a match plays (soundCatalog.ts), called from
 * where the client already reacts to it: game events (state/gameEvents.ts),
 * units dying, changing and appearing (OnlineStateManager's lifecycle
 * hooks), the shop and the HUD. Sounds only come from what the client has:
 * units out of sight aren't in its state, so the fog hides their sounds too.
 */

import { EntityType, GameEventType, getChampionDefinition, type GameEvent } from "@siege/shared";
import type { InterpolatedEntity } from "@/core/state/entities";
import { getAudio, type SoundHandle } from "./AudioManager";
import type { SoundKey } from "./soundCatalog";

/** Champions with this attack range or less swing; the rest shoot */
const MELEE_RANGE = 80;

/** Hits between units that aren't champions (minions in lane) are quieter */
const LANE_HIT_VOLUME = 0.45;

/** Recalls in progress, by champion, to stop their sound when cancelled */
const recalls = new Map<string, SoundHandle>();

/** What the handlers need from the state manager */
export interface SoundContext {
  readonly entities: ReadonlyMap<string, InterpolatedEntity>;
  readonly localEntityId: string;
  readonly localSide: number;
}

function at(entity: InterpolatedEntity | undefined) {
  return entity ? { x: entity.position.x, y: entity.position.y } : undefined;
}

/** The sound a unit's basic attack makes as it starts, if any */
function attackSound(entity: InterpolatedEntity): SoundKey | null {
  const snapshot = entity.snapshot as { entityType: EntityType; championId?: string; minionType?: string };
  switch (snapshot.entityType) {
    case EntityType.CHAMPION: {
      const range = getChampionDefinition(snapshot.championId ?? "")?.baseStats.attackRange ?? 0;
      return range <= MELEE_RANGE ? "attack_swing" : "attack_bow";
    }
    case EntityType.TOWER:
      return "tower_shot";
    case EntityType.MINION:
      return snapshot.minionType === "siege" ? "cannon_shot" : snapshot.minionType === "caster" ? "attack_bow" : null;
    default:
      return null;
  }
}

/** Sounds for a game event */
export function playEventSound(event: GameEvent, ctx: SoundContext): void {
  const audio = getAudio();
  const data = event.data;
  switch (event.type) {
    case GameEventType.BASIC_ATTACK: {
      const entity = ctx.entities.get(data.entityId as string);
      const sound = entity && attackSound(entity);
      if (sound) audio.play(sound, at(entity), entity.snapshot.entityType === EntityType.MINION ? LANE_HIT_VOLUME : 1);
      break;
    }
    case GameEventType.DAMAGE: {
      const target = ctx.entities.get(data.entityId as string);
      if (!target || !((data.amount as number) > 0)) break;
      const source = typeof data.sourceId === "string" ? ctx.entities.get(data.sourceId) : undefined;
      const champions = [target, source].some(unit => unit?.snapshot.entityType === EntityType.CHAMPION);
      audio.play(data.damageType === "physical" ? "hit_physical" : "hit_magic", at(target), champions ? 1 : LANE_HIT_VOLUME);
      break;
    }
    case GameEventType.SUMMONER_CAST:
      audio.play(`summoner_${data.spellId as string}` as SoundKey, { x: data.x as number, y: data.y as number });
      break;
    case GameEventType.GOLD_EARNED:
      if (data.entityId === ctx.localEntityId) audio.play("gold");
      break;
    case GameEventType.CHAMPION_KILL: {
      // Our side killed or lost a champion (the death itself sounds where it fell)
      const ours = data.victimSide === ctx.localSide;
      if (data.killerSide != null || ours) audio.play(ours ? "stinger_bad" : "stinger_good");
      break;
    }
    case GameEventType.TOWER_DESTROYED:
    case GameEventType.INHIBITOR_DESTROYED:
    case GameEventType.DRAGON_KILLED: {
      const lost = event.type === GameEventType.DRAGON_KILLED ? data.side !== ctx.localSide : data.side === ctx.localSide;
      audio.play(lost ? "stinger_bad" : "stinger_good");
      break;
    }
    case GameEventType.INHIBITOR_RESPAWNED:
      audio.play(data.side === ctx.localSide ? "stinger_good" : "stinger_bad");
      break;
  }
}

/** A unit died or a structure fell (it's removed from state right after, except an inhibitor) */
export function playDeathSound(entity: InterpolatedEntity): void {
  const audio = getAudio();
  const where = at(entity);
  switch (entity.snapshot.entityType) {
    case EntityType.MINION:
      audio.play("minion_death", where);
      break;
    case EntityType.CHAMPION:
      recalls.get(entity.snapshot.entityId)?.stop();
      recalls.delete(entity.snapshot.entityId);
      audio.play("champion_death", where);
      break;
    case EntityType.JUNGLE_CAMP:
      audio.play("monster_death", where);
      break;
    case EntityType.TOWER:
    case EntityType.NEXUS:
      audio.play("tower_destroyed", where);
      break;
    case EntityType.INHIBITOR:
      audio.play("inhibitor_destroyed", where);
      break;
  }
}

/** A living unit changed: our level ups and abilities learned, and recalls starting, cancelled or arriving */
export function playChangeSound(entity: InterpolatedEntity, data: any, localEntityId: string): void {
  if (!data || entity.snapshot.entityType !== EntityType.CHAMPION) return;
  const audio = getAudio();
  const previous = entity.snapshot as { entityId: string; level?: number; isRecalling?: boolean; skillPoints?: number };

  if (entity.snapshot.entityId === localEntityId) {
    if (typeof data.level === "number" && data.level > (previous.level ?? data.level)) {
      audio.play("level_up");
    } else if (typeof data.skillPoints === "number" && data.skillPoints < (previous.skillPoints ?? 0)) {
      // A skill point spent on an ability
      audio.play("ability_level_up");
    }
  }

  if (data.isRecalling === true && !previous.isRecalling) {
    const handle = audio.play("recall_channel", at(entity));
    if (handle) recalls.set(previous.entityId, handle);
  } else if (data.isRecalling === false && previous.isRecalling) {
    recalls.get(previous.entityId)?.stop();
    recalls.delete(previous.entityId);
    // Finished: the champion jumped to its base
    if (typeof data.x === "number" && typeof data.y === "number" &&
        Math.hypot(data.x - entity.position.x, data.y - entity.position.y) > 400) {
      audio.play("recall_arrive", { x: data.x, y: data.y });
    }
  }
}

/** A ward just placed */
export function playWardPlacedSound(x: number, y: number): void {
  getAudio().play("ward_place", { x, y });
}
