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
  /** Volume, 0-1 (default 1); above 1 lifts a quiet file (a loop, which isn't lifted when made) */
  volume?: number;
  /** At most this many playing at once (default 3) */
  maxVoices?: number;
  /** Starts at this share of its volume and rises to full by its end (a channel building up) */
  rise?: number;
  /** Keep its pitch, and so its length (a sound timed to something, like the recall) */
  steadyPitch?: boolean;
}

const DRY = "video game sound effect, dry, no music, no voice";

export const SOUNDS = {
  // Combat
  hit_physical: { prompt: `a short punchy sword strike hitting a body, ${DRY}`, duration: 0.5, variants: 2, volume: 0.55, maxVoices: 4 },
  hit_magic: { prompt: `a short magical energy impact zap, sparkly, ${DRY}`, duration: 0.5, variants: 2, volume: 0.5, maxVoices: 4 },
  attack_swing: { prompt: `a quick sword whoosh swinging through the air, ${DRY}`, duration: 0.5, volume: 0.45, maxVoices: 3 },
  attack_bow: { prompt: `a bow string releasing an arrow with a short whoosh, ${DRY}`, duration: 0.5, volume: 0.45, maxVoices: 3 },
  tower_shot: { prompt: `a heavy magical tower firing a bolt of energy, deep whoosh, ${DRY}`, duration: 0.8, volume: 0.7, maxVoices: 2 },
  cannon_shot: { prompt: `a small cannon firing, short boom, ${DRY}`, duration: 0.6, volume: 0.4, maxVoices: 2 },

  // Jungle monsters' attacks (monster_<creature type>)
  monster_wolf: { prompt: `a fiery hound snarling and snapping its jaws, a quick vicious bite, ${DRY}`, duration: 0.6, volume: 0.3, maxVoices: 2 },
  monster_spider: { prompt: `a small cave spider hissing and biting, quick chitter, ${DRY}`, duration: 0.5, volume: 0.25, maxVoices: 2 },
  monster_thornspitter: { prompt: `a carnivorous plant spitting a thorn, a wet pop and a short whoosh, ${DRY}`, duration: 0.5, volume: 0.6, maxVoices: 2 },
  monster_blue_buff: { prompt: `a giant ancient tortoise snapping its beak, a heavy thud with a crystal clink, ${DRY}`, duration: 0.7, volume: 0.85, maxVoices: 2 },
  monster_red_buff: { prompt: `a brute of molten rock swinging a heavy fist, a deep thud with sizzling lava, ${DRY}`, duration: 0.7, volume: 0.55, maxVoices: 2 },
  monster_dragon: { prompt: "a large dragon snapping its jaws with a short deep growl, video game sound effect, no music", duration: 0.8, volume: 0.6, maxVoices: 2 },
  // Their special attacks: the wind-up, then where it lands
  jungle_slam_blue_windup: { prompt: `a giant tortoise rearing up with a deep groan as crystals hum and build up, ${DRY}`, duration: 1.1, volume: 0.6, maxVoices: 1 },
  jungle_slam_blue: { prompt: `a giant crystal shell crashing onto the ground, a heavy boom with shattering crystal, ${DRY}`, duration: 1.2, volume: 1, maxVoices: 1 },
  jungle_slam_red_windup: { prompt: "a molten rock brute roaring as it raises its fists, lava rumbling, video game sound effect, no music", duration: 1.1, volume: 0.4, maxVoices: 1 },
  jungle_slam_red: { prompt: `huge molten fists smashing the ground, a deep boom with cracking rock and hissing lava, ${DRY}`, duration: 1.2, volume: 1, maxVoices: 1 },
  dragon_breath_windup: { prompt: `a huge dragon inhaling deeply, fire rumbling in its throat, ${DRY}`, duration: 1, volume: 0.4, maxVoices: 1 },
  dragon_breath: { prompt: "a dragon breathing a roaring jet of fire, video game sound effect, no music", duration: 1.5, volume: 0.55, maxVoices: 1 },

  // Deaths
  minion_death: { prompt: `a small soldier grunting and falling with armor clatter, ${DRY}`, duration: 0.7, volume: 0.25, maxVoices: 2 },
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
  tower_alert: { prompt: `a short urgent warning: two quick low pulsing alarm tones, ${DRY}`, duration: 0.7, bus: "ui", volume: 0.75, maxVoices: 1 },
  low_health: { prompt: `a slow soft heartbeat, steady, low thumps, seamless loop, ${DRY}`, duration: 4, loop: true, bus: "ui", volume: 2.5, maxVoices: 1 },

  // Wards and recall
  ward_place: { prompt: `a soft magical chime as a small totem is set down on grass, ${DRY}`, duration: 0.7, volume: 0.5, maxVoices: 1 },
  recall_channel: { prompt: `magical energy charging up for eight seconds: a soft shimmering hum that keeps rising in pitch and growing brighter and louder until the very end, ${DRY}`, duration: 8, volume: 0.6, maxVoices: 2, rise: 0.25, steadyPitch: true },
  recall_depart: { prompt: `a magical teleport beam up: a bright shimmering whine rising fast in pitch, ending in a quick zippy "jee-ooo" as it vanishes into the sky, ${DRY}`, duration: 1.2, volume: 0.55, maxVoices: 2 },
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

  // Abilities, by ability id (a part of one: <abilityId>_<part>; a
  // projectile bursting: <abilityId>_impact). abilitySounds.ts says when and
  // where each plays.
  // Kael: steel and blades of light
  warrior_slash: { prompt: `a heavy greatsword cleaving in a wide arc, a fast whoosh with a bright ringing steel edge, ${DRY}`, duration: 0.7, volume: 0.65, maxVoices: 2 },
  warrior_shield: { prompt: `a knight raising a steel shield, a solid metallic clang with a resonant magical shimmer, ${DRY}`, duration: 0.9, volume: 0.85, maxVoices: 2 },
  warrior_charge: { prompt: `an armored knight charging forward, heavy rushing footsteps and a strong whoosh, ${DRY}`, duration: 0.7, volume: 1, maxVoices: 2 },
  warrior_ultimate_leap: { prompt: `a heroic leap high into the air, armor rattling with a rising whoosh, ${DRY}`, duration: 0.5, volume: 0.6, maxVoices: 2 },
  warrior_ultimate_strike: { prompt: `a giant sword of light crashing into the ground, a thunderous impact with ringing steel and cracking stone, ${DRY}`, duration: 1.2, volume: 1, maxVoices: 2 },
  // Magnus: fire and arcane
  magnus_fireball: { prompt: `a fireball hurled from a mage's hand, a roaring fiery whoosh, ${DRY}`, duration: 0.7, volume: 0.5, maxVoices: 2 },
  magnus_fireball_impact: { prompt: `a fireball exploding on impact, a crackling fiery burst, ${DRY}`, duration: 0.8, volume: 1, maxVoices: 2 },
  magnus_shield: { prompt: `an arcane magic barrier forming around a mage, a deep humming swell with crystalline shimmer, ${DRY}`, duration: 1, volume: 0.5, maxVoices: 2 },
  magnus_mud: { prompt: `a thick pool of mud splashing onto the ground, a wet squelch and bubbling, ${DRY}`, duration: 0.9, volume: 1, maxVoices: 2 },
  magnus_meteor_fall: { prompt: `a flaming meteor falling fast from the sky, a descending fiery whistle, ${DRY}`, duration: 0.7, volume: 0.2, maxVoices: 2 },
  magnus_meteor_impact: { prompt: `a meteor crashing into the ground, a big fiery explosion then roaring crackling flames, ${DRY}`, duration: 1.5, volume: 0.85, maxVoices: 2 },
  // Elara: holy light
  elara_heal: { prompt: `a warm holy healing spell, a soft bright chime with an angelic shimmer, ${DRY}`, duration: 1, volume: 0.75, maxVoices: 2 },
  elara_barrier: { prompt: `a holy shield of light forming, a bright glassy ring with soft sparkles, ${DRY}`, duration: 0.8, volume: 0.65, maxVoices: 2 },
  elara_speed: { prompt: `a light breezy gust of wind with quick sparkling chimes, ${DRY}`, duration: 0.8, volume: 0.75, maxVoices: 2 },
  elara_resurrection: { prompt: "a grand radiant holy blessing, a swelling angelic choir chord bursting into bright shimmering light, video game sound effect, no music", duration: 2, volume: 0.8, maxVoices: 2 },
  // Gorath: stone
  gorath_slam: { prompt: `a huge stone fist pounding the ground once, a short deep thud with cracking rock, ${DRY}`, duration: 0.8, volume: 1, maxVoices: 2 },
  gorath_fortify: { prompt: `heavy rocks grinding and crunching together as stone armor forms, ${DRY}`, duration: 0.9, volume: 1, maxVoices: 2 },
  gorath_taunt: { prompt: "a giant stone golem's deep furious roar, video game sound effect, no music", duration: 1.2, volume: 0.3, maxVoices: 2 },
  gorath_earthquake_rumble: { prompt: `a deep earthquake rumble building up, the ground trembling, ${DRY}`, duration: 0.7, volume: 0.8, maxVoices: 2 },
  gorath_earthquake: { prompt: `a massive earthquake, the ground splitting with a huge booming crack and boulders tumbling, ${DRY}`, duration: 1.8, volume: 1, maxVoices: 2 },
  // Lume: a light orb
  lume_q: { prompt: `a glowing orb of light flung away, a soft bright whoosh with a twinkling chime, ${DRY}`, duration: 0.6, volume: 1, maxVoices: 2 },
  lume_q_arrive: { prompt: `a small orb of light landing, a bright crystalline pop, ${DRY}`, duration: 0.6, volume: 0.7, maxVoices: 2 },
  lume_q_recast: { prompt: `an orb of light flying back to its owner, a soft reversed shimmering whoosh, ${DRY}`, duration: 0.7, volume: 0.45, maxVoices: 2 },
  lume_w: { prompt: `a warm pulse of light rolling out, a soft resonant swell with gentle bell shimmer, ${DRY}`, duration: 0.9, volume: 0.5, maxVoices: 2 },
  lume_e: { prompt: `a quick dash in a streak of light ending in a bright flash zing, ${DRY}`, duration: 0.6, volume: 0.9, maxVoices: 2 },
  lume_r_charge: { prompt: `light gathering into an orb, a fast rising bright shimmering tone, ${DRY}`, duration: 0.5, volume: 0.35, maxVoices: 2 },
  lume_r: { prompt: `a beam of light crashing down, a huge bright explosion with shattering crystal and a shimmering ring, ${DRY}`, duration: 1.6, volume: 1, maxVoices: 2 },
  // Vex: shadow ninja
  vex_shuriken: { prompt: `a ninja throwing a spinning shuriken, a sharp fast metallic whir, ${DRY}`, duration: 0.5, volume: 0.75, maxVoices: 2 },
  vex_shroud: { prompt: `a ninja vanishing into shadow, a soft smoky whoosh and a dark hiss, ${DRY}`, duration: 0.8, volume: 0.6, maxVoices: 2 },
  vex_dash: { prompt: `a ninja's swift shadow dash, a quick sharp swoosh, ${DRY}`, duration: 0.5, volume: 1, maxVoices: 2 },
  vex_ninja_mode: { prompt: `a katana drawn from its sheath with a sharp ring and a surge of dark energy, ${DRY}`, duration: 1, volume: 0.65, maxVoices: 2 },
  // Vile: cursed arrows and souls
  vile_black_arrows: { prompt: `a dark bow loosing a heavy cursed arrow, a deep twang and a dark whoosh, ${DRY}`, duration: 0.7, volume: 0.85, maxVoices: 2 },
  vile_black_arrows_recast: { prompt: `a quick shadowy dash, a whoosh with whispering dark energy, ${DRY}`, duration: 0.6, volume: 0.7, maxVoices: 2 },
  vile_veil_of_darkness: { prompt: `a veil of darkness wrapping around someone, a deep ghostly whispering whoosh, ${DRY}`, duration: 1, volume: 0.8, maxVoices: 2 },
  vile_roots_of_vilix: { prompt: `a small cursed trap set into the ground, quiet creaking wood and a faint dark hum, ${DRY}`, duration: 0.6, volume: 0.8, maxVoices: 2 },
  vile_trap_trigger: { prompt: `twisted roots snapping shut around someone's legs, a sharp wooden crack and creak, ${DRY}`, duration: 0.7, volume: 1, maxVoices: 2 },
  vile_trap_explosion: { prompt: `a cursed trap bursting with dark magic, a deep whooshing boom, ${DRY}`, duration: 0.9, volume: 0.95, maxVoices: 3 },
  vile_restoration_of_vilix: { prompt: "a dark demonic transformation, a deep monstrous growl with a surging wave of dark energy, video game sound effect, no music", duration: 1.8, volume: 0.55, maxVoices: 2 },

  // Announcements (a tower, an inhibitor or the dragon falls, a champion kill)
  stinger_good: { prompt: `a short triumphant brass fanfare hit, game notification`, duration: 1.5, bus: "ui", volume: 0.5, maxVoices: 1 },
  stinger_bad: { prompt: `a short ominous low brass hit, game notification`, duration: 1.5, bus: "ui", volume: 0.5, maxVoices: 1 },

  // Ambience, faded in and out by where the camera is
  amb_river: { prompt: "gentle flowing river water, calm, no music", duration: 6, loop: true, bus: "ambience", volume: 0.22, maxVoices: 1 },
  amb_jungle: { prompt: "calm forest ambience with distant birds and insects, no music", duration: 8, loop: true, bus: "ambience", volume: 0.25, maxVoices: 1 },
} satisfies Record<string, SoundDef>;

export type SoundKey = keyof typeof SOUNDS;

/** A sound's files, as the game loads them */
export function soundFiles(key: SoundKey): string[] {
  const def: SoundDef = SOUNDS[key];
  const extension = def.loop ? "wav" : "mp3";
  return Array.from({ length: def.variants ?? 1 }, (_, n) => `/assets/sounds/${key}.${n}.${extension}`);
}
