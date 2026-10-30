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
  long_sword: { seed: 7, prompt: 'a simple steel longsword, diagonal, silver blade, brown leather grip, gold crossguard' },
  bf_sword: { seed: 7, prompt: 'a huge heavy two-handed greatsword, very wide steel blade, diagonal' },
  bloodthirster: { seed: 8, prompt: 'a crimson sword with a glowing blood red blade and dripping blood, diagonal' },
  amplifying_tome: { seed: 7, prompt: 'a closed blue leather spellbook with a glowing cyan rune on the cover' },
  needlessly_large_rod: { seed: 8, prompt: 'a long wooden magic staff topped with a big glowing purple crystal, diagonal' },
  rabadons_deathcap: { seed: 8, prompt: 'a tall pointed purple wizard hat with a wide brim and a glowing violet gem' },
  dagger: { seed: 8, prompt: 'a small steel dagger with a curved blade and black grip, diagonal' },
  recurve_bow: { seed: 8, prompt: 'a wooden recurve bow with a taut string, diagonal' },
  cloth_armor: { seed: 8, prompt: 'a simple padded beige cloth tunic' },
  chain_vest: { seed: 8, prompt: 'a grey chainmail vest made of small metal rings' },
  thornmail: { seed: 7, prompt: 'a dark steel breastplate covered in sharp spikes and thorns' },
  null_magic_mantle: { seed: 8, prompt: 'a short light blue cloak with a silver clasp, softly glowing' },
  negatron_cloak: { seed: 9, prompt: 'an empty dark violet hooded cloak with glowing magenta runes, no person, folded garment' },
  rubys_crystal: { seed: 8, prompt: 'a single red faceted ruby crystal, shining' },
  giants_belt: { seed: 7, prompt: 'a thick brown leather belt with a large square iron buckle' },
  steraks_gage: { seed: 7, prompt: 'a heavy iron gauntlet with a glowing green gem on the back of the hand' },
  sheen: { seed: 8, prompt: 'a floating sparkling light blue magic crystal shard with a bright glow' },
  boots_of_speed: { seed: 7, prompt: 'a pair of brown leather boots with small white wings at the ankles' },
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
