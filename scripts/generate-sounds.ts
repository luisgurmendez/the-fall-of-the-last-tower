/**
 * Generates the game's sounds with ElevenLabs' sound generation (text to
 * sound effect) from the prompts in src/audio/soundCatalog.ts, then cleans
 * them up with ffmpeg: one-shots lose their leading silence, peak at -1 dB,
 * fade out at the end and are saved as mono mp3; loops (asked for as
 * seamless loops) are only leveled and saved as wav, which loops without the
 * gap an mp3's padding leaves. Each sound gets `variants` takes, installed
 * as public/assets/sounds/<key>.<n>.<mp3|wav> (the raw takes stay in --raw).
 *
 * Usage (from the repo root; Bun loads ELEVENLABS_API_KEY from .env.local):
 *   bun scripts/generate-sounds.ts                       # every sound missing a file
 *   bun scripts/generate-sounds.ts --only gold,level_up  # these, even if present
 *   bun scripts/generate-sounds.ts --raw /tmp/sounds     # keep the raw takes there
 *
 * Credits: the free plan has 10,000 a month; the script prints what's left.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SOUNDS, soundFiles, type SoundDef, type SoundKey } from '../src/audio/soundCatalog';

const API = 'https://api.elevenlabs.io/v1';
const OUT_DIR = 'public/assets/sounds';
/** How closely to follow the prompt (0-1; ElevenLabs' default is 0.3) */
const PROMPT_INFLUENCE = 0.5;
/** One-shots peak here (dB) */
const PEAK_DB = -1;
/** Loops sit lower, under everything else */
const LOOP_PEAK_DB = -6;

async function credits(apiKey: string): Promise<string> {
  const response = await fetch(`${API}/user/subscription`, { headers: { 'xi-api-key': apiKey } });
  const data = await response.json() as { character_count: number; character_limit: number };
  return `${data.character_limit - data.character_count} of ${data.character_limit} credits left`;
}

async function generate(apiKey: string, def: SoundDef): Promise<Uint8Array> {
  const response = await fetch(`${API}/sound-generation?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: def.prompt,
      duration_seconds: def.duration,
      prompt_influence: PROMPT_INFLUENCE,
      loop: def.loop ?? false,
      model_id: 'eleven_text_to_sound_v2',
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return new Uint8Array(await response.arrayBuffer());
}

function ffmpeg(args: string[]): string {
  const result = Bun.spawnSync(['ffmpeg', '-hide_banner', '-y', ...args], { stderr: 'pipe' });
  const log = result.stderr.toString();
  if (result.exitCode !== 0) throw new Error(`ffmpeg failed: ${log.slice(-300)}`);
  return log;
}

/** The loudest sample, in dB */
function peakDb(file: string): number {
  const log = ffmpeg(['-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  return Number(/max_volume: (-?[\d.]+) dB/.exec(log)?.[1] ?? 0);
}

/** Clean a raw take up into its game file */
function processTake(raw: string, out: string, def: SoundDef): void {
  if (def.loop) {
    const gain = LOOP_PEAK_DB - peakDb(raw);
    ffmpeg(['-i', raw, '-af', `volume=${gain.toFixed(2)}dB`, '-ac', '1', '-ar', '44100', out]);
    return;
  }
  // Trim the leading silence, then level the peak and fade the tail out
  const trimmed = join(tmpdir(), `siege-sound-${process.pid}.wav`);
  ffmpeg(['-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB', '-ac', '1', '-ar', '44100', trimmed]);
  const gain = PEAK_DB - peakDb(trimmed);
  ffmpeg([
    '-i', trimmed,
    '-af', `volume=${gain.toFixed(2)}dB,areverse,afade=t=in:d=0.06,areverse`,
    '-b:a', '96k', out,
  ]);
}

async function main(): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('Set ELEVENLABS_API_KEY (for example in .env.local)');
  const args = process.argv.slice(2);
  const option = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const only = option('--only')?.split(',') as SoundKey[] | undefined;
  const rawDir = option('--raw') ?? join(tmpdir(), 'siege-sounds-raw');
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(rawDir, { recursive: true });

  const keys = only ?? (Object.keys(SOUNDS) as SoundKey[]).filter(key => soundFiles(key).some(file => !existsSync(join('public', file))));
  console.log(`${keys.length} sounds to make; ${await credits(apiKey)}`);

  for (const key of keys) {
    const def: SoundDef = SOUNDS[key];
    if (!def) throw new Error(`No sound "${key}" in the catalog`);
    const files = soundFiles(key);
    for (let n = 0; n < files.length; n++) {
      try {
        const raw = join(rawDir, `${key}.${n}.raw.mp3`);
        writeFileSync(raw, await generate(apiKey, def));
        processTake(raw, join('public', files[n]), def);
        console.log(`ok   ${key} ${n + 1}/${files.length}`);
      } catch (error) {
        console.error(`fail ${key}: ${(error as Error).message}`);
      }
    }
  }
  console.log(await credits(apiKey));
}

await main();
