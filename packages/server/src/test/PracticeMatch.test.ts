import { describe, it, expect } from 'bun:test';
import { buildPracticeMatch } from '../bots/practiceMatch';
import { JungleBot } from '../bots/JungleBot';

const CHAMPIONS = ['vex', 'lume', 'vile', 'warrior', 'magnus', 'elara', 'gorath'];

function build(teamSize: 1 | 3 | 5) {
  return buildPracticeMatch({ playerId: 'p', championId: 'magnus', summonerSpells: ['blink', 'mend'], teamSize, champions: CHAMPIONS, botChampionId: 'vex' });
}

describe('practice matches', () => {
  it('1v1 is the player against a bot in mid playing the champion asked for', () => {
    const { players, bots } = build(1);
    expect(players.map(p => [p.playerId, p.side, p.championId])).toEqual([['p', 0, 'magnus'], ['bot-p', 1, 'vex']]);
    expect(bots.map(bot => bot.playerId)).toEqual(['bot-p']);
  });

  it('3v3 and 5v5 fill every other role on both sides with bots', () => {
    for (const size of [3, 5] as const) {
      const { players, bots } = build(size);
      expect(players.filter(p => p.side === 0)).toHaveLength(size);
      expect(players.filter(p => p.side === 1)).toHaveLength(size);
      expect(players.filter(p => p.isBot)).toHaveLength(size * 2 - 1);
      // Every bot has a controller, and ids are unique
      expect(new Set(players.map(p => p.playerId)).size).toBe(size * 2);
      expect(bots.map(bot => bot.playerId).sort()).toEqual(players.filter(p => p.isBot).map(p => p.playerId).sort());
    }
  });

  it('never repeats a champion on a team', () => {
    for (let seed = 0; seed < 20; seed++) {
      let n = seed;
      const random = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
      const { players } = buildPracticeMatch({ playerId: 'p', championId: 'magnus', summonerSpells: [], teamSize: 5, champions: CHAMPIONS, random });
      for (const side of [0, 1]) {
        const team = players.filter(p => p.side === side).map(p => p.championId);
        expect(new Set(team).size).toBe(team.length);
      }
    }
  });

  it('5v5 has a jungler with Reap on each side', () => {
    const { players, bots } = build(5);
    const junglers = players.filter(p => p.playerId.endsWith('-jungle'));
    expect(junglers).toHaveLength(2);
    expect(junglers.every(p => p.summonerSpells?.includes('reap'))).toBe(true);
    expect(bots.filter(bot => bot instanceof JungleBot)).toHaveLength(2);
  });
});
