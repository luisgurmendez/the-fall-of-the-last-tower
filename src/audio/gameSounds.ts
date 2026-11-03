/**
 * Which sound each moment of a match plays (soundCatalog.ts), called from
 * where the client already reacts to it: game events (state/gameEvents.ts),
 * units dying, changing and appearing (OnlineStateManager's lifecycle
 * hooks), the shop and the HUD. Sounds only come from what the client has:
 * units out of sight aren't in its state, so the fog hides their sounds too.
 */

import { EntityType, GameEventType, getChampionDefinition, type GameEvent } from "@siege/shared";
import type { InterpolatedEntity } from "@/core/state/entities";
import { ABILITY_CUES, type AbilityCue } from "./abilitySounds";
import { getAudio, type SoundHandle, type SoundPosition } from "./AudioManager";
import { SOUNDS, type SoundKey } from "./soundCatalog";

/**
 * The lane (minions, and towers and monsters fighting them) is in the
 * background: what champions do is what the player follows
 */
const LANE_VOLUME = 0.3;

/** Recalls in progress, by champion, to stop their sound when cancelled */
const recalls = new Map<string, SoundHandle>();

/** Sounds of a monster's special attack still to come, cut short if it dies first */
const pendingHits = new Map<string, SoundHandle[]>();

/** What the handlers need from the state manager */
export interface SoundContext {
  readonly entities: ReadonlyMap<string, InterpolatedEntity>;
  readonly localEntityId: string;
  readonly localSide: number;
}

function at(entity: InterpolatedEntity | undefined) {
  return entity ? { x: entity.position.x, y: entity.position.y } : undefined;
}

function isChampion(entity: InterpolatedEntity | undefined): boolean {
  return entity?.snapshot.entityType === EntityType.CHAMPION;
}

/**
 * An ability's sounds. Played only if its caster is in sight, or (a trap
 * springing) the unit it caught is.
 */
function playAbilitySound(data: Record<string, unknown>, ctx: SoundContext): void {
  const abilityId = data.abilityId as string;
  const cues: AbilityCue[] = ABILITY_CUES[abilityId] ?? (abilityId in SOUNDS ? [{ sound: abilityId as SoundKey }] : []);
  if (cues.length === 0) return;
  // Where it was, from something this client never had (an enemy's stealthed trap): the server says
  const place = typeof data.x === "number" && typeof data.y === "number" ? { x: data.x, y: data.y } : undefined;
  const caster = at(ctx.entities.get(data.entityId as string)) ?? place;
  const unit = typeof data.targetEntityId === "string" ? at(ctx.entities.get(data.targetEntityId)) : undefined;
  if (!caster && !unit) return;
  const aimed = typeof data.targetX === "number" && typeof data.targetY === "number" ? { x: data.targetX, y: data.targetY } : undefined;
  const monster = ctx.entities.get(data.entityId as string)?.snapshot.entityType === EntityType.JUNGLE_CAMP;
  const pending: SoundHandle[] = [];
  for (const cue of cues) {
    const where: SoundPosition | undefined = cue.at === "target" ? aimed ?? unit ?? caster : caster ?? unit;
    const handle = getAudio().play(cue.sound, where, 1, cue.delay ?? 0);
    if (handle && monster && cue.delay) pending.push(handle);
  }
  if (pending.length > 0) pendingHits.set(data.entityId as string, pending);
}

/** The sound a unit's basic attack makes as it starts, if any */
function attackSound(entity: InterpolatedEntity): SoundKey | null {
  const snapshot = entity.snapshot as { entityType: EntityType; championId?: string; minionType?: string };
  switch (snapshot.entityType) {
    case EntityType.CHAMPION: {
      // A champion's own (Oitboil's puff of flame), or else melee champions swing (a spear's reach too) and the rest shoot
      const own = `${snapshot.championId}_attack`;
      if (own in SOUNDS) return own as SoundKey;
      return getChampionDefinition(snapshot.championId ?? "")?.attackType === "ranged" ? "attack_bow" : "attack_swing";
    }
    case EntityType.TOWER:
      return "tower_shot";
    case EntityType.MINION:
      return snapshot.minionType === "siege" ? "cannon_shot" : snapshot.minionType === "caster" ? "attack_bow" : null;
    case EntityType.JUNGLE_CAMP: {
      const sound = `monster_${(entity.snapshot as { creatureType?: string }).creatureType}`;
      return sound in SOUNDS ? (sound as SoundKey) : null;
    }
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
      const target = ctx.entities.get(data.targetId as string);
      if (sound) audio.play(sound, at(entity), isChampion(entity) || isChampion(target) ? 1 : LANE_VOLUME);
      break;
    }
    case GameEventType.ABILITY_CAST:
      playAbilitySound(data, ctx);
      break;
    case GameEventType.DAMAGE: {
      const target = ctx.entities.get(data.entityId as string);
      if (!target || !((data.amount as number) > 0)) break;
      const source = typeof data.sourceId === "string" ? ctx.entities.get(data.sourceId) : undefined;
      audio.play(data.damageType === "physical" ? "hit_physical" : "hit_magic", at(target), isChampion(target) || isChampion(source) ? 1 : LANE_VOLUME);
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
    case GameEventType.PING:
      // Only the team gets pings: heard wherever the camera is
      audio.play(`ping_${data.pingType as string}` as SoundKey);
      break;
    case GameEventType.EMOTE: {
      const entity = ctx.entities.get(data.entityId as string);
      if (entity) audio.play("emote_pop", at(entity));
      break;
    }
  }
}

/**
 * A unit died or a structure fell (it's removed from state right after,
 * except an inhibitor). Our own champion's death is heard wherever the
 * camera is.
 */
export function playDeathSound(entity: InterpolatedEntity, localEntityId?: string): void {
  const audio = getAudio();
  const where = at(entity);
  switch (entity.snapshot.entityType) {
    case EntityType.MINION:
      audio.play("minion_death", where);
      break;
    case EntityType.CHAMPION:
      recalls.get(entity.snapshot.entityId)?.stop();
      recalls.delete(entity.snapshot.entityId);
      audio.play("champion_death", entity.snapshot.entityId === localEntityId ? undefined : where);
      break;
    case EntityType.JUNGLE_CAMP:
      // Its special attack, if it was winding up, won't land
      for (const handle of pendingHits.get(entity.snapshot.entityId) ?? []) handle.stop(0.05);
      pendingHits.delete(entity.snapshot.entityId);
      audio.play("monster_death", where);
      break;
    case EntityType.TOWER:
    case EntityType.NEXUS:
      audio.play("tower_destroyed", where);
      break;
    case EntityType.INHIBITOR:
      audio.play("inhibitor_destroyed", where);
      break;
    case EntityType.PROJECTILE: {
      // A projectile bursting where it hit or ran out
      const impact = `${(entity.snapshot as { abilityId?: string }).abilityId}_impact`;
      if (impact in SOUNDS) audio.play(impact as SoundKey, where);
      break;
    }
  }
}

/**
 * A living unit changed: a tower turning on us, a jungle monster resetting,
 * our level ups and abilities learned, and recalls starting, cancelled or
 * arriving
 */
export function playChangeSound(entity: InterpolatedEntity, data: any, localEntityId: string): void {
  if (!data) return;
  const audio = getAudio();
  // A tower (only enemy ones shoot us) starts aiming at our champion
  if (entity.snapshot.entityType === EntityType.TOWER && data.targetEntityId === localEntityId &&
      (entity.snapshot as { targetEntityId?: string | null }).targetEntityId !== localEntityId) {
    audio.play("tower_alert");
  }
  // A jungle monster gives up the fight and heads home
  if (entity.snapshot.entityType === EntityType.JUNGLE_CAMP && data.isReturning === true &&
      !(entity.snapshot as { isReturning?: boolean }).isReturning) {
    audio.play("monster_reset", at(entity));
  }
  if (entity.snapshot.entityType !== EntityType.CHAMPION) return;
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
    // Builds up over the recall, ending as the champion leaves
    const handle = audio.play("recall_channel", at(entity));
    if (handle) recalls.set(previous.entityId, handle);
  } else if (data.isRecalling === false && previous.isRecalling) {
    const finished = typeof data.x === "number" && typeof data.y === "number" &&
      Math.hypot(data.x - entity.position.x, data.y - entity.position.y) > 400;
    recalls.get(previous.entityId)?.stop(finished ? 0.05 : 0.15);
    recalls.delete(previous.entityId);
    // Finished: the champion beamed up from where it was and arrived in its base
    if (finished) {
      audio.play("recall_depart", at(entity));
      audio.play("recall_arrive", { x: data.x, y: data.y });
    }
  }
}

/** A ward just placed */
export function playWardPlacedSound(x: number, y: number): void {
  getAudio().play("ward_place", { x, y });
}
