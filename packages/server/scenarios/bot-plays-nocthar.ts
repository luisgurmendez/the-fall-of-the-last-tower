/**
 * A LaneBot playing Nocthar fights with his army: the Hollows that rise
 * from the minions dying around the fight, ordered at its target, and the
 * colossus once it has Hollows to make it of.
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';

export default defineScenario({
  name: 'bot-plays-nocthar',
  description: 'Nocthar (LaneBot, level 9) fights a weaker Kael among red minions',
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 22,
  setup(sim) {
    // (ranked as the bot ranks him: E learned early)
    sim.addChampion({ playerId: 'bot', championId: 'nocthar', side: 'blue', at: { x: 0, y: 0 }, bot: 'lane', level: 9, ranks: { Q: 4, W: 2, E: 2, R: 1 } });
    const enemy = sim.addChampion({ playerId: 'enemy', championId: 'warrior', side: 'red', at: { x: 180, y: -180 }, level: 7 });
    enemy.health = enemy.maxHealth * 0.8;
    for (let i = 0; i < 4; i++) {
      const minion = sim.addMinion({ side: 'red', lane: 'mid', at: { x: 60 + i * 20, y: -40 - i * 20 } });
      minion.health = 30;
    }
  },
  steps: [{ at: 0.2, note: 'Kael goes for the bot', run: sim => { sim.attack('enemy', sim.champion('bot').id); } }],
  view: { center: { x: 90, y: -90 }, size: 700 },
  check(sim, _report, expect) {
    const bot = sim.champion('bot');
    const casts = sim.recorder.events.filter(e => e.type === GameEventType.ABILITY_CAST && e.data.entityId === bot.id);
    const used = new Set(casts.map(e => e.data.abilityId as string));
    const rose = sim.recorder.events.some(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === 'nocthar_hollow_rise');
    expect(rose, 'a Hollow should rise from the minions dying around the fight');
    expect(used.has('nocthar_q'), `the bot should use Grasping Hands (used ${[...used].join(', ') || 'none'})`);
    expect(used.has('nocthar_e'), `the bot should send its Hollows (used ${[...used].join(', ') || 'none'})`);
    expect(sim.champion('enemy').isDead, 'Nocthar should win this fight');
  },
});
