/**
 * The rank emblems (public/assets/ranks/<tier>.png, read by
 * src/ui/matchmaking/rankEmblem.ts): ONE crest built up tier by tier, so the
 * ranks read as steps. Bronze is the base, a shield with a sword (made by
 * generate-props.ts: rank_bronze). Each tier above is an edit of the one
 * below it with PixelLab's edit-image-pixen, which keeps the picture and
 * changes only what's asked: a new metal and one more ornament. Each tier is
 * ONE metal, ornaments included (the ranks don't mix colors). Unranked is the
 * base turned to dull stone.
 *
 * Each step makes a few takes (one per seed) from the previous tier's pick,
 * with a contact sheet; CHAIN keeps the picks. Run the steps in order,
 * looking at each sheet before the next.
 *
 * Usage (from the repo root; Bun loads PIXELLAB_API_KEY from .env.local):
 *   bun scripts/generate-rank-emblems.ts --out /tmp/ranks --step silver   # takes of silver
 *   bun scripts/generate-rank-emblems.ts --install /tmp/ranks              # copy the picks in
 *
 * --out must hold bronze.png (the base) and each earlier tier's pick as <tier>.<take>.png.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blit, createImage, decodePng, encodePng } from './lib/png';

const API = 'https://api.pixellab.ai/v2';
const SIZE = 64;
const TAKES = 3;
const DIR = 'public/assets/ranks';

interface Step {
  tier: string;
  /** The tier it's an edit of */
  from: string;
  edit: string;
  /** The take kept, from the contact sheet */
  pick: number;
  /** Installed in greys only (the edit leaves a tint) */
  greyscale?: boolean;
}

/** Bottom up: each tier adds to the one before */
export const CHAIN: Step[] = [
  {
    tier: 'silver', from: 'bronze', pick: 1,
    edit: 'make all the metal polished silver steel instead of bronze, and add two small silver wings at the sides of the shield. Keep the same shield and sword',
  },
  {
    tier: 'gold', from: 'silver', pick: 0,
    edit: 'make all the metal shiny gold instead of silver, and add a small gold crown on top of the shield. Keep the same shield, sword and wings',
  },
  {
    tier: 'platinum', from: 'gold', pick: 1,
    edit: 'make everything pale teal platinum metal instead of gold, wings, crown and sword included, and add two crossed platinum swords behind the shield, blades out above and hilts below. One single metal, no other colors. Keep the same shield, sword, wings and crown',
  },
  {
    tier: 'diamond', from: 'platinum', pick: 0,
    edit: 'make everything bright blue faceted crystal instead of platinum, wings, crown and swords included, and set a small sparkling diamond gem on the crossguard of the sword in the middle of the shield. Keep that sword. Only blues, no other colors. Keep the same shape',
  },
  {
    tier: 'master', from: 'diamond', pick: 1,
    edit: 'make everything deep violet enchanted metal instead of blue crystal, wings, crown, gem and swords included, make the wings bigger and grander, and add small violet flames rising around the crest. Only violets, no other colors. Keep the same shield, gem, crown and swords',
  },
  {
    tier: 'unranked', from: 'bronze', pick: 1, greyscale: true,
    edit: 'make everything dull grey weathered stone, the sword included, cracked and colorless, only greys. Keep the same shape',
  },
];

async function request(apiKey: string, path: string, init?: RequestInit): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'User-Agent': 'siege-ranks' },
    });
    if (response.status === 429 && attempt < 6) {
      await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    return response.json();
  }
}

function imagesOf(response: any): string[] {
  const images = response?.images ?? (response?.image ? [response.image] : []);
  return images.map((image: any) => (typeof image === 'string' ? image : image.base64 ?? image.image?.base64))
    .map((base64: string) => base64.replace(/^data:image\/png;base64,/, ''));
}

/** One take: the previous tier edited (an async job, polled) */
async function edit(apiKey: string, from: Buffer, description: string, seed: number): Promise<{ png: Buffer; usd: number }> {
  const job = await request(apiKey, '/edit-image-pixen', {
    method: 'POST',
    body: JSON.stringify({ image: { type: 'base64', base64: from.toString('base64'), format: 'png' }, description, seed, no_background: true }),
  });
  for (;;) {
    await new Promise(resolve => setTimeout(resolve, 4000));
    const result = await request(apiKey, `/background-jobs/${job.background_job_id}`);
    if (result.status === 'completed') {
      const [image] = imagesOf(result.last_response);
      if (!image) throw new Error(`no image in ${JSON.stringify(result.last_response).slice(0, 200)}`);
      return { png: Buffer.from(image, 'base64'), usd: result.usage?.usd ?? job.usage?.usd ?? 0 };
    }
    if (result.status === 'failed') throw new Error(`job failed: ${JSON.stringify(result.last_response ?? result).slice(0, 300)}`);
  }
}

/** The tier's picture: bronze is the base, the others their pick */
function pickPath(dir: string, tier: string): string {
  if (tier === 'bronze') return join(dir, 'bronze.png');
  const step = CHAIN.find(candidate => candidate.tier === tier);
  if (!step) throw new Error(`unknown tier ${tier}`);
  return join(dir, `${tier}.${step.pick}.png`);
}

/** The picture in greys only (each pixel's luminance), transparency kept */
function greyscale(image: ReturnType<typeof decodePng>): ReturnType<typeof decodePng> {
  const out = createImage(image.width, image.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const grey = Math.round(0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2]);
    out.data[i] = out.data[i + 1] = out.data[i + 2] = grey;
    out.data[i + 3] = image.data[i + 3];
  }
  return out;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const option = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };

  const installFrom = option('--install');
  if (installFrom) {
    mkdirSync(DIR, { recursive: true });
    for (const tier of ['bronze', ...CHAIN.map(step => step.tier)]) {
      const from = pickPath(installFrom, tier);
      if (!existsSync(from)) throw new Error(`missing ${from}`);
      if (CHAIN.find(step => step.tier === tier)?.greyscale) {
        writeFileSync(join(DIR, `${tier}.png`), encodePng(greyscale(decodePng(readFileSync(from)))));
      } else {
        copyFileSync(from, join(DIR, `${tier}.png`));
      }
      console.log(`installed ${tier}`);
    }
    return;
  }

  const apiKey = process.env.PIXELLAB_API_KEY;
  if (!apiKey) throw new Error('Set PIXELLAB_API_KEY (for example in .env.local)');
  const outDir = option('--out');
  const tier = option('--step');
  const step = CHAIN.find(candidate => candidate.tier === tier);
  if (!outDir || !step) throw new Error(`Pass --out <dir> and --step <${CHAIN.map(s => s.tier).join('|')}>`);
  const source = readFileSync(pickPath(outDir, step.from));

  let usd = 0;
  const takes = await Promise.all(Array.from({ length: TAKES }, async (_, i) => {
    const take = await edit(apiKey, source, step.edit, i + 1);
    usd += take.usd;
    writeFileSync(join(outDir, `${step.tier}.${i}.png`), take.png);
    return decodePng(take.png);
  }));

  // Contact sheet: what it was made from, then the takes, scaled 4x
  const scale = 4;
  const all = [decodePng(source), ...takes];
  const sheet = createImage(all.length * SIZE * scale, SIZE * scale);
  all.forEach((image, i) => {
    const big = createImage(image.width * scale, image.height * scale);
    for (let y = 0; y < big.height; y++) {
      for (let x = 0; x < big.width; x++) {
        const from = (Math.floor(y / scale) * image.width + Math.floor(x / scale)) * 4;
        big.data.set(image.data.subarray(from, from + 4), (y * big.width + x) * 4);
      }
    }
    blit(sheet, big, i * SIZE * scale, 0);
  });
  writeFileSync(join(outDir, `${step.tier}.sheet.png`), encodePng(sheet));
  console.log(`ok   ${step.tier}: ${TAKES} takes ($${usd.toFixed(3)}), from ${step.from}`);
}

await main();
