/**
 * Generates champion ability icons with PixelLab: 64x64 pixel art on a
 * transparent background, in src/assets/abilities/<championId>/<slot>.png
 * (slot is passive, q, w, e or r; AbilityIconLoader reads them from there).
 *
 * Each champion has a color theme so its five icons look like a set; the
 * prompts describe what each icon shows. ICONS keeps the seed of the
 * version kept for each one.
 *
 * Usage (from the repo root; Bun loads PIXELLAB_API_KEY from .env.local):
 *   bun scripts/generate-ability-icons.ts --only magnus          # one champion
 *   bun scripts/generate-ability-icons.ts --only magnus --variants 2 --out /tmp/review
 *     # seeds to pick from, saved as <championId>.<slot>.<seed>.png
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generatePixenImage, runPool } from './lib/pixellab';

const STYLE = 'dark fantasy pixel art ability icon, a single centered glowing symbol';
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
      passive: { seed: 7, prompt: 'a cracked steel shield with a glowing blue heart behind it' },
      q: { seed: 7, prompt: 'a longsword making a wide glowing blue arc slash' },
      w: { seed: 8, prompt: 'a round steel shield glowing with pale blue light' },
      e: { seed: 8, prompt: 'a shield rushing forward with motion streaks' },
      r: { seed: 7, prompt: 'a longsword plunging down from above into a bright blue starburst' },
    },
  },
  magnus: {
    theme: 'fiery orange and crimson with a touch of arcane cyan',
    icons: {
      passive: { seed: 7, prompt: 'a swirling orb of fire and arcane energy' },
      q: { seed: 7, prompt: 'a large blazing fireball with a flame trail' },
      w: { seed: 8, prompt: 'a translucent cyan arcane dome shield covered in runes' },
      e: { seed: 8, prompt: 'a swirling brown mud pool with bubbles' },
      r: { seed: 7, prompt: 'a flaming meteor falling from the sky' },
    },
  },
  elara: {
    theme: 'radiant gold and white with soft cyan',
    icons: {
      passive: { seed: 8, prompt: 'a soft golden halo with small sparkles' },
      q: { seed: 7, prompt: 'an open glowing golden hand releasing healing light' },
      w: { seed: 7, prompt: 'a golden shield made of light with a bright gleam' },
      e: { seed: 7, prompt: 'a winged golden boot with streaks of light' },
      r: { seed: 7, prompt: 'a column of bright light descending between two white wings' },
    },
  },
  gorath: {
    theme: 'stone grey and glowing amber',
    icons: {
      passive: { seed: 7, prompt: 'a heavy stone boulder carved with glowing amber runes' },
      q: { seed: 7, prompt: 'a stone hammer smashing the ground with cracks and dust' },
      w: { seed: 7, prompt: 'a stone-plated armored fist with glowing amber runes' },
      e: { seed: 7, prompt: 'a roaring bearded warrior face with sound waves' },
      r: { seed: 8, prompt: 'cracked ground splitting apart with a glowing amber fissure' },
    },
  },
};

interface Options {
  only: string[] | null;
  variants: number;
  outDir: string | null;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { only: null, variants: 1, outDir: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') options.only = argv[++i].split(',');
    else if (argv[i] === '--variants') options.variants = Number(argv[++i]);
    else if (argv[i] === '--out') options.outDir = argv[++i];
  }
  return options;
}

async function main(): Promise<void> {
  const apiKey = process.env.PIXELLAB_API_KEY;
  if (!apiKey) throw new Error('Set PIXELLAB_API_KEY (for example in .env.local)');
  const options = parseArgs(process.argv.slice(2));
  const championIds = options.only ?? Object.keys(ICONS);

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
      const { png, usd } = await generatePixenImage(apiKey, { description: job.description, size: 64, seed: job.seed });
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
