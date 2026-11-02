/**
 * The Narrows, the one-lane duel map: two LaneBots fight it out in its only
 * lane with waves and towers running. Its picture is the map's overview.
 */
import { MAPS } from '@siege/shared';
import { defineScenario } from '../src/sim';

export default defineScenario({
  name: 'narrows-duel',
  description: 'The Narrows (1v1 map): Vex (blue bot) vs Vile (red bot) for two minutes',
  options: { map: MAPS.narrows },
  duration: 120,
  setup(sim) {
    sim.addChampion({ playerId: 'blue-bot', championId: 'vex', side: 'blue', bot: 'lane' });
    sim.addChampion({ playerId: 'red-bot', championId: 'vile', side: 'red', bot: 'lane' });
  },
  view: { center: { x: 0, y: 0 }, size: 4200 },
  frames: 8,
  check(sim, report, expect) {
    expect(report.towers.blue === 2 && report.towers.red === 2, 'each side should have 2 towers');
    expect(report.inhibitors.blue === 1 && report.inhibitors.red === 1, 'each side should have 1 inhibitor');
    expect((report.units['jungle creatures'] ?? 0) === 0, 'there is no jungle');
    const blue = report.champions.find(c => c.playerId === 'blue-bot')!;
    const red = report.champions.find(c => c.playerId === 'red-bot')!;
    expect(blue.cs + red.cs > 0, 'the bots should last-hit minions');
    expect(report.deaths.filter(d => d.text.includes('minion')).length > 0, 'waves should meet and fight');
  },
});
