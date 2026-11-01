/**
 * A whole practice 5v5 played by bots (the player's mid seat too): every
 * bot leaves base and plays its role, nobody gets stuck, and the lanes farm.
 * A smoke test for the bots, the map's paths and the jungle together.
 */
import { CHAMPION_DEFINITIONS, GameEventType, Vector } from '@siege/shared';
import { defineScenario } from '../src/sim';
import { buildPracticeMatch } from '../src/bots/practiceMatch';
import { LaneBot } from '../src/bots/LaneBot';

/** Seconds a bot may stand on the same spot (away from base) without hitting anything before it counts as stuck */
const STUCK_TIME = 45;

const lastMove = new Map<string, { at: Vector; since: number }>();
const stuck = new Set<string>();

export default defineScenario({
  name: 'bots-5v5',
  description: 'Ten bots play a practice 5v5 for four minutes',
  duration: 240,
  setup(sim) {
    lastMove.clear();
    stuck.clear();
    let n = 7;
    const random = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    const { players, bots } = buildPracticeMatch({
      playerId: 'p', championId: 'magnus', summonerSpells: ['blink', 'mend'], teamSize: 5,
      champions: Object.keys(CHAMPION_DEFINITIONS), random,
    });
    for (const player of players) {
      const bot = bots.find(b => b.playerId === player.playerId) ?? new LaneBot({ playerId: player.playerId, lane: 'mid' });
      sim.addChampion({ playerId: player.playerId, championId: player.championId, side: player.side === 0 ? 'blue' : 'red', bot, summoners: player.summonerSpells });
    }
    let seenEvents = 0;
    sim.onTick(s => {
      // Who dealt damage since the last tick
      const hitters = new Set<string>();
      for (const event of s.recorder.events.slice(seenEvents)) {
        if (event.type === GameEventType.DAMAGE) hitters.add(event.data.sourceId as string);
      }
      seenEvents = s.recorder.events.length;
      for (const champion of s.context.getAllChampions()) {
        const spawn = champion.side === 0 ? s.context.mapConfig.CHAMPION_SPAWN.BLUE : s.context.mapConfig.CHAMPION_SPAWN.RED;
        const seen = lastMove.get(champion.playerId);
        // Farming from one spot (a ranged champion) isn't being stuck
        const hitting = hitters.has(champion.id);
        if (!seen || hitting || seen.at.distanceTo(champion.position) > 40 || champion.isDead || champion.position.distanceTo(spawn) < 400) {
          lastMove.set(champion.playerId, { at: champion.position.clone(), since: s.time });
        } else if (s.time - seen.since > STUCK_TIME) {
          stuck.add(`${champion.playerId} at (${Math.round(champion.position.x)}, ${Math.round(champion.position.y)})`);
        }
      }
    });
  },
  view: { center: { x: 0, y: 0 }, size: 5400 },
  frames: 8,
  check(sim, report, expect) {
    const spawnOf = (side: number) => side === 0 ? sim.context.mapConfig.CHAMPION_SPAWN.BLUE : sim.context.mapConfig.CHAMPION_SPAWN.RED;
    const atBase = sim.context.getAllChampions().filter(c => !c.isDead && c.position.distanceTo(spawnOf(c.side)) < 400 && c.health / c.maxHealth > 0.9);
    expect(stuck.size === 0, `no bot should stand still for ${STUCK_TIME}s away from base (${[...stuck].join(', ')})`);
    expect(atBase.length <= 2, `bots should be out playing, not idle at base (${atBase.map(c => c.playerId).join(', ')})`);
    const cs = report.champions.reduce((sum, c) => sum + c.cs, 0);
    expect(cs >= 40, `the bots should farm (total cs ${cs})`);
    const junglers = report.champions.filter(c => c.playerId.endsWith('-jungle'));
    expect(junglers.every(c => c.cs >= 4), `the junglers should clear camps (cs ${junglers.map(c => c.cs).join(', ')})`);
  },
});
