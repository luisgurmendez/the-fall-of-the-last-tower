/**
 * Every sound the game plays: how it's made (the prompt and length given to
 * ElevenLabs' sound generation, scripts/generate-sounds.ts) and how it's
 * played (src/audio/AudioManager.ts). The files are in
 * public/assets/sounds/<key>.<n>.mp3 (.wav for loops), n from 0 to
 * variants - 1: a variant is picked at random each time, so frequent sounds
 * don't repeat exactly.
 *
 * No imports: the generator script reads this file with Bun.
 */

export type SoundBus = "sfx" | "ui" | "ambience";

export interface SoundDef {
  /** What to generate (ElevenLabs sound generation) */
  prompt: string;
  /** Seconds (0.5-30) */
  duration: number;
  /** Files to make and pick from at random (default 1) */
  variants?: number;
  /** A seamless loop (ambience, channels) */
  loop?: boolean;
  /** Mix bus (default sfx). ui sounds aren't placed in the world */
  bus?: SoundBus;
  /** Volume, 0-1 (default 1) */
  volume?: number;
  /** At most this many playing at once (default 3) */
  maxVoices?: number;
}

const DRY = "video game sound effect, dry, no music, no voice";

export const SOUNDS = {
  // Combat
  hit_physical: { prompt: `a short punchy sword strike hitting a body, ${DRY}`, duration: 0.5, variants: 2, volume: 0.55, maxVoices: 4 },
  hit_magic: { prompt: `a short magical energy impact zap, sparkly, ${DRY}`, duration: 0.5, variants: 2, volume: 0.5, maxVoices: 4 },
  attack_swing: { prompt: `a quick sword whoosh swinging through the air, ${DRY}`, duration: 0.5, volume: 0.45, maxVoices: 3 },
  attack_bow: { prompt: `a bow string releasing an arrow with a short whoosh, ${DRY}`, duration: 0.5, volume: 0.45, maxVoices: 3 },
  tower_shot: { prompt: `a heavy magical tower firing a bolt of energy, deep whoosh, ${DRY}`, duration: 0.8, volume: 0.7, maxVoices: 2 },
  cannon_shot: { prompt: `a small cannon firing, short boom, ${DRY}`, duration: 0.6, volume: 0.5, maxVoices: 2 },

  // Deaths
  minion_death: { prompt: `a small soldier grunting and falling with armor clatter, ${DRY}`, duration: 0.7, volume: 0.4, maxVoices: 2 },
  champion_death: { prompt: `a dramatic deep impact with a fading low choir hit, ${DRY}`, duration: 1.5, volume: 0.8, maxVoices: 2 },
  monster_death: { prompt: `a large beast's dying growl, short, ${DRY}`, duration: 1, volume: 0.6, maxVoices: 2 },
  tower_destroyed: { prompt: `a stone tower crumbling and collapsing, rubble falling, ${DRY}`, duration: 2, volume: 0.9, maxVoices: 1 },
  inhibitor_destroyed: { prompt: `a large magic crystal shattering into pieces with a glassy ring, ${DRY}`, duration: 1.5, volume: 0.9, maxVoices: 1 },

  // The local champion and the HUD
  level_up: { prompt: `a bright magical ascending chime, short, game level up, ${DRY}`, duration: 1, bus: "ui", volume: 0.6, maxVoices: 1 },
  gold: { prompt: `a few gold coins clinking, ${DRY}`, duration: 0.5, bus: "ui", volume: 0.35, maxVoices: 1 },
  item_buy: { prompt: `a coin purse jingle with a soft confirmation chime, ${DRY}`, duration: 0.7, bus: "ui", volume: 0.6, maxVoices: 1 },
  ability_level_up: { prompt: `a short soft magical click chime, ${DRY}`, duration: 0.5, bus: "ui", volume: 0.5, maxVoices: 1 },
  cant_cast: { prompt: `a short dull muted error thud, ${DRY}`, duration: 0.5, bus: "ui", volume: 0.5, maxVoices: 1 },

  // Wards and recall
  ward_place: { prompt: `a soft magical chime as a small totem is set down on grass, ${DRY}`, duration: 0.7, volume: 0.5, maxVoices: 1 },
  recall_channel: { prompt: `a soft mystical magical hum slowly swelling, ${DRY}`, duration: 8, volume: 0.5, maxVoices: 2 },
  recall_arrive: { prompt: `a magical teleport whoosh with sparkles, ${DRY}`, duration: 1, volume: 0.6, maxVoices: 2 },

  // Summoner spells (summoner_<id>)
  summoner_blink: { prompt: `a quick magical teleport zap, ${DRY}`, duration: 0.6, volume: 0.6, maxVoices: 2 },
  summoner_haste: { prompt: `a fast gust of wind whoosh, ${DRY}`, duration: 0.8, volume: 0.6, maxVoices: 2 },
  summoner_mend: { prompt: `a warm healing magic chime, ${DRY}`, duration: 1, volume: 0.6, maxVoices: 2 },
  summoner_aegis: { prompt: `a shimmering magic shield forming with a metallic ring, ${DRY}`, duration: 0.8, volume: 0.6, maxVoices: 2 },
  summoner_scorch: { prompt: `a burst of fire igniting, ${DRY}`, duration: 0.8, volume: 0.6, maxVoices: 2 },
  summoner_hinder: { prompt: `heavy iron chains clanking and binding tight, ${DRY}`, duration: 0.8, volume: 0.6, maxVoices: 2 },
  summoner_purge: { prompt: `a bright cleansing magical burst, ${DRY}`, duration: 0.8, volume: 0.6, maxVoices: 2 },
  summoner_reap: { prompt: `a sharp lightning strike crack, ${DRY}`, duration: 0.7, volume: 0.6, maxVoices: 2 },

  // Announcements (a tower, an inhibitor or the dragon falls, a champion kill)
  stinger_good: { prompt: `a short triumphant brass fanfare hit, game notification`, duration: 1.5, bus: "ui", volume: 0.5, maxVoices: 1 },
  stinger_bad: { prompt: `a short ominous low brass hit, game notification`, duration: 1.5, bus: "ui", volume: 0.5, maxVoices: 1 },

  // Ambience, faded in and out by where the camera is
  amb_river: { prompt: "gentle flowing river water, calm, no music", duration: 6, loop: true, bus: "ambience", volume: 0.5, maxVoices: 1 },
  amb_jungle: { prompt: "calm forest ambience with distant birds and insects, no music", duration: 8, loop: true, bus: "ambience", volume: 0.45, maxVoices: 1 },
} satisfies Record<string, SoundDef>;

export type SoundKey = keyof typeof SOUNDS;

/** A sound's files, as the game loads them */
export function soundFiles(key: SoundKey): string[] {
  const def: SoundDef = SOUNDS[key];
  const extension = def.loop ? "wav" : "mp3";
  return Array.from({ length: def.variants ?? 1 }, (_, n) => `/assets/sounds/${key}.${n}.${extension}`);
}
