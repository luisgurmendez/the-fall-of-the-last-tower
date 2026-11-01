/**
 * Duels: every champion against every other, one on one, played by the
 * same plain DuelBot, to see which kits win too much or too little.
 *
 *   bun run duels                 # levels 6 and 11, every pair, both sides
 *   bun run duels --levels 3,9    # other levels
 *   bun run duels --only elora    # only duels with these champions
 *
 * Each duel starts 300 apart in an empty arena (no minions, towers or
 * monsters), with no items and the usual ranks for the level, and lasts
 * until one dies or a minute passes (a draw, scored by health left). It
 * prints each champion's wins, and the duels it lost most clearly or won
 * against the most. Bots don't dodge or kite, so a skillshot kit and a
 * kiter are a little worse here than in a player's hands.
 */

import { CHAMPION_DEFINITIONS, type AbilitySlot } from '@siege/shared';
import { Simulation } from './Simulation';
import { DuelBot } from './DuelBot';

/** Ranks by level: the ultimate at 6, 11 and 16, Q first, then W, then E */
function ranksAt(level: number): Record<AbilitySlot, number> {
  const R = level >= 16 ? 3 : level >= 11 ? 2 : level >= 6 ? 1 : 0;
  let points = level - R;
  const ranks = { Q: 0, W: 0, E: 0, R };
  // One in each early, then maxing Q, then W, then E
  for (const slot of ['Q', 'W', 'E'] as const) {
    if (points > 0) { ranks[slot] = 1; points--; }
  }
  for (const slot of ['Q', 'W', 'E'] as const) {
    const more = Math.min(points, 5 - ranks[slot]);
    ranks[slot] += more;
    points -= more;
  }
  return ranks;
}

interface DuelResult {
  winner: string | null;
  /** Health share the winner had left (or each side's, in a draw) */
  blueHealth: number;
  redHealth: number;
  seconds: number;
}

function duel(blueId: string, redId: string, level: number): DuelResult {
  const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
  try {
    const ranks = ranksAt(level);
    sim.addChampion({ playerId: 'blue', championId: blueId, side: 'blue', at: { x: -150, y: 0 }, level, ranks, bot: new DuelBot('blue', 'red') });
    sim.addChampion({ playerId: 'red', championId: redId, side: 'red', at: { x: 150, y: 0 }, level, ranks, bot: new DuelBot('red', 'blue') });
    const blue = sim.champion('blue');
    const red = sim.champion('red');
    sim.runUntil(() => blue.isDead || red.isDead || blue.deaths > 0 || red.deaths > 0, 60);
    const blueDead = blue.isDead || blue.deaths > 0;
    const redDead = red.isDead || red.deaths > 0;
    return {
      winner: blueDead === redDead ? null : blueDead ? redId : blueId,
      blueHealth: blueDead ? 0 : blue.health / blue.maxHealth,
      redHealth: redDead ? 0 : red.health / red.maxHealth,
      seconds: sim.time,
    };
  } finally {
    sim.dispose();
  }
}

function parseArgs(): { levels: number[]; only: string[] | null } {
  const argv = process.argv.slice(2);
  let levels = [6, 11];
  let only: string[] | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--levels') levels = argv[++i].split(',').map(Number);
    else if (argv[i] === '--only') only = argv[++i].split(',');
  }
  return { levels, only };
}

const { levels, only } = parseArgs();
const champions = Object.keys(CHAMPION_DEFINITIONS);

for (const level of levels) {
  const score = new Map<string, { wins: number; games: number; margin: number }>();
  const notes = new Set<string>();
  /** Wins of the row champion over the column one, out of the two sides */
  const pairWins = new Map<string, number>();
  for (const a of champions) score.set(a, { wins: 0, games: 0, margin: 0 });
  for (const a of champions) {
    for (const b of champions) {
      if (a === b || (only && !only.includes(a) && !only.includes(b))) continue;
      const result = duel(a, b, level);
      // a is blue, b is red; each ordered pair plays once, so both sides get played
      const aScore = score.get(a)!;
      const bScore = score.get(b)!;
      aScore.games++;
      bScore.games++;
      const margin = result.blueHealth - result.redHealth;
      const aWins = result.winner === a ? 1 : result.winner === b ? 0 : 0.5;
      aScore.wins += aWins;
      bScore.wins += 1 - aWins;
      pairWins.set(`${a}>${b}`, (pairWins.get(`${a}>${b}`) ?? 0) + aWins);
      pairWins.set(`${b}>${a}`, (pairWins.get(`${b}>${a}`) ?? 0) + 1 - aWins);
      aScore.margin += margin;
      bScore.margin -= margin;
      if (result.winner && Math.abs(margin) > 0.6) {
        notes.add(`${result.winner} crushes ${result.winner === a ? b : a} (${Math.round(Math.abs(margin) * 100)}% health left, ${result.seconds.toFixed(1)}s)`);
      }
    }
  }

  const rows = [...score.entries()]
    .filter(([, s]) => s.games > 0)
    .sort((x, y) => y[1].wins / y[1].games - x[1].wins / x[1].games);
  console.log(`\nLevel ${level} (ranks ${JSON.stringify(ranksAt(level))})`);
  console.log('champion     win%   avg health margin');
  for (const [id, s] of rows) {
    console.log(`${id.padEnd(12)} ${String(Math.round((s.wins / s.games) * 100)).padStart(4)}%   ${(s.margin / s.games >= 0 ? '+' : '') + Math.round((s.margin / s.games) * 100)}%`);
  }
  // Each row against each column, both sides: W won both, L lost both, - one each (½ a draw)
  const ids = rows.map(([id]) => id);
  console.log(`\n${''.padEnd(12)} ${ids.map(id => id.slice(0, 3)).join(' ')}`);
  for (const a of ids) {
    const cells = ids.map(b => {
      if (a === b) return ' · ';
      const wins = pairWins.get(`${a}>${b}`);
      if (wins === undefined) return '   ';
      return wins >= 2 ? ' W ' : wins <= 0 ? ' L ' : wins === 1 ? ' - ' : ' ½ ';
    });
    console.log(`${a.padEnd(12)} ${cells.join(' ')}`);
  }
  if (notes.size > 0) {
    console.log('\nClear wins:');
    for (const note of notes) console.log(`  ${note}`);
  }
}
