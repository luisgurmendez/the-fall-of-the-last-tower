/**
 * Generates champion ability icons with PixelLab: 32x32 pixel art on a
 * transparent background (simple enough to read at the HUD's size), in
 * src/assets/abilities/<championId>/<slot>.png (slot is passive, q, w, e or
 * r; AbilityIconLoader reads them from there).
 *
 * Each champion has a color theme so its five icons look like a set; the
 * prompts describe what each icon shows. ICONS keeps the seed of the
 * version kept for each one.
 *
 * Usage (from the repo root; Bun loads PIXELLAB_API_KEY from .env.local):
 *   bun scripts/generate-ability-icons.ts --only magnus          # one champion
 *   bun scripts/generate-ability-icons.ts --only magnus --variants 3 --out /tmp/review
 *     # seeds to pick from, saved as <championId>.<slot>.<seed>.png
 *   bun scripts/generate-ability-icons.ts --install /tmp/review   # copy the ICONS seeds in
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generatePixenImage, runPool } from './lib/pixellab';

const SIZE = 32;
const STYLE = 'simple bold pixel art ability icon readable at small size: one big centered symbol, thick dark outline, few colors';
const SLOTS = ['passive', 'q', 'w', 'e', 'r'] as const;
type Slot = typeof SLOTS[number];

interface ChampionIcons {
  /** Colors shared by the champion's icons */
  theme: string;
  icons: Record<Slot, { prompt: string; seed: number }>;
}

export const ICONS: Record<string, ChampionIcons> = {
  warrior: {
    theme: 'steel silver and bright blue',
    icons: {
      passive: { seed: 8, prompt: 'a cracked steel shield with a glowing blue heart behind it' },
      q: { seed: 8, prompt: 'a longsword making a wide glowing blue arc slash' },
      w: { seed: 10, prompt: 'a round steel shield glowing with pale blue light' },
      e: { seed: 8, prompt: 'a shield rushing forward with motion streaks' },
      r: { seed: 8, prompt: 'a longsword plunging down from above into a bright blue starburst' },
    },
  },
  magnus: {
    theme: 'fiery orange and crimson with a touch of arcane cyan',
    icons: {
      passive: { seed: 7, prompt: 'a swirling orb of fire and arcane energy' },
      q: { seed: 8, prompt: 'a large blazing fireball with a flame trail' },
      w: { seed: 8, prompt: 'a translucent cyan arcane dome shield covered in runes' },
      e: { seed: 8, prompt: 'a swirling brown mud pool with bubbles' },
      r: { seed: 7, prompt: 'a flaming meteor falling from the sky' },
    },
  },
  elara: {
    theme: 'radiant gold and white with soft cyan',
    icons: {
      passive: { seed: 10, prompt: 'a soft golden halo with small sparkles' },
      q: { seed: 8, prompt: 'an open glowing golden hand releasing healing light' },
      w: { seed: 9, prompt: 'a golden shield made of light with a bright gleam' },
      e: { seed: 9, prompt: 'a winged golden boot with streaks of light' },
      r: { seed: 7, prompt: 'a column of bright light descending between two white wings' },
    },
  },
  lume: {
    theme: 'warm gold and soft white light',
    icons: {
      passive: { seed: 20, prompt: 'a plain round glowing golden sphere of light, nothing else' },
      q: { seed: 23, prompt: 'a glowing golden sphere of light flying to the right, leaving a flame-like light trail behind it' },
      w: { seed: 7, prompt: 'a warm golden ring of runes radiating heat' },
      e: { seed: 8, prompt: 'a straight rainbow prism beam of light joining two glowing points' },
      r: { seed: 8, prompt: 'an eclipse: a dark sun ringed by blazing light firing a huge beam' },
    },
  },
  vex: {
    theme: 'deep violet, black and pale lilac',
    icons: {
      passive: { seed: 9, prompt: 'a pale lilac crescent moon' },
      q: { seed: 7, prompt: 'a dark violet ninja shuriken' },
      w: { seed: 8, prompt: 'a hooded figure dissolving into violet smoke' },
      e: { seed: 8, prompt: 'a violet streak of a fast slash' },
      r: { seed: 7, prompt: 'a glowing violet crosshair mark' },
    },
  },
  oitboil: {
    theme: 'fiery orange, red and soot black, with cool blue for blue fire',
    icons: {
      passive: { seed: 9, prompt: 'a heat gauge with its needle in the red, flames behind it' },
      q: { seed: 7, prompt: 'a burst of orange sparks flying out in every direction' },
      w: { seed: 7, prompt: 'a cool blue flame shaped like a heart' },
      e: { seed: 9, prompt: 'a rocket jet of flame blasting backward leaving a trail of fire' },
      r: { seed: 7, prompt: 'a flamethrower nozzle pouring a wide roaring stream of fire' },
    },
  },
  uruk: {
    theme: 'silver, steel grey and icy blue',
    icons: {
      passive: { seed: 8, prompt: 'a silver dragon eye with a slit amber pupil' },
      q: { seed: 9, prompt: 'a silver spear thrusting forward with a streak of light' },
      w: { seed: 8, prompt: 'a spear tip glowing icy white' },
      e: { seed: 8, prompt: 'overlapping silver dragon scales with frost' },
      r: { seed: 7, prompt: 'a spear plunging down cracking the ground in ice' },
    },
  },
  vile: {
    theme: 'dark purple, black and sickly green',
    icons: {
      passive: { seed: 7, prompt: 'a swirling green vortex of souls' },
      q: { seed: 9, prompt: 'a black arrow trailing purple smoke' },
      w: { seed: 8, prompt: 'a dark hooded veil of shadow' },
      e: { seed: 7, prompt: 'twisted black roots erupting from the ground with purple sparks' },
      r: { seed: 9, prompt: 'a horned shadow demon wreathed in purple flames' },
    },
  },
  gorath: {
    theme: 'stone grey and glowing amber',
    icons: {
      passive: { seed: 7, prompt: 'a heavy stone boulder carved with glowing amber runes' },
      q: { seed: 8, prompt: 'a stone hammer smashing the ground with cracks and dust' },
      w: { seed: 9, prompt: 'a stone-plated armored fist with glowing amber runes' },
      e: { seed: 9, prompt: 'a roaring bearded warrior face with sound waves' },
      r: { seed: 9, prompt: 'cracked ground splitting apart with a glowing amber fissure' },
    },
  },
};

interface Options {
  only: string[] | null;
  variants: number;
  outDir: string | null;
  installFrom: string | null;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { only: null, variants: 1, outDir: null, installFrom: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') options.only = argv[++i].split(',');
    else if (argv[i] === '--variants') options.variants = Number(argv[++i]);
    else if (argv[i] === '--out') options.outDir = argv[++i];
    else if (argv[i] === '--install') options.installFrom = argv[++i];
  }
  return options;
}

/** Copy the take with each icon's seed from a --out directory into src/assets/abilities */
function install(fromDir: string, championIds: string[]): void {
  for (const championId of championIds) {
    for (const slot of SLOTS) {
      const from = join(fromDir, `${championId}.${slot}.${ICONS[championId].icons[slot].seed}.png`);
      if (!existsSync(from)) throw new Error(`missing ${from}`);
      const dir = join('src/assets/abilities', championId);
      mkdirSync(dir, { recursive: true });
      copyFileSync(from, join(dir, `${slot}.png`));
    }
    console.log(`installed ${championId}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const championIds = options.only ?? Object.keys(ICONS);
  if (options.installFrom) {
    install(options.installFrom, championIds);
    return;
  }
  const apiKey = process.env.PIXELLAB_API_KEY;
  if (!apiKey) throw new Error('Set PIXELLAB_API_KEY (for example in .env.local)');

  const jobs = championIds.flatMap(championId => {
    const champion = ICONS[championId];
    if (!champion) throw new Error(`No icons for champion "${championId}"`);
    return SLOTS.flatMap(slot => Array.from({ length: options.variants }, (_, i) => ({
      championId,
      slot,
      description: `${STYLE}, ${champion.theme} colors: ${champion.icons[slot].prompt}`,
      seed: champion.icons[slot].seed + i,
    })));
  });

  let spent = 0;
  await runPool(jobs, async job => {
    try {
      const { png, usd } = await generatePixenImage(apiKey, { description: job.description, size: SIZE, seed: job.seed });
      const dir = options.outDir ?? join('src/assets/abilities', job.championId);
      const name = options.outDir ? `${job.championId}.${job.slot}.${job.seed}.png` : `${job.slot}.png`;
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, name), png);
      spent += usd;
      console.log(`ok   ${job.championId} ${job.slot} (seed ${job.seed})`);
    } catch (error) {
      console.error(`fail ${job.championId} ${job.slot}: ${(error as Error).message}`);
    }
  });
  console.log(`${jobs.length} images, $${spent.toFixed(3)}`);
}

await main();
