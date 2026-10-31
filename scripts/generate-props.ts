/**
 * Generates single images with PixelLab (create-image-pixen): map props (the
 * wards), structures (the inhibitor) and the summoner
 * spell icons. Each gets a few takes (one per
 * seed), saved to --out with a contact sheet per image (takes numbered from
 * 0, left to right); PROPS keeps the pick, and --install copies the picks to
 * where the game reads them: public/assets/props/<key>.png for props and
 * structures (src/render/entities/ward.ts, inhibitor.ts), public/assets/summoners/<id>.png for icons
 * (src/ui/summonerIcons.ts).
 *
 * Usage (from the repo root; Bun loads PIXELLAB_API_KEY from .env.local):
 *   bun scripts/generate-props.ts --out /tmp/props                  # every prop
 *   bun scripts/generate-props.ts --out /tmp/props --only ward_control,summoner_blink
 *   bun scripts/generate-props.ts --install /tmp/props              # copy the picks in
 */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blit, createImage, decodePng, encodePng } from './lib/png';
import { generatePixenImage, runPool } from './lib/pixellab';

const TAKES = 4;
const KINDS = {
  prop: {
    size: 48,
    style: 'pixel art game prop seen from a three-quarter top-down view, small and readable, muted fantasy palette',
    dir: 'public/assets/props',
  },
  structure: {
    size: 64,
    style: 'pixel art building seen from a three-quarter top-down view, readable, muted fantasy palette',
    dir: 'public/assets/props',
  },
  // Drawn at 32 in the HUD: made at that size, so its detail fits it
  icon: {
    size: 32,
    style: 'simple bold pixel art spell icon readable at small size: one big centered symbol, thick dark outline, few colors, dark background',
    dir: 'public/assets/summoners',
  },
};

interface Prop {
  kind: keyof typeof KINDS;
  description: string;
  /** Index of the take kept, from the contact sheet */
  pick: number;
  /** File name when installed (default: the key) */
  file?: string;
}

export const PROPS: Record<string, Prop> = {
  ward_stealth: {
    kind: 'prop',
    pick: 0,
    description: 'a small wooden ward totem: a short carved post on a mossy stone, topped by a lantern with a glowing yellow-green eye',
  },
  ward_control: {
    kind: 'prop',
    pick: 0,
    description: 'a small dark stone ward obelisk with carved runes, topped by a glowing crimson crystal eye',
  },
  // Drawn in blue and recolored for red; destroyed, only its pedestal is drawn
  inhibitor: {
    kind: 'structure',
    pick: 1,
    description: 'a large glowing blue crystal ring floating above a round carved stone pedestal with blue runes',
  },
  summoner_blink: { kind: 'icon', file: 'blink', pick: 0, description: 'a burst of violet and white light, a teleport flash with sparkles' },
  summoner_haste: { kind: 'icon', file: 'haste', pick: 3, description: 'a winged boot with cyan speed streaks' },
  summoner_mend: { kind: 'icon', file: 'mend', pick: 2, description: 'a glowing green heart wrapped in soft healing light' },
  summoner_aegis: { kind: 'icon', file: 'aegis', pick: 3, description: 'a round golden shield radiating light' },
  summoner_scorch: { kind: 'icon', file: 'scorch', pick: 1, description: 'a fierce orange flame burning an ember' },
  summoner_hinder: { kind: 'icon', file: 'hinder', pick: 1, description: 'heavy purple chains wrapped around an iron weight' },
  summoner_purge: { kind: 'icon', file: 'purge', pick: 1, description: 'white light shattering a chain into pieces' },
  summoner_reap: { kind: 'icon', file: 'reap', pick: 1, description: 'a golden lightning bolt striking down' },
};

async function generate(apiKey: string, key: string, outDir: string): Promise<number> {
  const prop = PROPS[key];
  const { size: SIZE, style } = KINDS[prop.kind];
  let usd = 0;
  const takes = [];
  for (let seed = 0; seed < TAKES; seed++) {
    const image = await generatePixenImage(apiKey, { description: `${style}: ${prop.description}`, size: SIZE, seed: seed + 1 });
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
    for (const key of only) {
      const prop = PROPS[key];
      const from = join(installFrom, `${key}.${prop.pick}.png`);
      if (!existsSync(from)) throw new Error(`missing ${from}`);
      const dir = KINDS[prop.kind].dir;
      mkdirSync(dir, { recursive: true });
      copyFileSync(from, join(dir, `${prop.file ?? key}.png`));
      console.log(`installed ${key} (take ${prop.pick})`);
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
