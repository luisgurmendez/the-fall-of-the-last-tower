/**
 * Animates one drawn frame with PixelLab's PixMiniMax (/animate-pixminimax):
 * the frame is the first pose, the description the motion, and the frames
 * come back on the same canvas, side by side in one strip. For champions
 * drawn by hand (Lume's sheets), whose look isn't a PixelLab character: an
 * animation they lack keeps their own drawing and size.
 *
 * Usage (from the repo root; Bun loads PIXELLAB_API_KEY from .env.local):
 *   bun scripts/animate-frame.ts --frame public/assets/champs/lume/Lume-IDLE.png \
 *     --out /tmp/Lume-W-Sheet.png --frames 12 --seed 3 --direction east \
 *     --subject "a young woman with silver hair in a long cream robe" \
 *     --motion "raises one open palm toward a floating orb beside her, holds it, then lowers it"
 * Then look at the strip and copy the pick where the game reads it.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { blit, createImage, decodePng, encodePng } from './lib/png';

const API = 'https://api.pixellab.ai/v2';

function option(name: string): string | null {
  const args = process.argv.slice(2);
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${process.env.PIXELLAB_API_KEY}`, 'Content-Type': 'application/json', 'User-Agent': 'siege-animate' },
    });
    if (response.status === 429 && attempt < 6) {
      await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    return response.json() as Promise<T>;
  }
}

/** The frames a finished job returned, whatever shape they come in */
function framesOf(result: any): string[] {
  const images = result?.images ?? result?.frames ?? result?.last_response?.images ?? result?.last_response?.frames ?? [];
  return images.map((image: any) => (typeof image === 'string' ? image : image.base64 ?? image.image?.base64 ?? image.url));
}

async function imageOf(value: string) {
  if (value.startsWith('http')) {
    const response = await fetch(value, { headers: { 'User-Agent': 'curl/8' } });
    return decodePng(new Uint8Array(await response.arrayBuffer()));
  }
  return decodePng(Buffer.from(value.replace(/^data:image\/png;base64,/, ''), 'base64'));
}

async function main(): Promise<void> {
  const framePath = option('--frame');
  const out = option('--out');
  const motion = option('--motion');
  if (!framePath || !out || !motion) throw new Error('Pass --frame <png> --out <png> --motion "<what moves>"');
  if (!process.env.PIXELLAB_API_KEY) throw new Error('Set PIXELLAB_API_KEY (for example in .env.local)');
  const first = readFileSync(framePath).toString('base64');
  const job = await api<{ background_job_id: string; usage?: { usd?: number } }>('/animate-pixminimax', {
    method: 'POST',
    body: JSON.stringify({
      first_frame: { type: 'base64', base64: first, format: 'png' },
      description: motion,
      frame_count: Number(option('--frames') ?? 12),
      seed: Number(option('--seed') ?? 1),
      no_background: true,
      ...(option('--direction') ? { direction: option('--direction') } : {}),
      ...(option('--subject') ? { subject_description: option('--subject') } : {}),
      ...(option('--pose') ? { initial_pose: option('--pose') } : {}),
    }),
  });
  let result: any;
  for (;;) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    result = await api<any>(`/background-jobs/${job.background_job_id}`);
    if (result.status === 'completed') break;
    if (result.status === 'failed') throw new Error(`job failed: ${JSON.stringify(result.last_response ?? result).slice(0, 300)}`);
  }
  const frames = await Promise.all(framesOf(result.last_response ?? result).map(imageOf));
  if (frames.length === 0) throw new Error(`no frames in ${JSON.stringify(result).slice(0, 300)}`);
  const size = frames[0].height;
  const strip = createImage(frames.length * frames[0].width, size);
  frames.forEach((frame, i) => blit(strip, frame, i * frames[0].width, 0));
  writeFileSync(out, encodePng(strip));
  console.log(`ok ${frames.length} frames ${frames[0].width}x${size}, usd ${result.usage?.usd ?? job.usage?.usd ?? '?'}`);
}

await main();
