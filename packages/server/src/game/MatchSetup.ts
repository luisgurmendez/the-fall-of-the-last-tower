/**
 * MatchSetup - Spawns the entities every match starts with.
 *
 * Shared by GameRoom (real matches) and Simulation (headless scenarios) so
 * both start from the same world.
 */

import { Vector, type ChampionDefinition, type Side } from '@siege/shared';
import type { ServerGameContext } from './ServerGameContext';
import type { ServerEntity } from '../simulation/ServerEntity';
import { ServerChampion } from '../simulation/ServerChampion';
import { ServerTower } from '../simulation/ServerTower';
import { ServerNexus } from '../simulation/ServerNexus';
import { ServerInhibitor } from '../simulation/ServerInhibitor';
import { ServerLightOrb, LUME_ORB_CONFIG } from '../simulation/ServerLightOrb';
import { Logger } from '../utils/Logger';

/**
 * Spawn both nexuses and every tower and inhibitor from the map config.
 */
export function spawnStructures(context: ServerGameContext): void {
  const map = context.mapConfig;

  context.addEntity(new ServerNexus({
    id: context.generateEntityId(),
    position: new Vector(map.NEXUS.BLUE.x, map.NEXUS.BLUE.y),
    side: 0,
  }));
  context.addEntity(new ServerNexus({
    id: context.generateEntityId(),
    position: new Vector(map.NEXUS.RED.x, map.NEXUS.RED.y),
    side: 1,
  }));

  // Tier is based on order within a side and lane: first tower = outer (1), second = inner (2)
  const towersBySideLane = new Map<string, number>();
  for (const towerConfig of map.TOWERS.POSITIONS) {
    const key = `${towerConfig.side}_${towerConfig.lane}`;
    const count = towersBySideLane.get(key) || 0;
    towersBySideLane.set(key, count + 1);

    context.addEntity(new ServerTower({
      id: context.generateEntityId(),
      position: new Vector(towerConfig.position.x, towerConfig.position.y),
      side: towerConfig.side as Side,
      lane: towerConfig.lane,
      tier: (count + 1) as 1 | 2 | 3,
    }));
  }

  for (const inhibitorConfig of map.INHIBITORS.POSITIONS) {
    context.addEntity(new ServerInhibitor({
      id: context.generateEntityId(),
      position: new Vector(inhibitorConfig.position.x, inhibitorConfig.position.y),
      side: inhibitorConfig.side as Side,
      lane: inhibitorConfig.lane,
    }));
  }
  Logger.game.debug(`Spawned ${map.TOWERS.POSITIONS.length} towers, ${map.INHIBITORS.POSITIONS.length} inhibitors and 2 nexuses`);
}

export interface ChampionSpawn {
  playerId: string;
  side: Side;
  definition: ChampionDefinition;
  /** Defaults to the side's spawn point */
  position?: Vector;
}

/**
 * Spawn a champion (and anything that comes with it, like Lume's Light Orb).
 */
export function spawnChampion(context: ServerGameContext, spawn: ChampionSpawn): ServerChampion {
  const map = context.mapConfig;
  const position = spawn.position ?? (spawn.side === 0 ? map.CHAMPION_SPAWN.BLUE : map.CHAMPION_SPAWN.RED);

  const champion = new ServerChampion({
    id: context.generateEntityId(),
    position: position.clone(),
    side: spawn.side,
    definition: spawn.definition,
    playerId: spawn.playerId,
  });
  context.addChampion(champion, spawn.playerId);
  Logger.champion.info(`Spawned ${spawn.definition.name} for player ${spawn.playerId}`);

  if (spawn.definition.id === 'lume') {
    const orb = new ServerLightOrb({
      id: context.generateEntityId(),
      position: champion.position.clone().add(new Vector(LUME_ORB_CONFIG.orbitRadius, 0)),
      side: champion.side,
      ownerId: champion.id,
    });
    // Type assertion needed due to ServerLightOrb inheritance issue
    context.addEntity(orb as unknown as ServerEntity);
  }

  return champion;
}
