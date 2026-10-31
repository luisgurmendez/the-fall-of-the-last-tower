/**
 * Generates map props with PixelLab (create-image-pixen): the wards. Each
 * prop gets a few takes (one per seed), saved to --out with a contact sheet
 * per prop (takes numbered from 0, left to right); PROPS keeps the pick, and
 * --install copies the picks to public/assets/props/<key>.png, where
 * src/render/entities/ward.ts reads them.
 *
 * Usage (from the repo root; Bun loads PIXELLAB_API_KEY from .env.local):
 *   bun scripts/generate-props.ts --out /tmp/props                  # every prop
 *   bun scripts/generate-props.ts --out /tmp/props --only ward_control
 *   bun scripts/generate-props.ts --install /tmp/props              # copy the picks in
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blit, createImage, decodePng, encodePng } from './lib/png';
import { generatePixenImage, runPool } from './lib/pixellab';

const SIZE = 48;
const TAKES = 6;
const STYLE = 'pixel art game prop seen from a three-quarter top-down view, small and readable, muted fantasy palette';

interface Prop {
  description: string;
  /** Index of the take kept, from the contact sheet */
  pick: number;
}

export const PROPS: Record<string, Prop> = {
  ward_stealth: {
    pick: 0,
    description: 'a small wooden ward totem: a short carved post on a mossy stone, topped by a lantern with a glowing yellow-green eye',
  },
  ward_control: {
    pick: 0,
    description: 'a small dark stone ward obelisk with carved runes, topped by a glowing crimson crystal eye',
  },
};

async function generate(apiKey: string, key: string, outDir: string): Promise<number> {
  const prop = PROPS[key];
  let usd = 0;
  const takes = [];
  for (let seed = 0; seed < TAKES; seed++) {
    const image = await generatePixenImage(apiKey, { description: `${STYLE}: ${prop.description}`, size: SIZE, seed: seed + 1 });
    writeFileSync(join(outDir, `${key}.${seed}.png`), image.png);
    takes.push(decodePng(image.png));
    usd += image.usd;
  }
  // Contact sheet: the takes side by side, scaled 4x
  const scale = 4;
  const sheet = createImage(TAKES * SIZE * scale, SIZE * scale);
  takes.forEach((take, i) => {
    const big = createImage(take.width * scale, take.height * scale);
    for (let y = 0; y < big.height; y++) {
      for (let x = 0; x < big.width; x++) {
        const from = (Math.floor(y / scale) * take.width + Math.floor(x / scale)) * 4;
        big.data.set(take.data.subarray(from, from + 4), (y * big.width + x) * 4);
      }
    }
    blit(sheet, big, i * SIZE * scale, 0);
  });
  writeFileSync(join(outDir, `${key}.sheet.png`), encodePng(sheet));
  console.log(`ok   ${key}: ${TAKES} takes ($${usd.toFixed(3)})`);
  return usd;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const option = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const only = option('--only')?.split(',') ?? Object.keys(PROPS);

  const installFrom = option('--install');
  if (installFrom) {
    mkdirSync('public/assets/props', { recursive: true });
    for (const key of only) {
      const from = join(installFrom, `${key}.${PROPS[key].pick}.png`);
      if (!existsSync(from)) throw new Error(`missing ${from}`);
      copyFileSync(from, join('public/assets/props', `${key}.png`));
      console.log(`installed ${key} (take ${PROPS[key].pick})`);
    }
    return;
  }

  const apiKey = process.env.PIXELLAB_API_KEY;
  if (!apiKey) throw new Error('Set PIXELLAB_API_KEY (for example in .env.local)');
  const outDir = option('--out');
  if (!outDir) throw new Error('Pass --out <dir> for the takes');
  mkdirSync(outDir, { recursive: true });
  let total = 0;
  await runPool(only, async key => {
    try {
      const usd = await generate(apiKey, key, outDir);
      total += usd;
    } catch (error) {
      console.error(`fail ${key}: ${(error as Error).message}`);
    }
  });
  console.log(`total $${total.toFixed(3)}`);
}

await main();
