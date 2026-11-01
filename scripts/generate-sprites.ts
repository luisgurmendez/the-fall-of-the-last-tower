/**
 * Generates animated sprites with PixelLab (https://api.pixellab.ai/v2): the
 * jungle monsters and the champions without hand-made art.
 *
 * For each sprite set: a PixelLab character (its look), then its animations
 * facing east; the game mirrors them to face west. Each animation's frames go
 * side by side in <outputDir>/<animation>.png, on a square canvas shared by
 * the set's animations with the feet on the idle's row, so switching
 * animations doesn't make the character jump. The renderer reads the frame
 * size from the strip's height and the frame count from its width.
 *
 * scripts/sprites.json keeps each set's character and animation ids: a later
 * run reuses them and only generates what's missing.
 *
 * Usage (from the repo root; Bun loads PIXELLAB_API_KEY from .env.local):
 *   bun scripts/generate-sprites.ts                  # every set
 *   bun scripts/generate-sprites.ts --only spider    # some sets
 *   bun scripts/generate-sprites.ts --only spider --redo attack --seed 8
 *     # generate those animations again (another seed gives another take)
 *   bun scripts/generate-sprites.ts --only spider --new-character
 *
 * A character takes about 3 minutes, an animation 1-5 minutes.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blit, bottomRow, createImage, decodePng, encodePng, type RgbaImage } from './lib/png';

const API = 'https://api.pixellab.ai/v2';
const MANIFEST_PATH = 'scripts/sprites.json';
const MONSTERS_DIR = 'public/assets/sprites/monsters';
const MINIONS_DIR = 'public/assets/sprites/minions';

type AnimationSpec =
  /** Drawn frame by frame from a description (4-16 frames) */
  | { mode: 'v3'; action: string; frames: number }
  /** Drawn from a description on PixMiniMax (multiple of 4 frames) */
  | { mode: 'pixminimax'; action: string; frames: number }
  /** A PixelLab skeleton animation (needs a matching character template) */
  | { mode: 'template'; template: string };

interface SpriteSetSpec {
  /** Its key in scripts/sprites.json and for --only (a creature type or champion id) */
  key: string;
  /** Where its strips go */
  outputDir: string;
  name: string;
  description: string;
  /** Character canvas in pixels */
  size: number;
  /** PixelLab's detail hint (default "medium detail"; "low detail" reads better at the game's size) */
  detail?: string;
  /** PixelLab skeleton the character is fitted to: mannequin, dog, bear, cat, horse, lion */
  template: string;
  /** Animations by name; every set has an idle (the others' feet line up with it) */
  animations: { idle: AnimationSpec } & Record<string, AnimationSpec>;
}

/** What a champion does in each of its animations */
interface ChampionActions {
  name: string;
  description: string;
  /** Canvas in pixels (default 96); smaller makes chunkier pixels, closer to the ground's */
  size?: number;
  detail?: string;
  /** Idle and walk, for a champion that doesn't stand or walk like a person (default: breathing, PixelLab's walk) */
  idle?: string;
  walk?: string;
  attack: string;
  q: string;
  w: string;
  e: string;
  r: string;
}

/**
 * A humanoid champion: idle, walk, attack and Q/W/E/R, in public/assets/champs/<championId>.
 */
function champion(championId: string, actions: ChampionActions): SpriteSetSpec {
  const cast = (action: string): AnimationSpec => ({ mode: 'pixminimax', action, frames: 8 });
  return {
    key: championId,
    outputDir: `public/assets/champs/${championId}`,
    name: actions.name,
    description: actions.description,
    size: actions.size ?? 96,
    detail: actions.detail,
    template: 'mannequin',
    animations: {
      idle: { mode: 'v3', action: actions.idle ?? 'standing ready, breathing calmly', frames: 4 },
      walk: actions.walk
        ? { mode: 'pixminimax', action: actions.walk, frames: 8 }
        : { mode: 'template', template: 'walking-6-frames' },
      attack: cast(actions.attack),
      q: cast(actions.q),
      w: cast(actions.w),
      e: cast(actions.e),
      r: cast(actions.r),
    },
  };
}

/**
 * A lane minion: idle, walk and attack, in public/assets/sprites/minions/<minionType>.
 * It's drawn in the blue team's colors; the red team's are recolored from it
 * when loaded, so its team color should be a bright blue and the only blue.
 */
function minion(minionType: string, name: string, description: string, attack: string): SpriteSetSpec {
  return {
    key: `minion_${minionType}`,
    outputDir: `${MINIONS_DIR}/${minionType}`,
    name,
    description,
    size: 64,
    template: 'mannequin',
    animations: {
      idle: { mode: 'v3', action: 'standing ready, breathing calmly', frames: 4 },
      walk: { mode: 'template', template: 'walking-6-frames' },
      attack: { mode: 'pixminimax', action: attack, frames: 8 },
    },
  };
}

/** A jungle monster: idle, run and attack, in public/assets/sprites/monsters/<creatureType> */
function monster(creatureType: string, spec: Omit<SpriteSetSpec, 'key' | 'outputDir'>): SpriteSetSpec {
  return { key: creatureType, outputDir: `${MONSTERS_DIR}/${creatureType}`, ...spec };
}

export const SPRITE_SETS: SpriteSetSpec[] = [
  monster('wolf', {
    name: 'Cinder Hound',
    description: 'a lean dark grey hound beast with glowing ember eyes and smoldering orange cracks along its back, four legs',
    size: 64,
    template: 'dog',
    animations: {
      idle: { mode: 'v3', action: 'standing still, breathing slowly, embers flickering', frames: 4 },
      run: { mode: 'template', template: 'running-6-frames' },
      attack: { mode: 'pixminimax', action: 'crouches, then pounces forward with jaws wide open and snaps shut, then steps back', frames: 8 },
    },
  }),
  monster('spider', {
    name: 'Gloom Crawler',
    description: 'a small dark purple cave spider with eight spiky legs and glowing green eyes',
    size: 48,
    template: 'mannequin',
    animations: {
      idle: { mode: 'v3', action: 'standing still, legs twitching', frames: 4 },
      run: { mode: 'pixminimax', action: 'scuttles forward, its eight legs moving quickly in a looping walk cycle', frames: 8 },
      attack: { mode: 'pixminimax', action: 'rears up its front legs and bites forward with its fangs', frames: 8 },
    },
  }),
  monster('thornspitter', {
    name: 'Thornspitter',
    description: 'a squat carnivorous plant monster on short root legs, a big green bulb head with a wide toothy mouth and thorny leaves',
    size: 64,
    template: 'mannequin',
    animations: {
      idle: { mode: 'v3', action: 'swaying gently, leaves rustling', frames: 4 },
      run: { mode: 'pixminimax', action: 'waddles forward on its root legs in a looping walk cycle', frames: 8 },
      attack: { mode: 'pixminimax', action: 'leans back then spits a glob of green goo forward from its mouth', frames: 8 },
    },
  }),
  monster('blue_buff', {
    name: 'Azure Warden',
    description: 'a huge ancient tortoise with a glowing blue crystal shell and grey stone skin',
    size: 96,
    template: 'bear',
    animations: {
      idle: { mode: 'v3', action: 'standing still, breathing slowly, crystals glowing', frames: 4 },
      run: { mode: 'pixminimax', action: 'walks forward slowly and heavily in a looping walk cycle', frames: 8 },
      attack: { mode: 'pixminimax', action: 'lunges its head far forward out of its shell and snaps its jaws in a powerful bite, then pulls back', frames: 8 },
    },
  }),
  monster('red_buff', {
    name: 'Ember Brute',
    description: 'a hulking hunched brute made of black molten rock with glowing lava cracks and huge fists',
    size: 96,
    template: 'mannequin',
    animations: {
      idle: { mode: 'v3', action: 'standing hunched, breathing heavily, lava glowing', frames: 4 },
      run: { mode: 'template', template: 'walking-6-frames' },
      attack: { mode: 'pixminimax', action: 'raises both fists overhead, slams them into the ground, then stands back up', frames: 8 },
    },
  }),
  monster('dragon', {
    name: 'Dragon',
    description: 'a large four-legged dragon with dark purple scales, folded bat wings, horns and a glowing orange belly',
    size: 128,
    template: 'lion',
    animations: {
      idle: { mode: 'v3', action: 'standing still, breathing slowly, wings shifting', frames: 4 },
      run: { mode: 'pixminimax', action: 'walks forward on four legs in a looping walk cycle, wings folded', frames: 8 },
      attack: { mode: 'pixminimax', action: 'rears its head back then breathes a burst of fire forward', frames: 8 },
    },
  }),
  monster('rootwyrm', {
    name: 'Rootwyrm',
    description: 'a huge ancient four-legged wyrm made of twisted brown tree roots and bark, a mossy green back with small glowing mushrooms, a long root tail and glowing amber eyes',
    size: 128,
    template: 'lion',
    animations: {
      idle: { mode: 'v3', action: 'standing still, breathing slowly, moss and mushrooms glowing softly', frames: 4 },
      run: { mode: 'pixminimax', action: 'walks forward heavily on four root legs in a looping walk cycle', frames: 8 },
      attack: { mode: 'pixminimax', action: 'rears up and slams its root claws down onto the ground in front of it, then settles back', frames: 8 },
    },
  }),
  {
    key: 'vile',
    outputDir: 'public/assets/champs/vile',
    name: 'Vile',
    description: 'a gaunt hooded dark archer in tattered black robes holding a curved bone bow, glowing purple eyes, faint purple soul wisps around him',
    size: 96,
    template: 'mannequin',
    animations: {
      idle: { mode: 'v3', action: 'standing ready with the bow lowered, breathing, purple wisps drifting', frames: 4 },
      walk: { mode: 'template', template: 'walking-6-frames' },
      attack: { mode: 'pixminimax', action: 'draws the bone bow and shoots a dark purple arrow forward', frames: 8 },
      // Black Arrows of Vilix: a charged shot
      q: { mode: 'pixminimax', action: 'slowly draws the bow far back as dark purple energy gathers on the arrow, then releases a powerful shot', frames: 8 },
      // Roots of Vilix: sets a trap
      e: { mode: 'pixminimax', action: 'crouches and presses a glowing purple rune trap into the ground, then stands up', frames: 8 },
      // Restoration of Vilix: transforms
      r: { mode: 'pixminimax', action: 'throws his arms wide and roars as dark purple energy erupts around him', frames: 8 },
    },
  },
  champion('uruk', {
    name: 'Uruk',
    // Less detail on a smaller canvas: chunkier pixels that read at the game's size
    size: 64,
    detail: 'low detail',
    description: 'a tall silver-scaled dragonborn warrior with a dragon head, small horns and amber eyes, wearing silver plate armor with leather straps, holding a long spear with a dark steel blade',
    attack: 'thrusts the spear forward in a quick jab',
    q: 'steps in and lunges far forward with a long powerful spear thrust',
    w: 'spins the spear once and holds it ready as the spear tip glows silver',
    e: 'braces as glowing silver scales harden across his body',
    r: 'leaps high into the air and plunges down driving the spear into the ground',
  }),
  champion('oitboil', {
    name: 'Oitboil',
    size: 64,
    detail: 'low detail',
    description: 'a short stocky green goblin pyromancer with big pointed ears, brass goggles on his forehead, a soot-stained leather apron, a fuel tank on his back and a small flamethrower nozzle strapped to each forearm',
    attack: 'points a forearm nozzle forward and puffs a short burst of flame',
    q: 'crouches and sprays a ring of sparks all around him from both nozzles',
    w: 'raises both arms as cool blue flames wrap around his body',
    e: 'blasts both nozzles backward and rockets forward low to the ground',
    r: 'plants his feet and blasts a long roaring stream of fire forward from both nozzles',
  }),
  champion('elora', {
    name: 'Elora',
    size: 64,
    detail: 'low detail',
    description: 'a lithe human huntress with a dark braid, a hooded forest-green cloak, brown leather armor, a quiver on her back and a tall wooden longbow',
    attack: 'draws her longbow and looses an arrow straight forward',
    q: 'dips an arrow tip in a small green poison vial at her belt and nocks it',
    w: 'draws the longbow all the way back and looses a heavy arrow forward',
    e: 'rolls forward low to the ground and comes up crouching with the bow ready',
    r: 'aims the longbow up high and looses a volley of arrows into the sky',
  }),
  champion('caelum', {
    name: 'Caelum',
    size: 64,
    detail: 'low detail',
    description: 'an old druid with a long white beard, flowing green robes, a crown of leaves and a gnarled wooden staff with a soft glowing light at its tip',
    attack: 'points his staff forward and sends a small bolt of light',
    q: 'thrusts his staff forward and fires a beam of golden light',
    w: 'raises his staff high as swirling green leaves and light rise around it',
    e: 'slams the base of his staff into the ground as roots burst up in front of him',
    r: 'presses a hand to his chest and pours a stream of his own glowing life light forward',
  }),
  champion('fenris', {
    name: 'Fenris',
    size: 64,
    detail: 'low detail',
    description: 'a hulking hunched grey werewolf with ragged dark fur, glowing red eyes, a broken iron chain around his neck and long black claws',
    attack: 'slashes forward with one clawed hand',
    q: 'lunges forward and bites hard with his jaws',
    w: 'rakes a wide sweeping swipe with both claws in front of him',
    e: 'crouches low and pounces forward through the air',
    r: 'throws his head back and howls as a red glow surrounds him',
  }),
  champion('calamitus', {
    name: 'Calamitus',
    size: 64,
    detail: 'low detail',
    description: 'a hulking golem of black cooled rock with glowing orange magma cracks all over, molten lava dripping from his huge fists and a burning core in his chest',
    attack: 'punches forward with a molten fist',
    q: 'slams both fists into the ground as lava bursts up all around him',
    w: 'sweeps one arm forward sending a wave of magma rolling along the ground',
    e: 'hunches and his body hardens into glossy black obsidian',
    r: 'raises both arms high as lava erupts from the ground all around him',
  }),
  champion('protobot', {
    name: 'Protobot 45',
    size: 64,
    detail: 'low detail',
    description: 'a hulking dark blue steel war robot with glowing cyan eyes and seams, the number 45 painted in white on its chest plate, and huge mechanical fists with rocket boosters at the wrists',
    attack: 'punches forward with a heavy steel fist',
    q: 'fires a magnetic claw on a chain forward from its arm and reels it back',
    w: 'crackles with blue electricity as its whole body glows bright',
    e: 'launches its fist forward like a rocket on a burst of flame',
    r: 'raises both arms and releases a big pulse of blue electricity all around',
  }),
  champion('hop', {
    name: 'Hop-To-Eat',
    size: 64,
    detail: 'low detail',
    description: 'a small fluffy white rabbit standing upright on its hind legs, with huge long ears, big innocent pink eyes, tiny sharp fangs, big strong hind feet and a little red scarf',
    attack: 'hops forward and kicks with its big hind foot',
    q: 'lunges forward and bites hard with its sharp front teeth',
    w: 'sits down and munches a big orange carrot happily',
    e: 'hops high up into the air and lands',
    r: 'spins around and delivers a powerful flying kick forward',
  }),
  champion('zhakrul', {
    name: "Zhak'rul",
    size: 64,
    detail: 'low detail',
    description: 'a big armored desert scorpion seen from the side, dark crimson and black carapace plates, two huge heavy pincers, six legs, a long segmented tail curled high over its back ending in a glowing green venom stinger, small glowing green eyes',
    idle: 'standing still on its six legs, tail swaying slowly, pincers clicking',
    walk: 'scuttles forward on its six legs in a looping walk cycle, tail raised high',
    attack: 'snaps forward with one big pincer',
    q: 'snaps both big pincers shut together in front of it like scissors',
    w: 'shakes its tail and puffs out a big cloud of green poison gas all around itself',
    e: 'bursts up out of the sand with both pincers raised, sand flying',
    r: 'strikes forward over its head with its tail, stabbing the glowing green stinger',
  }),
  champion('warrior', {
    name: 'Kael',
    description: 'a young knight in steel plate armor with a blue tabard, holding a longsword and a round steel shield',
    attack: 'swings his longsword in a quick horizontal slash',
    q: 'makes a wide sweeping cleave with the longsword',
    w: 'raises his shield and braces as a pale glow surrounds him',
    e: 'charges forward shield first',
    r: 'leaps up and brings the longsword down in a mighty overhead strike',
  }),
  champion('magnus', {
    name: 'Magnus',
    description: 'a broad-shouldered bearded battlemage in crimson robes with iron pauldrons, face clearly visible, holding a tall staff at his side with a burning orb above his head height',
    attack: 'thrusts the staff forward and fires a small fire bolt',
    q: 'swings the staff and hurls a large fireball forward',
    w: 'plants the staff as a shimmering arcane barrier forms around him',
    e: 'points the staff at the ground, conjuring a swirling pool of mud',
    r: 'raises the staff high and calls down fire from the sky',
  }),
  champion('elara', {
    name: 'Elara',
    description: 'a priestess in white and gold robes with long silver hair, holding a slender golden staff with a glowing crystal',
    attack: 'flicks the staff and fires a small spark of light',
    q: 'raises the staff and releases a soft beam of healing light',
    w: 'extends a hand as a golden shield of light forms',
    e: 'spins gracefully as light swirls around her feet',
    r: 'lifts both arms skyward as a column of radiant light descends',
  }),
  minion(
    'melee',
    'Footman',
    'a small stocky foot soldier in a dented iron helmet and a bright royal blue tabard, holding a short sword and a small round wooden shield',
    'chops forward with the short sword',
  ),
  minion(
    'caster',
    'Acolyte',
    'a small hooded apprentice mage in a bright royal blue robe, holding a short wooden wand with a glowing white tip',
    'flicks the wand forward and casts a small magic bolt',
  ),
  minion(
    'siege',
    'Gunner',
    'a squat heavily armored soldier with a bright royal blue sash, carrying a stubby bronze hand cannon on the shoulder',
    'braces and fires the shoulder cannon with a burst of smoke, recoiling back',
  ),
  champion('vex', {
    name: 'Vex',
    description: 'a lithe masked ninja assassin in dark violet and black garb with a hood and a long trailing scarf, glowing violet eyes, a short curved blade in one hand',
    attack: 'slashes quickly with the short curved blade',
    q: 'throws a spinning shuriken forward with a flick of the wrist',
    w: 'crouches low and vanishes into a swirl of dark violet smoke',
    e: 'dashes forward in a low blur, scarf streaming behind',
    r: 'draws a second blade and takes a fierce ninja stance as violet energy flares around the body',
  }),
  champion('gorath', {
    name: 'Gorath',
    description: 'a stout stone guardian in heavy stone-plated armor with a braided beard and glowing amber runes, carrying a huge stone hammer',
    attack: 'swings the stone hammer down in a heavy blow',
    q: 'raises the hammer and slams it into the ground, cracking the earth',
    w: 'plants his feet as stone plates harden over his body',
    e: 'pounds his chest and roars a challenge',
    r: 'leaps and smashes the hammer into the ground with both hands, sending out a shockwave',
  }),
];

interface ManifestEntry {
  characterId?: string;
  animations: Record<string, string>;
}
type Manifest = Record<string, ManifestEntry>;

interface Options {
  only: string[] | null;
  redo: string[];
  newCharacter: boolean;
  seed: number;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { only: null, redo: [], newCharacter: false, seed: 7 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') options.only = argv[++i].split(',');
    else if (argv[i] === '--redo') options.redo = argv[++i].split(',');
    else if (argv[i] === '--new-character') options.newCharacter = true;
    else if (argv[i] === '--seed') options.seed = Number(argv[++i]);
  }
  return options;
}

const apiKey = process.env.PIXELLAB_API_KEY;

async function api<T>(path: string, body?: unknown): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${API}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    // PixelLab answers 429 past a few jobs at once: wait for a slot
    if (response.status === 429 && attempt < 30) {
      await sleep(15_000);
      continue;
    }
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
    return response.json() as Promise<T>;
  }
}

async function waitForJob(jobId: string, label: string): Promise<void> {
  const started = Date.now();
  for (;;) {
    const job = await api<{ status: string; last_response?: unknown }>(`/background-jobs/${jobId}`);
    if (job.status === 'completed') {
      log(`${label} done in ${Math.round((Date.now() - started) / 1000)}s`);
      return;
    }
    if (job.status !== 'processing') throw new Error(`${label} ${job.status}: ${JSON.stringify(job.last_response)}`);
    await sleep(10_000);
  }
}

async function createCharacter(spec: SpriteSetSpec, seed: number): Promise<string> {
  log(`${spec.name}: creating the character`);
  const created = await api<{ character_id: string; background_job_id: string }>('/create-character-v3', {
    description: spec.description,
    image_size: { width: spec.size, height: spec.size },
    view: 'low top-down',
    template_id: spec.template,
    ...(spec.detail ? { detail: spec.detail } : {}),
    seed,
  });
  await waitForJob(created.background_job_id, `${spec.name} character`);
  return created.character_id;
}

async function createAnimation(characterId: string, spec: SpriteSetSpec, name: string, seed: number): Promise<string> {
  const animation = spec.animations[name];
  const body: Record<string, unknown> = {
    character_id: characterId,
    animation_name: name,
    directions: ['east'],
    seed,
  };
  if (animation.mode === 'template') {
    Object.assign(body, { mode: 'template', template_animation_id: animation.template });
  } else {
    Object.assign(body, { mode: animation.mode, action_description: animation.action, frame_count: animation.frames });
    if (animation.mode === 'pixminimax') body.subject_description = spec.description;
  }
  log(`${spec.name}: animating ${name} (${animation.mode})`);
  const created = await api<{ animation_group_id: string; background_job_ids: string[] }>('/characters/animations', body);
  await waitForJob(created.background_job_ids[0], `${spec.name} ${name}`);
  return created.animation_group_id;
}

interface CharacterDetail {
  animations: { animation_group_id: string; directions: { direction: string; frames: string[] }[] }[];
}

async function downloadFrames(characterId: string, groupId: string): Promise<RgbaImage[]> {
  const character = await api<CharacterDetail>(`/characters/${characterId}`);
  const animation = character.animations.find(a => a.animation_group_id === groupId);
  const east = animation?.directions.find(d => d.direction === 'east');
  if (!east) throw new Error(`Animation ${groupId} has no east frames`);
  return Promise.all(east.frames.map(async url => {
    // The file host rejects some default user agents
    const response = await fetch(url, { headers: { 'User-Agent': 'curl/8' } });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return decodePng(new Uint8Array(await response.arrayBuffer()));
  }));
}

/**
 * Lay out each animation's frames side by side on a square canvas shared by
 * all of them, centered, with every animation's feet on the idle's row.
 */
function buildStrips(animations: Record<string, RgbaImage[]>): Record<string, RgbaImage> {
  const canvas = Math.max(...Object.values(animations).flat().map(frame => Math.max(frame.width, frame.height)));
  const centered = (frame: RgbaImage, dy = 0) => {
    const out = createImage(canvas, canvas);
    blit(out, frame, Math.floor((canvas - frame.width) / 2), Math.floor((canvas - frame.height) / 2) + dy);
    return out;
  };
  const feetRow = (frames: RgbaImage[]) => Math.max(...frames.map(frame => bottomRow(centered(frame))));
  const idleFeet = feetRow(animations.idle);

  const strips: Record<string, RgbaImage> = {};
  for (const name of Object.keys(animations)) {
    const frames = animations[name];
    const dy = idleFeet - feetRow(frames);
    const strip = createImage(canvas * frames.length, canvas);
    frames.forEach((frame, i) => blit(strip, centered(frame, dy), i * canvas, 0));
    strips[name] = strip;
  }
  return strips;
}

async function generateSpriteSet(spec: SpriteSetSpec, manifest: Manifest, options: Options): Promise<void> {
  const entry = (manifest[spec.key] ??= { animations: {} });
  const names = Object.keys(spec.animations);
  if (!entry.characterId || options.newCharacter) {
    entry.characterId = await createCharacter(spec, options.seed);
    entry.animations = {};
    saveManifest(manifest);
  }
  const characterId = entry.characterId;

  // Missing animations, at the same time
  await Promise.all(names.map(async name => {
    if (entry.animations[name] && !options.redo.includes(name)) return;
    entry.animations[name] = await createAnimation(characterId, spec, name, options.seed);
    saveManifest(manifest);
  }));

  const frames: Record<string, RgbaImage[]> = {};
  for (const name of names) {
    frames[name] = await downloadFrames(characterId, entry.animations[name]);
  }
  const strips = buildStrips(frames);
  mkdirSync(spec.outputDir, { recursive: true });
  for (const name of names) {
    writeFileSync(join(spec.outputDir, `${name}.png`), encodePng(strips[name]));
  }
  log(`${spec.name}: wrote ${spec.outputDir} (${names.map(name => `${name} ${frames[name].length}`).join(', ')} frames, ${strips.idle.height}px)`);
}

function loadManifest(): Manifest {
  return existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : {};
}

function saveManifest(manifest: Manifest): void {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

function log(message: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  if (!apiKey) throw new Error('Set PIXELLAB_API_KEY (for example in .env.local)');
  const options = parseArgs(process.argv.slice(2));
  const manifest = loadManifest();
  const sets = SPRITE_SETS.filter(spec => !options.only || options.only.includes(spec.key));

  // Sets one at a time: their animations already run several jobs at once
  for (const spec of sets) {
    try {
      await generateSpriteSet(spec, manifest, options);
    } catch (error) {
      log(`${spec.name} failed: ${(error as Error).message}`);
    }
  }
}

await main();
