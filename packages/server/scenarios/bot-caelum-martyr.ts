/**
 * A support bot playing Caelum, more hurt than its carry, gives its carry
 * Martyr (it can't be cast on himself) instead of trying it on himself
 * over and over (then, low, he backs off).
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';
import { SupportBot } from '../src/bots/SupportBot';

export default defineScenario({
  name: 'bot-caelum-martyr',
  description: 'Caelum (SupportBot, at 30% health) gives Martyr to his carry at 45%, not to himself',
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 8,
  setup(sim) {
    const carry = sim.addChampion({ playerId: 'carry', championId: 'elora', side: 'blue', at: { x: 1500, y: 2300 }, level: 6 });
    carry.health = carry.maxHealth * 0.45;
    const support = sim.addChampion({ playerId: 'support', championId: 'caelum', side: 'blue', at: { x: 1300, y: 2400 }, level: 6,
      ranks: { Q: 1, W: 0, E: 0, R: 1 }, bot: new SupportBot({ playerId: 'support', carryPlayerId: 'carry' }) });
    support.health = support.maxHealth * 0.3;
  },
  view: { center: { x: 1400, y: 2350 }, size: 700 },
  check(sim, report, expect) {
    const carry = sim.champion('carry');
    const support = sim.champion('support');
    const martyrs = sim.recorder.events.filter(e =>
      e.type === GameEventType.ABILITY_CAST && e.data.entityId === support.id && e.data.abilityId === 'caelum_r');
    expect(martyrs.length === 1 && martyrs[0].data.targetEntityId === carry.id, `Caelum should give Martyr to his carry (${martyrs.length} casts)`);
  },
});
