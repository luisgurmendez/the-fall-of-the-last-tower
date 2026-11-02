/**
 * Recorder - Captures what happens in a Simulation so an agent (or a human)
 * can read it afterwards: sampled frames for rendering, and a log of notable
 * moments (deaths, casts, level ups, recalls, spawns) with kill attribution.
 */

import { EntityType, GameEventType, type GameEvent } from '@siege/shared';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerTower } from '../simulation/ServerTower';
import type { ServerGameContext } from '../game/ServerGameContext';

export type SimEntityKind =
  | 'champion' | 'minion' | 'tower' | 'inhibitor' | 'nexus'
  | 'jungle' | 'projectile' | 'ward' | 'zone' | 'orb' | 'blossom';

const KIND_BY_TYPE: Record<EntityType, SimEntityKind> = {
  [EntityType.CHAMPION]: 'champion',
  [EntityType.MINION]: 'minion',
  [EntityType.TOWER]: 'tower',
  [EntityType.INHIBITOR]: 'inhibitor',
  [EntityType.NEXUS]: 'nexus',
  [EntityType.JUNGLE_CAMP]: 'jungle',
  [EntityType.PROJECTILE]: 'projectile',
  [EntityType.WARD]: 'ward',
  [EntityType.ZONE]: 'zone',
  [EntityType.LIGHT_ORB]: 'orb',
  [EntityType.BLOSSOM]: 'blossom',
};

/**
 * Compact entity state in a frame.
 */
export interface SimEntity {
  id: string;
  kind: SimEntityKind;
  /** 0 = blue, 1 = red, 2 = neutral */
  side: number;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  /** championId, minionType, creatureType, projectile/zone/ward type */
  label: string;
  targetId: string | null;
  dead: boolean;
  playerId?: string;
  level?: number;
  recalling?: boolean;
  /** Attack range (towers) */
  range?: number;
}

export interface SimFrame {
  time: number;
  tick: number;
  entities: SimEntity[];
}

export type SimLogKind = 'spawn' | 'death' | 'cast' | 'level' | 'recall' | 'respawn' | 'note';

export interface SimLogEntry {
  time: number;
  kind: SimLogKind;
  text: string;
  entityId?: string;
  data?: Record<string, unknown>;
}

export interface RecorderOptions {
  /** Seconds between captured frames (default 0.1) */
  sampleInterval?: number;
}

/**
 * Build a SimEntity from a live server entity.
 */
export function toSimEntity(entity: ServerEntity): SimEntity {
  const snapshot = entity.toSnapshot() as unknown as Record<string, unknown>;
  const kind = KIND_BY_TYPE[entity.entityType];
  const label = String(
    snapshot.championId ?? snapshot.minionType ?? snapshot.creatureType ??
    snapshot.projectileType ?? snapshot.abilityId ?? snapshot.wardType ?? kind
  );
  // Minions and jungle creatures keep their attack target privately; the snapshot
  // only has it for some types, so fall back to the field for the debug view
  const targetId = (snapshot.targetEntityId as string | null | undefined) ??
    (entity as unknown as { attackTarget?: string | null }).attackTarget ??
    entity.targetEntityId ?? null;

  const simEntity: SimEntity = {
    id: entity.id,
    kind,
    side: (snapshot.side as number | undefined) ?? entity.side,
    x: Math.round(entity.position.x),
    y: Math.round(entity.position.y),
    radius: (snapshot.radius as number | undefined) ?? entity.getRadius(),
    hp: Math.round(entity.health),
    maxHp: Math.round(entity.maxHealth),
    label,
    targetId,
    dead: entity.isDead,
  };

  if (entity.entityType === EntityType.TOWER) {
    // From the tower's center to a target's edge (attack range is edge to edge)
    simEntity.range = (entity as ServerTower).attackRange + entity.getRadius();
  }
  if (entity.entityType === EntityType.CHAMPION) {
    const champion = entity as ServerChampion;
    simEntity.playerId = champion.playerId;
    simEntity.level = champion.level;
    simEntity.recalling = champion.isRecalling;
  }
  return simEntity;
}

const SIDE_NAMES = ['blue', 'red', 'neutral'];

export class Recorder {
  readonly frames: SimFrame[] = [];
  readonly log: SimLogEntry[] = [];
  readonly events: (GameEvent & { time: number })[] = [];
  /** Damage dealt, keyed by source description then target kind */
  readonly damage: Map<string, Map<SimEntityKind, number>> = new Map();

  private readonly sampleInterval: number;
  private nextSampleTime = 0;

  private names: Map<string, string> = new Map();
  private kinds: Map<string, SimEntityKind> = new Map();
  private lastDamager: Map<string, string> = new Map();
  private alive: Map<string, boolean> = new Map();
  private levels: Map<string, number> = new Map();
  private recalling: Map<string, boolean> = new Map();
  private pendingMinionSpawns = 0;

  constructor(options: RecorderOptions = {}) {
    this.sampleInterval = options.sampleInterval ?? 0.1;
  }

  /**
   * Record one tick. Call after context.update() with the events it produced.
   */
  record(context: ServerGameContext, events: GameEvent[]): void {
    const time = context.getGameTime();

    for (const event of events) {
      this.events.push({ ...event, time });
      this.recordEvent(event, time);
    }

    const present = new Set<string>();
    for (const entity of context.getAllEntities()) {
      present.add(entity.id);
      this.trackEntity(entity, time);
    }
    this.trackRemovals(present, time);
    this.flushMinionSpawns(time);

    if (time + 1e-9 >= this.nextSampleTime) {
      this.frames.push(this.capture(context));
      this.nextSampleTime = time + this.sampleInterval;
    }
  }

  /**
   * Capture the current state as a frame.
   */
  capture(context: ServerGameContext): SimFrame {
    return {
      time: Math.round(context.getGameTime() * 1000) / 1000,
      tick: context.getTick(),
      entities: context.getAllEntities().map(toSimEntity),
    };
  }

  /**
   * Add a free-form note to the log (scenarios use this to mark steps).
   */
  note(time: number, text: string): void {
    this.log.push({ time, kind: 'note', text });
  }

  /**
   * Human-readable name for an entity ID, e.g. "red lume (bot-1)" or "blue caster e42".
   */
  describe(id: string | undefined): string {
    if (!id) return 'unknown';
    return this.names.get(id) ?? id;
  }

  /**
   * The log as plain text lines.
   */
  formatLog(kinds?: SimLogKind[]): string {
    return this.log
      .filter(entry => !kinds || kinds.includes(entry.kind))
      .map(entry => `[${entry.time.toFixed(1).padStart(6)}s] ${entry.kind.padEnd(7)} ${entry.text}`)
      .join('\n');
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  private recordEvent(event: GameEvent, time: number): void {
    const data = event.data;
    switch (event.type) {
      case GameEventType.DAMAGE: {
        const targetId = data.entityId as string;
        const sourceId = data.sourceId as string | undefined;
        const amount = data.amount as number;
        if (sourceId) this.lastDamager.set(targetId, sourceId);

        const source = this.describeSource(sourceId);
        const targetKind = this.kinds.get(targetId) ?? 'minion';
        let byKind = this.damage.get(source);
        if (!byKind) {
          byKind = new Map();
          this.damage.set(source, byKind);
        }
        byKind.set(targetKind, (byKind.get(targetKind) ?? 0) + amount);
        break;
      }
      case GameEventType.ABILITY_CAST: {
        const casterId = data.entityId as string;
        const target = data.targetEntityId
          ? ` on ${this.describe(data.targetEntityId as string)}`
          : data.targetX != null ? ` at (${Math.round(data.targetX as number)}, ${Math.round(data.targetY as number)})` : '';
        this.log.push({
          time, kind: 'cast', entityId: casterId,
          text: `${this.describe(casterId)} cast ${data.slot ?? ''} ${data.abilityId ?? ''}${target}`.replace(/\s+/g, ' '),
          data,
        });
        break;
      }
      case GameEventType.SUMMONER_CAST: {
        const casterId = data.entityId as string;
        const target = data.targetId ? ` on ${this.describe(data.targetId as string)}` : '';
        this.log.push({ time, kind: 'cast', entityId: casterId, text: `${this.describe(casterId)} cast summoner ${data.spellId}${target}`, data });
        break;
      }
    }
  }

  private trackEntity(entity: ServerEntity, time: number): void {
    const id = entity.id;
    const isNew = !this.names.has(id);
    if (isNew) {
      const kind = KIND_BY_TYPE[entity.entityType];
      this.kinds.set(id, kind);
      this.names.set(id, this.nameFor(entity, kind));
      this.alive.set(id, !entity.isDead);

      if (kind === 'minion') {
        this.pendingMinionSpawns++;
      } else if (kind === 'champion' || kind === 'jungle') {
        this.log.push({ time, kind: 'spawn', entityId: id, text: `${this.names.get(id)} spawned at (${Math.round(entity.position.x)}, ${Math.round(entity.position.y)})` });
      }
    }

    const wasAlive = this.alive.get(id) ?? true;
    if (wasAlive && entity.isDead) {
      const killerId = this.lastDamager.get(id);
      const kind = this.kinds.get(id)!;
      if (kind !== 'projectile' && kind !== 'zone' && kind !== 'orb') {
        this.log.push({
          time, kind: 'death', entityId: id,
          text: `${this.describe(id)} died at (${Math.round(entity.position.x)}, ${Math.round(entity.position.y)})${killerId ? ` - killed by ${this.describeSource(killerId)}` : ''}`,
          data: { killerId },
        });
      }
    } else if (!wasAlive && !entity.isDead && entity.entityType === EntityType.CHAMPION) {
      this.log.push({ time, kind: 'respawn', entityId: id, text: `${this.describe(id)} respawned` });
    } else if (!wasAlive && !entity.isDead && entity.entityType === EntityType.INHIBITOR) {
      this.log.push({ time, kind: 'respawn', entityId: id, text: `${this.describe(id)} rebuilt` });
    }
    this.alive.set(id, !entity.isDead);

    if (entity.entityType === EntityType.CHAMPION) {
      const champion = entity as ServerChampion;
      const previousLevel = this.levels.get(id);
      if (previousLevel !== undefined && champion.level > previousLevel) {
        this.log.push({ time, kind: 'level', entityId: id, text: `${this.describe(id)} reached level ${champion.level}` });
      }
      this.levels.set(id, champion.level);

      const wasRecalling = this.recalling.get(id) ?? false;
      if (!wasRecalling && champion.isRecalling) {
        this.log.push({ time, kind: 'recall', entityId: id, text: `${this.describe(id)} started recalling` });
      } else if (wasRecalling && !champion.isRecalling) {
        this.log.push({ time, kind: 'recall', entityId: id, text: `${this.describe(id)} stopped recalling at (${Math.round(champion.position.x)}, ${Math.round(champion.position.y)})` });
      }
      this.recalling.set(id, champion.isRecalling);
    }
  }

  /**
   * Minions and jungle creatures are removed in the tick they die, so a unit
   * that was alive and is now gone died this tick.
   */
  private trackRemovals(present: Set<string>, time: number): void {
    for (const [id, wasAlive] of this.alive) {
      if (present.has(id)) continue;
      const kind = this.kinds.get(id);
      if (wasAlive && (kind === 'minion' || kind === 'jungle' || kind === 'champion' || kind === 'tower' || kind === 'ward')) {
        const killerId = this.lastDamager.get(id);
        this.log.push({
          time, kind: 'death', entityId: id,
          text: `${this.describe(id)} died${killerId ? ` - killed by ${this.describeSource(killerId)}` : ''}`,
          data: { killerId },
        });
      }
      this.alive.delete(id);
      this.lastDamager.delete(id);
    }
  }

  private flushMinionSpawns(time: number): void {
    if (this.pendingMinionSpawns > 0) {
      this.log.push({ time, kind: 'spawn', text: `${this.pendingMinionSpawns} minions spawned` });
      this.pendingMinionSpawns = 0;
    }
  }

  private nameFor(entity: ServerEntity, kind: SimEntityKind): string {
    const side = SIDE_NAMES[entity.side] ?? `side${entity.side}`;
    const sim = toSimEntity(entity);
    switch (kind) {
      case 'champion':
        return `${side} ${sim.label} (${sim.playerId})`;
      case 'minion':
        return `${side} ${sim.label} minion ${entity.id}`;
      case 'jungle':
        return `${sim.label} ${entity.id}`;
      case 'tower':
        return `${side} tower ${entity.id} at (${sim.x}, ${sim.y})`;
      case 'inhibitor':
        return `${side} ${(entity as ServerEntity & { lane: string }).lane} inhibitor ${entity.id}`;
      default:
        return `${side} ${sim.label} ${entity.id}`;
    }
  }

  /**
   * Attribute damage from projectiles/zones to whoever owns them, when known.
   */
  private describeSource(sourceId: string | undefined): string {
    if (!sourceId) return 'unknown';
    return this.describe(sourceId);
  }
}
