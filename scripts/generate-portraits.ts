/**
 * Generates champion portraits (just the face, a bust) with PixelLab's
 * generate-image-v2, using the first frame of the champion's idle sprite as
 * the subject reference so the portrait looks like the character in game:
 * 64x64 pixel art on a transparent background.
 *
 * Each request returns 16 variants. They're saved to --out with a contact
 * sheet per champion (variants numbered from 0, left to right, top to
 * bottom) to pick from; PORTRAITS keeps the pick, and --install copies the
 * picked variants to public/assets/champs/<championId>/portrait.png
 * (src/ui/matchmaking/portraits.ts reads them from there).
 *
 * Usage (from the repo root; Bun loads PIXELLAB_API_KEY from .env.local):
 *   bun scripts/generate-portraits.ts --out /tmp/portraits                 # every champion
 *   bun scripts/generate-portraits.ts --out /tmp/portraits --only vex,lume
 *   bun scripts/generate-portraits.ts --install /tmp/portraits             # copy the picks in
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blit, createImage, decodePng, encodePng, type RgbaImage } from './lib/png';
import { runPool } from './lib/pixellab';

const API = 'https://api.pixellab.ai/v2';
const SIZE = 64;
const STYLE =
  'pixel art character portrait, close-up of the head and shoulders only, facing the viewer at a slight angle, ' +
  'detailed face, dark fantasy RPG style, crisp single color dark outline';

interface Portrait {
  /** The champion's idle sprite strip (square frames; the first is the reference) */
  sprite: string;
  /** Who it is, as seen in the sprite */
  prompt: string;
  /** Index of the variant kept, from the contact sheet */
  pick: number;
}

export const PORTRAITS: Record<string, Portrait> = {
  warrior: { sprite: 'public/assets/champs/warrior/idle.png', pick: 0, prompt: 'a young knight with short brown hair, silver plate armor and a blue cape' },
  magnus: { sprite: 'public/assets/champs/magnus/idle.png', pick: 3, prompt: 'a stern fire mage with a dark beard, a red hood and robes, and steel shoulder plates' },
  elara: { sprite: 'public/assets/champs/elara/idle.png', pick: 2, prompt: 'a serene priestess with long white hair, white and gold robes and a golden circlet' },
  vex: { sprite: 'public/assets/champs/vex/idle.png', pick: 0, prompt: 'a ninja in a dark navy hood and face mask, only the eyes showing, a scarf around the neck' },
  gorath: { sprite: 'public/assets/champs/gorath/idle.png', pick: 0, prompt: 'a huge bearded warrior with long brown hair, steel armor and leather straps' },
  vile: { sprite: 'public/assets/champs/vile/idle.png', pick: 4, prompt: 'a grim hunter in a black hood, the face in shadow, faint purple wisps of smoke around him' },
  uruk: { sprite: 'public/assets/champs/uruk/idle.png', pick: 5, prompt: 'a silver-scaled dragonborn with a dragon head, small horns, amber eyes and silver plate armor' },
  oitboil: { sprite: 'public/assets/champs/oitboil/idle.png', pick: 10, prompt: 'a green goblin pyromancer with big pointed ears, a wide grin and brass goggles pushed up on his forehead, soot on his cheeks' },
  elora: { sprite: 'public/assets/champs/elora/idle.png', pick: 0, prompt: 'a young huntress with a dark braid and a hooded forest-green cloak, sharp focused eyes' },
  caelum: { sprite: 'public/assets/champs/caelum/idle.png', pick: 0, prompt: 'an old kind druid with a long white beard and a crown of leaves, soft golden light on his face' },
  fenris: { sprite: 'public/assets/champs/fenris/idle.png', pick: 7, prompt: 'a snarling grey werewolf with glowing red eyes and ragged dark fur, bared fangs' },
  calamitus: { sprite: 'public/assets/champs/calamitus/idle.png', pick: 5, prompt: 'a golem head of black cooled rock with glowing orange magma cracks and burning eyes' },
  protobot: { sprite: 'public/assets/champs/protobot/idle.png', pick: 0, prompt: 'a dark blue steel war robot head with glowing cyan eyes and the number 45 painted on it' },
  hop: { sprite: 'public/assets/champs/hop/idle.png', pick: 6, prompt: 'a cute fluffy white rabbit with long ears, big pink eyes and a tiny mischievous grin showing a sharp fang' },
  kip: { sprite: 'public/assets/champs/kip/idle_south.png', pick: 6, prompt: 'a cocky freckled teenage boy with messy dark brown curly hair, a white headband with long tails, a big grin and a burnt-orange cape over a cream shirt' },
  zhakrul: { sprite: 'public/assets/champs/zhakrul/idle.png', pick: 0, prompt: 'a menacing giant scorpion head with crimson black armor plates, glowing green eyes and big pincers raised' },
  nocthar: { sprite: 'public/assets/champs/nocthar/idle.png', pick: 0, prompt: 'a hunched grey-green undead ghoul with a rotting skull-like face, small pale eyes in dark sockets, bared yellowed teeth, wispy white hair strands and bony shoulders' },
  lume: { sprite: 'public/assets/champs/lume/Lume-IDLE.png', pick: 1, prompt: 'a gentle young woman with white hair in a cream hooded robe, soft warm light on her face' },
};

/** The first square frame of a sprite strip, cropped to the figure */
function firstFrame(path: string): RgbaImage {
  const strip = decodePng(readFileSync(path));
  const size = strip.height;
  let minX = size, minY = size, maxX = -1, maxY = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (strip.data[(y * strip.width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  const frame = createImage(maxX - minX + 1, maxY - minY + 1);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const from = (y * strip.width + x) * 4;
      const to = ((y - minY) * frame.width + (x - minX)) * 4;
      frame.data.set(strip.data.subarray(from, from + 4), to);
    }
  }
  return frame;
}

async function request(apiKey: string, path: string, init?: RequestInit): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'User-Agent': 'siege-portraits' },
    });
    if (response.status === 429 && attempt < 6) {
      await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    return response.json();
  }
}

/** The generated images in a finished job's response, wherever the API puts them */
function imagesOf(response: any): string[] {
  const images = response?.images ?? response?.last_response?.images ?? [];
  return images.map((image: any) => (typeof image === 'string' ? image : image.base64 ?? image.image?.base64));
}

async function generate(apiKey: string, championId: string, outDir: string): Promise<void> {
  const portrait = PORTRAITS[championId];
  const reference = firstFrame(portrait.sprite);
  const job = await request(apiKey, '/generate-image-v2', {
    method: 'POST',
    body: JSON.stringify({
      description: `${STYLE}: ${portrait.prompt}`,
      image_size: { width: SIZE, height: SIZE },
      no_background: true,
      reference_images: [{
        image: { base64: Buffer.from(encodePng(reference)).toString('base64') },
        size: { width: reference.width, height: reference.height },
        usage_description: 'The character to draw: keep the face, hair, colors and outfit, but show only the head and shoulders',
      }],
    }),
  });
  const jobId = job.background_job_id ?? job.id;
  let result: any;
  for (;;) {
    await new Promise(resolve => setTimeout(resolve, 6000));
    result = await request(apiKey, `/background-jobs/${jobId}`);
    if (result.status === 'completed') break;
    if (result.status === 'failed') throw new Error(`job failed: ${JSON.stringify(result.last_response ?? result).slice(0, 300)}`);
  }

  const images = imagesOf(result.last_response ?? result).map(base64 => decodePng(Buffer.from(base64.replace(/^data:image\/png;base64,/, ''), 'base64')));
  mkdirSync(outDir, { recursive: true });
  // Each variant, and a contact sheet of them all (4 across, scaled 3x)
  const columns = 4;
  const scale = 3;
  const sheet = createImage(columns * SIZE * scale, Math.ceil(images.length / columns) * SIZE * scale);
  images.forEach((image, i) => {
    writeFileSync(join(outDir, `${championId}.${i}.png`), encodePng(image));
    const big = createImage(image.width * scale, image.height * scale);
    for (let y = 0; y < big.height; y++) {
      for (let x = 0; x < big.width; x++) {
        const from = (Math.floor(y / scale) * image.width + Math.floor(x / scale)) * 4;
        big.data.set(image.data.subarray(from, from + 4), (y * big.width + x) * 4);
      }
    }
    blit(sheet, big, (i % columns) * SIZE * scale, Math.floor(i / columns) * SIZE * scale);
  });
  writeFileSync(join(outDir, `${championId}.sheet.png`), encodePng(sheet));
  console.log(`ok   ${championId}: ${images.length} variants`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const option = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const only = option('--only')?.split(',') ?? Object.keys(PORTRAITS);

  const installFrom = option('--install');
  if (installFrom) {
    for (const championId of only) {
      const from = join(installFrom, `${championId}.${PORTRAITS[championId].pick}.png`);
      if (!existsSync(from)) throw new Error(`missing ${from}`);
      copyFileSync(from, join('public/assets/champs', championId, 'portrait.png'));
      console.log(`installed ${championId} (variant ${PORTRAITS[championId].pick})`);
    }
    return;
  }

  const apiKey = process.env.PIXELLAB_API_KEY;
  if (!apiKey) throw new Error('Set PIXELLAB_API_KEY (for example in .env.local)');
  const outDir = option('--out');
  if (!outDir) throw new Error('Pass --out <dir> for the variants');
  await runPool(only, async championId => {
    try {
      await generate(apiKey, championId, outDir);
    } catch (error) {
      console.error(`fail ${championId}: ${(error as Error).message}`);
    }
  });
}

await main();
