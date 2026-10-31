/**
 * Inhibitors in lane order. A red champion attacks blue's mid inhibitor: it
 * takes no damage while blue's mid towers stand, and blue's nexus takes none
 * while every blue inhibitor stands. Once the towers fall the champion hits
 * it and destroys it, which opens blue's nexus, and red's next mid wave
 * brings a super minion in front instead of its siege minion (red's top
 * wave, whose lane's inhibitor stands, keeps its siege minion). The
 * inhibitor rebuilds RESPAWN_TIME seconds later and the nexus is protected
 * again.
 */
import { defineScenario } from '../src/sim';
import { EntityType, GameEventType, MOBAConfig, Vector, type LaneId, type Side } from '@siege/shared';
import type { Simulation } from '../src/sim';
import type { ServerInhibitor } from '../src/simulation/ServerInhibitor';
import type { ServerMinion } from '../src/simulation/ServerMinion';
import type { ServerTower } from '../src/simulation/ServerTower';
import type { ServerEntity } from '../src/simulation/ServerEntity';

const { respawnTime, goldReward } = MOBAConfig.INHIBITORS.STATS;
const INHIBITOR = MOBAConfig.INHIBITORS.POSITIONS.find(p => p.side === 0 && p.lane === 'mid')!.position;
/** When the towers fall and when the inhibitor is finished off */
const TOWERS_FALL_AT = 5;
const DESTROY_AT = 12;

type Protectable = ServerEntity & { isProtected: boolean };

let nexusOpenedEarly = false;
let inhibitorHealthBeforeTowersFell = 0;
let inhibitorHitByChampion = false;
let killGold = 0;
let destroyedAt = -1;
let nexusOpenAfterDestroy = false;
let midWave: string[] = [];
let midWaveFront = '';
let topWave: string[] = [];

function inhibitor(sim: Simulation): ServerInhibitor {
  return sim.context.getAllEntities().find(e =>
    e.entityType === EntityType.INHIBITOR && e.side === 0 && (e as ServerInhibitor).lane === 'mid'
  ) as ServerInhibitor;
}

function blueNexus(sim: Simulation): Protectable {
  return sim.context.getAllEntities().find(e => e.entityType === EntityType.NEXUS && e.side === 0) as Protectable;
}

function minions(sim: Simulation, side: Side, lane: LaneId): ServerMinion[] {
  return sim.context.getAllEntities().filter(e =>
    e.entityType === EntityType.MINION && e.side === side && (e as ServerMinion).lane === lane
  ) as ServerMinion[];
}

export default defineScenario({
  name: 'inhibitor-super-minions',
  description: 'Blue mid inhibitor: protected by its towers, opens the nexus and brings red super minions when destroyed, then rebuilds',
  options: { minionWaves: false, jungle: false },
  duration: DESTROY_AT + respawnTime + 3,
  setup(sim) {
    nexusOpenedEarly = false;
    inhibitorHealthBeforeTowersFell = 0;
    inhibitorHitByChampion = false;
    killGold = 0;
    destroyedAt = -1;
    nexusOpenAfterDestroy = false;
    midWave = [];
    midWaveFront = '';
    topWave = [];

    sim.addChampion({ playerId: 'red', championId: 'warrior', side: 'red', at: { x: INHIBITOR.x + 200, y: INHIBITOR.y - 200 }, level: 6 });
    sim.onTick(s => {
      if (destroyedAt < 0 && !blueNexus(s).isProtected && s.context.getTick() > 1) nexusOpenedEarly = true;
    });
  },
  steps: [
    { at: 0.5, note: 'red attacks blue\'s mid inhibitor while blue\'s mid towers stand', run: sim => sim.attack('red', inhibitor(sim).id) },
    {
      at: TOWERS_FALL_AT,
      note: 'blue\'s mid towers fall',
      run: sim => {
        inhibitorHealthBeforeTowersFell = inhibitor(sim).health;
        const towers = sim.context.getAllEntities()
          .filter(e => e.entityType === EntityType.TOWER && e.side === 0 && (e as ServerTower).lane === 'mid')
          .sort((a, b) => (a as ServerTower).tier - (b as ServerTower).tier);
        for (const tower of towers) tower.takeDamage(tower.health + 1, 'true', undefined, sim.context);
      },
    },
    {
      at: DESTROY_AT,
      note: 'red finishes off the inhibitor',
      run: sim => {
        const target = inhibitor(sim);
        inhibitorHitByChampion = target.health < target.maxHealth;
        const red = sim.champion('red');
        const gold = red.gold;
        target.takeDamage(target.health + 1, 'true', red.id, sim.context);
        killGold = red.gold - gold;
        destroyedAt = sim.time;
      },
    },
    {
      at: DESTROY_AT + 0.5,
      note: 'red\'s next mid and top waves spawn (siege waves)',
      run: sim => {
        nexusOpenAfterDestroy = !blueNexus(sim).isProtected;
        sim.context.spawnLaneWave(1, 'mid', { siege: true });
        sim.context.spawnLaneWave(1, 'top', { siege: true });
        const wave = minions(sim, 1, 'mid');
        midWave = wave.map(m => m.minionType);
        const red = new Vector(MOBAConfig.NEXUS.RED.x, MOBAConfig.NEXUS.RED.y);
        midWaveFront = wave.reduce((a, b) => (a.position.distanceTo(red) >= b.position.distanceTo(red) ? a : b)).minionType;
        topWave = minions(sim, 1, 'top').map(m => m.minionType);
        sim.move('red', INHIBITOR.x + 300, INHIBITOR.y - 300);
      },
    },
    {
      // They would take blue's open nexus before the inhibitor is back
      at: DESTROY_AT + 15,
      note: 'the red waves are cleared',
      run: sim => {
        for (const minion of [...minions(sim, 1, 'mid'), ...minions(sim, 1, 'top')]) minion.markForRemoval();
      },
    },
  ],
  view: { center: { x: -1600, y: 1600 }, size: 1500 },
  frames: 8,
  check(sim, _report, expect) {
    const target = inhibitor(sim);
    const destroyed = sim.recorder.events.filter(e => e.type === GameEventType.INHIBITOR_DESTROYED);
    const respawned = sim.recorder.events.filter(e => e.type === GameEventType.INHIBITOR_RESPAWNED);

    expect(!nexusOpenedEarly, 'blue\'s nexus should be protected while all its inhibitors stand (even with mid\'s towers down)');
    expect(inhibitorHealthBeforeTowersFell === target.maxHealth,
      `the inhibitor should take no damage while its lane's towers stand (health ${Math.round(inhibitorHealthBeforeTowersFell)})`);
    expect(inhibitorHitByChampion, 'the red champion should damage the inhibitor once the towers are down');
    expect(killGold === goldReward, `destroying it should give ${goldReward} gold (gave ${killGold})`);
    expect(destroyed.length === 1 && destroyed[0].data.respawnAt === destroyedAt + respawnTime,
      `INHIBITOR_DESTROYED should be sent once, with when it rebuilds (${JSON.stringify(destroyed.map(e => e.data))})`);
    expect(nexusOpenAfterDestroy, 'blue\'s nexus should be vulnerable once the inhibitor is down');

    expect(midWave.filter(type => type === 'super').length === 1 && !midWave.includes('siege'),
      `red's mid wave should bring a super minion instead of its siege minion (${midWave.join(', ')})`);
    expect(midWaveFront === 'super', `the super minion should walk in front (front: ${midWaveFront})`);
    expect(topWave.includes('siege') && !topWave.includes('super'), `red's top wave should be unchanged (${topWave.join(', ')})`);

    expect(!target.isDead && target.health === target.maxHealth, 'the inhibitor should have rebuilt at full health');
    expect(respawned.length === 1 && Math.abs(respawned[0].time - (destroyedAt + respawnTime)) < 0.1,
      `it should rebuild ${respawnTime}s after it fell (at ${respawned.map(e => e.time.toFixed(1)).join(', ')})`);
    expect(blueNexus(sim).isProtected, 'blue\'s nexus should be protected again');
    expect(sim.context.getSuperMinionCount(1, 'mid') === 0, 'red\'s mid waves should stop bringing super minions');
  },
});
