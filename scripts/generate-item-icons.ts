/**
 * Generates the shop's item icons with PixelLab (https://api.pixellab.ai/v2).
 *
 * Each item gets a 32x32 pixel art icon with a transparent background, saved
 * as public/assets/items/<itemId>.png. The prompts describe what the icon shows,
 * not the item's name, so the art stays our own.
 *
 * Usage (from the repo root; Bun loads PIXELLAB_API_KEY from .env.local):
 *   bun scripts/generate-item-icons.ts                      # every item
 *   bun scripts/generate-item-icons.ts --only dagger,sheen  # some items
 *   bun scripts/generate-item-icons.ts --variants 3 --out /tmp/review
 *     # 3 seeds per item (from its kept seed up), saved as <itemId>.<seed>.png
 *     # to pick from; put the seed you keep in ITEM_ICONS
 *
 * Each image costs about $0.007 and takes about 30 seconds.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.pixellab.ai/v2';
const STYLE = 'fantasy RPG inventory item icon, centered, clean readable silhouette';
/** PixelLab answers 429 past a few jobs at once */
const CONCURRENCY = 3;
const MAX_ATTEMPTS = 5;

/** What each item's icon shows, and the seed of the version we kept */
export const ITEM_ICONS: Record<string, { prompt: string; seed: number }> = {
  notched_blade: { seed: 7, prompt: 'a short steel sword with a notched chipped blade and a leather-wrapped grip, diagonal' },
  ember_shard: { seed: 8, prompt: 'a glowing orange ember crystal shard with small sparks' },
  quickdraw_gloves: { seed: 7, prompt: 'a pair of brown leather archer gloves with metal studs' },
  padded_vest: { seed: 8, prompt: 'a simple quilted padded cloth vest, beige' },
  warding_charm: { seed: 8, prompt: 'a round silver amulet with a glowing blue protective rune' },
  heartstone: { seed: 7, prompt: 'a red heart-shaped gemstone glowing softly' },
  focus_rune: { seed: 8, prompt: 'a flat grey runestone with a glowing teal spiral rune' },
  wanderers_boots: { seed: 8, prompt: 'a pair of worn brown leather travel boots' },
  siege_cleaver: { seed: 8, prompt: 'a heavy broad steel cleaver blade with an iron-banded handle, diagonal' },
  cinder_rod: { seed: 8, prompt: 'a short charred wooden rod topped with a burning ember, diagonal' },
  repeater_crossbow: { seed: 8, prompt: 'a compact wooden crossbow with a bolt magazine on top, diagonal' },
  iron_plate: { seed: 8, prompt: 'an iron breastplate with rivets' },
  spellward_cloak: { seed: 8, prompt: 'an empty folded deep blue cloak with glowing silver runes on the hem, no person' },
  bulwark_belt: { seed: 7, prompt: 'a thick wide leather belt with iron plates and a big buckle' },
  crimson_fang: { seed: 8, prompt: 'a curved crimson sword shaped like a fang, dripping red, diagonal' },
  starfall_diadem: { seed: 7, prompt: 'a golden diadem crown set with a glowing star-shaped gem, sparkles' },
  spiked_bastion: { seed: 7, prompt: 'a heavy dark iron breastplate covered in sharp spikes' },
  ironheart_talisman: { seed: 8, prompt: 'an iron talisman pendant with a glowing red heart gem in the center' },
};

interface Options {
  only: string[] | null;
  variants: number;
  outDir: string;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { only: null, variants: 1, outDir: 'public/assets/items' };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    if (argv[i] === '--only') { options.only = value.split(','); i++; }
    else if (argv[i] === '--variants') { options.variants = Number(value); i++; }
    else if (argv[i] === '--out') { options.outDir = value; i++; }
  }
  return options;
}

async function generateIcon(apiKey: string, prompt: string, seed: number): Promise<{ png: Buffer; usd: number }> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await requestIcon(apiKey, prompt, seed);
    } catch (error) {
      const busy = (error as Error).message.startsWith('HTTP 429');
      if (!busy || attempt >= MAX_ATTEMPTS) throw error;
      await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
    }
  }
}

async function requestIcon(apiKey: string, prompt: string, seed: number): Promise<{ png: Buffer; usd: number }> {
  const response = await fetch(`${API}/create-image-pixen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: `${STYLE}: ${prompt}`,
      image_size: { width: 32, height: 32 },
      no_background: true,
      outline: 'single color black outline',
      seed,
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  const body = await response.json() as { image: { base64: string }; usage?: { usd?: number } };
  return { png: Buffer.from(body.image.base64, 'base64'), usd: body.usage?.usd ?? 0 };
}

async function main(): Promise<void> {
  const apiKey = process.env.PIXELLAB_API_KEY;
  if (!apiKey) throw new Error('Set PIXELLAB_API_KEY (for example in .env.local)');
  const options = parseArgs(process.argv.slice(2));
  const itemIds = options.only ?? Object.keys(ITEM_ICONS);
  mkdirSync(options.outDir, { recursive: true });

  const jobs = itemIds.flatMap(itemId => {
    const icon = ITEM_ICONS[itemId];
    if (!icon) throw new Error(`No prompt for item "${itemId}"`);
    return Array.from({ length: options.variants }, (_, i) => ({ itemId, prompt: icon.prompt, seed: icon.seed + i }));
  });

  let spent = 0;
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        const { png, usd } = await generateIcon(apiKey, job.prompt, job.seed);
        const name = options.variants > 1 ? `${job.itemId}.${job.seed}.png` : `${job.itemId}.png`;
        writeFileSync(join(options.outDir, name), png);
        spent += usd;
        console.log(`ok   ${name}`);
      } catch (error) {
        console.error(`fail ${job.itemId} (seed ${job.seed}): ${(error as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`${jobs.length} images, $${spent.toFixed(3)}`);
}

await main();
