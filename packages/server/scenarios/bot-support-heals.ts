/**
 * A support bot heals its hurt carry and stays with it instead of taking
 * the lane's minions.
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';
import { SupportBot } from '../src/bots/SupportBot';

export default defineScenario({
  name: 'bot-support-heals',
  description: 'Elara (SupportBot) heals Lume, her carry at 40% health, and keeps beside her',
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 8,
  setup(sim) {
    const carry = sim.addChampion({ playerId: 'carry', championId: 'lume', side: 'blue', at: { x: 1500, y: 2300 }, level: 3 });
    carry.health = carry.maxHealth * 0.4;
    sim.addChampion({ playerId: 'support', championId: 'elara', side: 'blue', at: { x: 1300, y: 2400 }, level: 3,
      bot: new SupportBot({ playerId: 'support', carryPlayerId: 'carry' }) });
  },
  steps: [
    { at: 3, note: 'the carry walks up the lane', run: sim => { sim.move('carry', 1900, 2300); } },
  ],
  view: { center: { x: 1550, y: 2350 }, size: 700 },
  check(sim, report, expect) {
    const carry = sim.champion('carry');
    const support = sim.champion('support');
    const heals = sim.recorder.events.filter(e =>
      e.type === GameEventType.ABILITY_CAST && e.data.entityId === support.id && e.data.targetEntityId === carry.id);
    expect(heals.length > 0, 'the support should heal or shield its carry');
    const gap = carry.position.distanceTo(support.position);
    expect(gap < 300, `the support should stay with its carry (${Math.round(gap)} apart)`);
  },
});
