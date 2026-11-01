/**
 * Games: whole practice 5v5s played by bots, teams picked at random by role
 * (practiceMatch's picks, so every champion plays the roles it suits), to see
 * which champions carry their team and which drag it down. Duels
 * (src/sim/duels.ts) measure kits head to head; this measures them in the
 * game the bots actually play.
 *
 *   bun run games               # 30 games of 15 minutes
 *   bun run games --games 60 --minutes 20
 *
 * For each champion: games played, how often its team came out ahead (more
 * towers taken, then more kills), its average kills, deaths and damage to
 * champions. Bots play some kits better than others, so read big gaps, not
 * small ones.
 */

import { CHAMPION_DEFINITIONS, EntityType, GameEventType } from '@siege/shared';
import { Simulation } from './Simulation';
import { buildPracticeMatch } from '../bots/practiceMatch';
import { LaneBot } from '../bots/LaneBot';

function parseArgs(): { games: number; minutes: number } {
  const argv = process.argv.slice(2);
  let games = 30;
  let minutes = 15;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--games') games = Number(argv[++i]);
    else if (argv[i] === '--minutes') minutes = Number(argv[++i]);
  }
  return { games, minutes };
}

interface Line { games: number; ahead: number; kills: number; deaths: number; damage: number }

const { games, minutes } = parseArgs();
const champions = Object.keys(CHAMPION_DEFINITIONS);
const lines = new Map<string, Line>(champions.map(id => [id, { games: 0, ahead: 0, kills: 0, deaths: 0, damage: 0 }]));

for (let game = 0; game < games; game++) {
  let n = game * 7919 + 13;
  const random = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  const sim = new Simulation({ seed: game + 1 });
  try {
    const playerChampion = champions[Math.floor(random() * champions.length)];
    const { players, bots } = buildPracticeMatch({
      playerId: 'p', championId: playerChampion, summonerSpells: ['blink', 'mend'], teamSize: 5, champions, random,
    });
    for (const player of players) {
      const bot = bots.find(b => b.playerId === player.playerId) ?? new LaneBot({ playerId: player.playerId, lane: 'mid' });
      sim.addChampion({ playerId: player.playerId, championId: player.championId, side: player.side === 0 ? 'blue' : 'red', bot, summoners: player.summonerSpells });
    }
    sim.run(minutes * 60);

    const all = sim.context.getAllChampions();
    const damage = new Map<string, number>();
    const championIds = new Set(all.map(c => c.id));
    for (const event of sim.recorder.events) {
      if (event.type !== GameEventType.DAMAGE || !championIds.has(event.data.entityId as string)) continue;
      const source = event.data.sourceId as string;
      if (championIds.has(source)) damage.set(source, (damage.get(source) ?? 0) + (event.data.amount as number));
    }
    const towersLeft = (side: number) => sim.context.getAllEntities().filter(e => e.entityType === EntityType.TOWER && e.side === side && !e.isDead).length;
    const kills = (side: number) => all.filter(c => c.side === side).reduce((sum, c) => sum + c.kills, 0);
    // Ahead: took more towers, or as many and got more kills
    const blueScore = (towersLeft(0) - towersLeft(1)) * 1000 + kills(0) - kills(1);
    const aheadSide = blueScore > 0 ? 0 : blueScore < 0 ? 1 : -1;
    for (const champion of all) {
      const line = lines.get(champion.definition.id)!;
      line.games++;
      line.ahead += aheadSide === -1 ? 0.5 : aheadSide === champion.side ? 1 : 0;
      line.kills += champion.kills;
      line.deaths += champion.deaths;
      line.damage += damage.get(champion.id) ?? 0;
    }
    process.stderr.write(`game ${game + 1}/${games}: ${aheadSide === 0 ? 'blue' : aheadSide === 1 ? 'red' : 'even'} ahead (${kills(0)}-${kills(1)} kills, towers left ${towersLeft(0)}-${towersLeft(1)})\n`);
  } finally {
    sim.dispose();
  }
}

console.log(`\n${games} games of ${minutes} minutes`);
console.log('champion     games  ahead%  kills  deaths  damage to champions');
const rows = [...lines.entries()].filter(([, l]) => l.games > 0).sort((a, b) => b[1].ahead / b[1].games - a[1].ahead / a[1].games);
for (const [id, l] of rows) {
  console.log(`${id.padEnd(12)} ${String(l.games).padStart(5)}  ${String(Math.round((l.ahead / l.games) * 100)).padStart(5)}%  ${(l.kills / l.games).toFixed(1).padStart(5)}  ${(l.deaths / l.games).toFixed(1).padStart(6)}  ${String(Math.round(l.damage / l.games)).padStart(7)}`);
}
