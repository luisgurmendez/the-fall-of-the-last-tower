/**
 * Generates animated sprites with PixelLab (https://api.pixellab.ai/v2): the
 * jungle monsters, the champions without hand-made art and their summons.
 *
 * For each sprite set: a PixelLab character (its look), then its animations
 * facing east (the game mirrors them to face west) and, for a set with more
 * directions, facing south and north too. Each animation's frames go side by
 * side in <outputDir>/<animation>.png (<animation>_south.png and
 * <animation>_north.png for the other directions), on a square canvas shared
 * by all of the set's strips with the feet on the idle's row, so switching
 * animations or turning doesn't make the character jump. The renderer reads
 * the frame size from the strip's height and the frame count from its width.
 *
 * What keeps the frames clean:
 * - Effects aren't drawn into the sprites (the game draws its own): the
 *   descriptions only say how the body moves
 * - A set with `reference` is made from a south-facing look picked from a few
 *   create-image-pixen takes, or a PNG in scripts/references/ (made or edited
 *   elsewhere), so all its directions are really that look; `directionImages`
 *   gives its other directions as drawn
 * - `lockPalette` keeps every frame on the character's own colors
 * - A looping animation (idle, walk) is drawn back to its first pose
 * - `dropDetached` leaves out bits not joined to the body (rubble, a bone in
 *   flight), and `feetFromFirstFrame` keeps a strip whose hands reach the
 *   ground in front of the feet from being lifted
 * - A direction can be told more than the action: seen from behind, told to
 *   strike "forward", a character turns around to face the viewer
 * - Each run prints a check of every strip: frames that lost part of the
 *   body (a missing foot), that grew something (an effect, a cloud) or that
 *   jump from the one before. Look at them on the contact sheets --review
 *   writes (a character turning around mid-animation only shows there) and
 *   redo the bad ones with another seed (--redo).
 *
 * scripts/sprites.json keeps each set's character and animation ids (one
 * PixelLab animation holds all of its directions): a later run reuses them
 * and only generates what's missing.
 *
 * Usage (from the repo root; Bun loads PIXELLAB_API_KEY from .env.local):
 *   bun scripts/generate-sprites.ts                  # every set
 *   bun scripts/generate-sprites.ts --only spider    # some sets
 *   bun scripts/generate-sprites.ts --only spider --redo attack --seed 8
 *     # generate those animations again, in every direction (another seed gives another take)
 *   bun scripts/generate-sprites.ts --only spider --new-character
 *   bun scripts/generate-sprites.ts --only hop --new-character --character-only --review /tmp/review
 *     # only the character, to look at it facing every direction before animating it
 *   bun scripts/generate-sprites.ts --only zhakrul --review /tmp/review
 *     # also write a contact sheet of every strip, scaled up, and the check
 *
 * A character takes about 3 minutes, an animation 1-5 minutes. On 2026-11-01
 * at 64px a character turned from a reference cost about USD 0.04 and an
 * animation about USD 0.01 per direction.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blit, bottomRow, createImage, decodePng, encodePng, type RgbaImage } from './lib/png';

const API = 'https://api.pixellab.ai/v2';
const MANIFEST_PATH = 'scripts/sprites.json';
const MONSTERS_DIR = 'public/assets/sprites/monsters';
const MINIONS_DIR = 'public/assets/sprites/minions';
const SUMMONS_DIR = 'public/assets/sprites/summons';
const FX_DIR = 'public/assets/sprites/fx';

/** The directions a set can be animated in; west is east mirrored */
type Direction = 'east' | 'south' | 'north';

/** A south-facing look: a create-image-pixen take, or a PNG file (from the repo root) */
type Reference = { description: string; seed: number } | { file: string };

type AnimationSpec =
  /** Drawn frame by frame from a description (4-16 frames); a loop is drawn back to its first pose */
  | { mode: 'v3'; action: string; frames: number; loop?: boolean }
  /** Drawn from a description on PixMiniMax (multiple of 4 frames); a loop is drawn back to its first pose */
  | { mode: 'pixminimax'; action: string; frames: number; loop?: boolean }
  /** A PixelLab skeleton animation (needs a matching character template) */
  | { mode: 'template'; template: string }
  /** The character standing still, one frame (its look facing that way): nothing to draw */
  | { mode: 'still' };

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
  /** Directions its animations face (default east only); a set facing one way writes <animation>.png */
  directions?: Direction[];
  /**
   * Its south-facing look: the character is turned from it. A create-image-pixen
   * take (the description and the seed of the one picked) or a PNG made
   * elsewhere. Without it, PixelLab draws the character from the description.
   */
  reference?: Reference;
  /**
   * PNGs of its look facing other ways (on the reference's canvas), used as
   * drawn: PixelLab only draws the directions missing. East mirrored is west.
   */
  directionImages?: { east?: string; north?: string };
  /** Draw every frame with the character's own colors only */
  lockPalette?: boolean;
  /**
   * Line each strip up by its first frame, the character standing, not by its
   * lowest pixel: for a set whose hands reach the ground in front of its feet
   * (lower on screen), which would lift the whole strip
   */
  feetFromFirstFrame?: boolean;
  /**
   * Leave out pieces of a frame not joined to the body, up to this many
   * pixels: rubble or a thrown bone PixelLab drew, which the game draws itself
   */
  dropDetached?: number;
  /**
   * The same, for some animations only (by animation name): a ground effect
   * drawn in front of the feet, or an arrow in flight, where the set has
   * detached bits of its own to keep elsewhere (Vile's soul wisps)
   */
  dropDetachedIn?: Record<string, number>;
  /** With lockPalette, colors besides the character's that its animations need (a prop it pulls out) */
  paletteExtras?: string[];
  /**
   * An animation's action facing one way, by manifest key (q@north), where
   * the hint isn't enough: told to bite seen from behind, Hop turned round
   * to show its teeth
   */
  directionActions?: Record<string, string>;
  /**
   * The frames to keep (first and last) of strips where only part of what
   * PixelLab drew fits, by manifest key (e, e@south)
   */
  trim?: Record<string, [number, number]>;
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
  /** Facing south and north too (the four-direction champions) */
  directions?: Direction[];
  reference?: Reference;
  directionImages?: SpriteSetSpec['directionImages'];
  feetFromFirstFrame?: boolean;
  trim?: Record<string, [number, number]>;
  paletteExtras?: string[];
  directionActions?: Record<string, string>;
  dropDetachedIn?: Record<string, number>;
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
 * A four-direction champion idles on PixMiniMax too, its eight frames looping.
 */
function champion(championId: string, actions: ChampionActions): SpriteSetSpec {
  const cast = (action: string): AnimationSpec => ({ mode: 'pixminimax', action, frames: 8 });
  const idle = actions.idle ?? 'standing ready, breathing calmly';
  return {
    key: championId,
    outputDir: `public/assets/champs/${championId}`,
    name: actions.name,
    description: actions.description,
    size: actions.size ?? 96,
    detail: actions.detail,
    template: 'mannequin',
    directions: actions.directions,
    reference: actions.reference,
    directionImages: actions.directionImages,
    feetFromFirstFrame: actions.feetFromFirstFrame,
    lockPalette: actions.directions !== undefined,
    paletteExtras: actions.paletteExtras,
    directionActions: actions.directionActions,
    trim: actions.trim,
    dropDetachedIn: actions.dropDetachedIn,
    animations: {
      idle: actions.directions
        ? { mode: 'pixminimax', action: idle, frames: 8, loop: true }
        : { mode: 'v3', action: idle, frames: 4 },
      walk: actions.walk
        ? { mode: 'pixminimax', action: actions.walk, frames: 8, loop: actions.directions !== undefined }
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

/**
 * A champion's summon (key <championId>_<name>): idle, walk, attack and its
 * own casts, in public/assets/sprites/summons/<name>, in four directions like
 * the champions made from a reference, on its colors only.
 */
function summon(
  championId: string,
  name: string,
  spec: Omit<SpriteSetSpec, 'key' | 'outputDir' | 'template' | 'directions' | 'lockPalette' | 'animations'> & {
    idle: string;
    walk: string;
    attack: string;
    casts?: Record<string, string>;
  },
): SpriteSetSpec {
  const { idle, walk, attack, casts, ...look } = spec;
  return {
    key: `${championId}_${name}`,
    outputDir: `${SUMMONS_DIR}/${name}`,
    template: 'mannequin',
    directions: ['east', 'south', 'north'],
    lockPalette: true,
    feetFromFirstFrame: true,
    ...look,
    animations: {
      idle: { mode: 'pixminimax', action: idle, frames: 8, loop: true },
      walk: { mode: 'pixminimax', action: walk, frames: 8, loop: true },
      attack: { mode: 'pixminimax', action: attack, frames: 8 },
      ...Object.fromEntries(Object.entries(casts ?? {}).map(([cast, action]) => [cast, { mode: 'pixminimax', action, frames: 8 } as AnimationSpec])),
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
    // The rune trap he presses down and the arrow in flight are the game's (where they really are): not drawn
    dropDetachedIn: { e: 600, attack: 200, q: 200 },
    animations: {
      idle: { mode: 'v3', action: 'standing ready with the bow lowered, breathing, purple wisps drifting', frames: 4 },
      walk: { mode: 'template', template: 'walking-6-frames' },
      attack: { mode: 'pixminimax', action: 'draws the bone bow and shoots a dark purple arrow forward', frames: 8 },
      // Black Arrows of Vilix: a charged shot
      q: { mode: 'pixminimax', action: 'slowly draws the bow far back as dark purple energy gathers on the arrow, then releases a powerful shot', frames: 8 },
      // Roots of Vilix: sets a trap
      e: { mode: 'pixminimax', action: 'crouches and presses a glowing purple rune trap into the ground, then stands up', frames: 8 },
      // Veil of Darkness: wraps himself in shadow (stealthed, rooted, untouchable: the game fades him and draws the veil)
      w: { mode: 'pixminimax', action: 'pulls his tattered black cloak tightly around his body with one arm and crouches low, then holds still, hidden in it', frames: 8 },
      // Restoration of Vilix: transforms. Only the body moves (the eruption is the game's VFX):
      // the first take drew a huge purple disk over him, cut by the canvas
      r: { mode: 'pixminimax', action: 'spreads his arms wide and throws his head back, his tattered cloak billowing, then lowers his arms, standing tall', frames: 8 },
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
    // Only the body (the game draws the cone of fire from the nozzles): the first take drew the stream, cut by the canvas
    r: 'plants his feet wide and leans forward bracing hard, both forearm nozzles pointed straight ahead and shaking from the recoil',
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
    // Turned from a look holding his staff: the first character had none, so every animation
    // started without it and drew it in a few frames later (it flickered on every attack)
    reference: {
      description: 'an old druid standing facing the viewer, a long white beard, flowing green robes, a crown of leaves, holding a tall gnarled wooden staff upright in his right hand, the staff as tall as he is with a soft glowing light at its tip, no effects',
      seed: 3,
    },
    // His bolt in flight and roots drawn at his feet are the game's (where they really go): not drawn
    dropDetachedIn: { attack: 200, e: 600 },
    // He holds his staff in every animation (the first idle and walk drew him without it)
    idle: 'standing ready holding his gnarled wooden staff upright beside him, breathing calmly',
    walk: 'walks forward at a calm pace, leaning on his gnarled wooden staff, in a looping walk cycle',
    attack: 'points his staff forward and sends a small bolt of light',
    // Only the staff's thrust (the ray is the game's projectile): the first take drew a burst of light, cut by the canvas
    q: 'thrusts his gnarled staff straight forward with both hands and holds it there, the staff tip glowing',
    w: 'raises his staff high as swirling green leaves and light rise around it',
    // Only the slam (the roots are the game's, rising where they're aimed)
    e: 'raises his staff high and slams its base down into the ground with both hands, leaning on it',
    r: 'presses a hand to his chest and pours a stream of his own glowing life light forward',
  }),
  champion('fenris', {
    name: 'Fenris',
    size: 64,
    detail: 'low detail',
    description: 'a hulking hunched grey werewolf with ragged dark fur, glowing red eyes, a broken iron chain around his neck and long black claws',
    attack: 'slashes forward with one clawed hand',
    q: 'lunges forward and bites hard with his jaws',
    // Not his attack's one-handed slash: both arms, a wide sweep
    w: 'rears up and brings both clawed arms down and across in one wide two-handed sweep in front of him, his body twisting into it',
    e: 'crouches low and pounces forward through the air',
    // No glow (it gets baked in as a flat red blob): the game draws his red rage
    r: 'throws his head back and howls up at the sky, chest out and arms spread wide',
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
    // Body only (an effect asked for gets baked into the frames: a flat glow, a ring cut by the canvas);
    // the game draws its electricity and pulse
    w: 'braces with its shoulders back and fists clenched at its sides, powering up, its chest swelling',
    e: 'launches its fist forward like a rocket on a burst of flame',
    r: 'raises both arms high above its head, then throws them out wide to the sides, bracing its legs',
  }),
  // Four directions too. Its first take turned to face the viewer to eat and
  // spun round for its kick: nothing turns now
  champion('hop', {
    name: 'Hop-To-Eat',
    size: 64,
    detail: 'low detail',
    directions: ['east', 'south', 'north'],
    reference: {
      description: 'a small fluffy white rabbit standing upright on its hind legs facing the viewer, huge long ears with pink insides, big innocent pink eyes, tiny sharp fangs, big strong hind feet and a little red scarf, no effects',
      seed: 13,
    },
    // Its carrot's orange and green
    paletteExtras: ['#e8741c', '#f59a3a', '#b4531a', '#5aa83c', '#3a7a28'],
    // Told to bite or kick seen from behind, it turned round to show its face;
    // its bite from behind doesn't mention its teeth
    directionActions: {
      'q@north': 'seen from behind, its head darts forward away from the viewer with its ears flattening back, then it pulls back, only its back, ears and fluffy tail visible the whole time',
      'r@north': 'seen from behind, leaps away from the viewer into a flying kick with one hind leg stretched far out, only its back, ears and fluffy tail visible the whole time',
    },
    description: 'a small fluffy white rabbit with huge long ears, big innocent pink eyes, tiny sharp fangs, big strong hind feet and a little red scarf',
    idle: 'sitting up on its hind legs, breathing softly, ears twitching a little, nose wiggling',
    walk: 'hops forward on its big hind feet in a looping hop cycle, ears bouncing',
    attack: 'hops forward and kicks with one big hind foot, then lands back where it was',
    q: 'lunges forward and bites hard with its sharp front teeth, then pulls back',
    w: 'holds a big orange carrot in its front paws and munches it happily',
    e: 'crouches, then hops high up into the air and lands on its hind feet',
    r: 'leaps forward in a powerful flying kick with one hind leg stretched far out, then lands',
  }),
  // The first four-direction champion. Its first take had a glowing venom
  // stinger, drawn dripping in every frame: the stinger is plain now, and the
  // actions only move the body (the game draws the poison).
  champion('zhakrul', {
    name: "Zhak'rul",
    size: 64,
    detail: 'low detail',
    directions: ['east', 'south', 'north'],
    reference: {
      description: 'a big armored desert scorpion facing the viewer, dark crimson and black carapace plates, two huge heavy pincers held forward, six legs, a long segmented tail curled up over its back ending in a dark curved stinger, small green eyes, no glow, no effects',
      seed: 14,
    },
    description: 'a big armored desert scorpion with crimson and black carapace plates, two huge heavy pincers, six legs and a long segmented tail curled over its back ending in a dark curved stinger',
    idle: 'standing still on its six legs, breathing slowly, pincers opening and closing a little, tail swaying gently',
    walk: 'walks forward on its six legs in a looping walk cycle, the legs stepping in alternating waves, tail held high',
    attack: 'jabs forward with one big pincer and snaps it shut, then pulls it back',
    q: 'lunges forward and snaps both big pincers shut together like scissors, then pulls back',
    w: 'rears up and shakes its raised tail hard, its whole body trembling, then settles back down',
    // Out of the ground, but not told so: told to burst out of the sand, it
    // drew the dirt, in its own reds (lockPalette). The game draws the earth.
    e: 'rears up high with both pincers raised wide open, then slams them down in front of it and settles on its six legs',
    r: 'arches its tail and stabs the stinger forward over its head, then pulls the tail back',
  }),
  // A scrappy kid with a bow too big for him, out to prove he's the best.
  // His first takes (a blond boy in a blue tunic) looked like another game's
  // hero: the look is our own now (curls, headband, orange cape, purple sash)
  champion('kip', {
    name: 'Kip',
    size: 64,
    detail: 'low detail',
    directions: ['east', 'south', 'north'],
    reference: {
      description: 'a cocky small teenage boy archer standing facing the viewer, messy dark brown curly hair with a white headband whose long tails flutter, freckles and a big grin, a short burnt-orange hooded cape with the hood down, a cream shirt with a purple sash, olive shorts, bandaged forearms, sandals, and an oversized wooden longbow taller than him held upright in one hand, no effects',
      seed: 21,
    },
    // Told to shoot seen from behind, he turned sideways (shooting west) or
    // round to grin at the viewer: his north shots say where the bow points
    directionActions: {
      'attack@north': 'seen from behind, raises the oversized longbow straight up in front of him, draws the string back and looses an arrow straight up away from the viewer, only his back, cape and headband knot visible the whole time',
      'q@north': 'seen from behind, quickly raises the oversized longbow in front of him, draws and shoots an arrow straight up away from the viewer, only his back, cape and headband knot visible the whole time',
      'w@north': 'seen from behind, thrusts the longbow up high away from the viewer and pumps his other fist, only his back, cape and headband knot visible the whole time',
    },
    description: 'a cocky small teenage boy archer with messy dark brown curly hair, a white headband with long tails, freckles, a short burnt-orange hooded cape with the hood down, a cream shirt with a purple sash, olive shorts, bandaged forearms, sandals and an oversized wooden longbow taller than him',
    idle: 'standing with the oversized longbow upright at his side, bouncing on his heels impatiently, breathing',
    walk: 'walks forward in a looping walk cycle with a cocky swagger, the longbow held at his side',
    attack: 'draws the oversized longbow and looses an arrow straight forward',
    q: 'quickly draws the longbow and shoots an arrow straight forward with a showy flourish of the bow',
    w: 'points his bow forward and pumps his other fist, grinning',
    e: 'leaps forward high in a showy jump and lands crouching with the bow ready',
    r: 'draws and looses the longbow forward again and again, rapidly, several shots one after another',
  }),
  // The look the user picked, a ghoul drawn in SpriteFusion
  // (references/nocthar_original.png), without the tombstone on its back: that
  // drawing is his east as drawn (nocthar_east.png, the tombstone's pixels cut
  // out), and his south an edit of it turned to face the viewer
  // (edit-image-pixen, seed 1). Medium detail,
  // like the drawing: the low-detail champions above read blurry next to it.
  // Seen from behind, a strike "forward" turns a character round: his north
  // says where his hands go.
  champion('nocthar', {
    name: 'Nocthar',
    size: 64,
    directions: ['east', 'south', 'north'],
    reference: { file: 'scripts/references/nocthar_south.png' },
    directionImages: { east: 'scripts/references/nocthar_east.png' },
    // His Q and R put his hands on the ground in front of his feet
    feetFromFirstFrame: true,
    directionActions: {
      'attack@north': 'seen from behind, flicks one long clawed hand up and forward away from the viewer in a quick throwing motion, then pulls it back, only its back, white hair and the back of its head visible the whole time',
      'q@north': 'seen from behind, raises both clawed hands and slams them down onto the ground in front of it, away from the viewer, then straightens up, only its back, white hair and the back of its head visible the whole time',
      // Told to throw its head back, it showed its face
      'w@north': 'seen from behind, spreads its long arms wide and lifts its head up toward the sky, its face hidden, only its back, the back of its head and its white hair visible the whole time',
      'e@north': 'seen from behind, raises one long arm and points a clawed finger straight ahead away from the viewer, only its back, white hair and the back of its head visible the whole time',
      'r@north': 'seen from behind, crouches and drives both long arms down into the ground in front of it, away from the viewer, then holds there straining, only its back, white hair and the back of its head visible the whole time',
    },
    description: 'a tall hunched grey-green undead ghoul with rotting skin, a skull-like face with pale eyes and bared teeth, wispy white hair strands, exposed ribs, a torn brown loincloth, very long thin arms and huge brown dirt-caked claws',
    idle: 'stands hunched, swaying slightly, its long clawed fingers twitching',
    walk: 'shambles forward in a looping lurching walk, dragging its feet, long arms swinging loosely',
    attack: 'flicks one long clawed hand forward in a quick throwing motion, then pulls it back',
    q: 'raises both clawed hands and slams them down onto the ground in front of it, then straightens up',
    w: 'throws its head back with its mouth wide open, wailing, its long arms spread wide',
    e: 'raises one long arm and points a clawed finger forward, commanding',
    r: 'crouches and drives both long arms down into the ground in front of it, then holds there straining and trembling',
  }),
  // Nocthar's army. Both looks are generate-image-v2 takes in his drawing's
  // style, south-facing: the colossus made of bones and grave dirt, then the
  // Hollow in the colossus's style (Hollows fuse into it), with pale eyes
  // dotted in. The big Hollow is the same sprite drawn bigger. The colossus
  // rises out of the ground through the game's clipping, without an animation.
  // Turned by PixelLab, the colossus's east was a side view, a column of bones
  // with its skull hidden: its east is an edit of its look turned to the right,
  // and its north the back PixelLab drew the first time (the second had ribs).
  summon('nocthar', 'hollow', {
    name: 'Hollow',
    size: 48,
    reference: { file: 'scripts/references/nocthar_hollow_south.png' },
    directionActions: {
      'attack@north': 'seen from behind, rears back and rakes one bony claw forward away from the viewer in a quick swipe, then pulls back, only its back, spine and the back of its skull visible the whole time',
    },
    description: 'a small skinny hunched skeletal ghoul made of grey-white bones caked with dried grave dirt, a cracked skull with small pale eyes, long thin bony arms with long bony claws, scraps of brown burial cloth around its waist',
    idle: 'stands hunched with its bony claws raised, swaying a little, its fingers twitching',
    walk: 'skitters forward quickly in a looping hunched run, its bony arms held low',
    attack: 'rears back and rakes one bony claw forward in a quick swipe, then pulls back',
  }),
  summon('nocthar', 'colossus', {
    name: 'Colossus of Bones',
    size: 96,
    reference: { file: 'scripts/references/nocthar_colossus_south.png' },
    directionImages: { east: 'scripts/references/nocthar_colossus_east.png', north: 'scripts/references/nocthar_colossus_north.png' },
    // Its slams drew rubble, its throw the bone in flight
    dropDetached: 120,
    directionActions: {
      'attack@north': 'seen from behind, raises both enormous fists high overhead and slams them down onto the ground in front of it, away from the viewer, then straightens up, only its back and the bones jutting from it visible the whole time',
      'w@north': 'seen from behind, reaches over its shoulder with one huge hand, rips a long bone off its own back and hurls it overhand away from the viewer, then straightens up, only its back visible the whole time',
      'e@north': 'seen from behind, lowers its head, scrapes the ground with one foot, then lunges forward head first away from the viewer, only its back visible the whole time',
    },
    description: 'a huge hulking hunched colossus made of hundreds of fused grey-white bones and packed brown grave dirt, a giant skull head sunk between massive shoulders, rib bones like armor plates, long bones jutting from its back, enormous bone fists and scraps of brown burial cloth',
    idle: 'stands hunched, breathing heavily, its huge shoulders slowly rising and falling',
    walk: 'stomps forward heavily in a looping walk cycle, its enormous fists swinging',
    attack: 'raises both enormous fists high overhead and slams them down onto the ground in front of it, then straightens up',
    casts: {
      w: 'reaches back over its shoulder with one huge hand, rips a long bone off its own back and hurls it forward overhand, then straightens up',
      e: 'lowers its head, scrapes the ground with one foot like a bull, then lunges forward head first',
    },
  }),
  // Nocthar's Q: one of the hands that grab out of the earth (the game draws
  // the dirt and clips the sprite at the ground line). A generate-image-v2
  // take in the Hollow's style. It only faces the viewer: its other
  // directions are the same drawing, so PixelLab draws none of them
  {
    key: 'nocthar_hand',
    outputDir: `${FX_DIR}/nocthar_hand`,
    name: 'Grasping Hand',
    description: 'a single skeletal bony hand standing upright, palm facing the viewer, long thin bony fingers pointing up, a short bony forearm below the wrist, grey-white bone with a little dried grave dirt and a scrap of brown burial cloth around the wrist',
    size: 48,
    template: 'mannequin',
    directions: ['south'],
    reference: { file: 'scripts/references/nocthar_hand_south.png' },
    directionImages: { east: 'scripts/references/nocthar_hand_south.png', north: 'scripts/references/nocthar_hand_south.png' },
    lockPalette: true,
    feetFromFirstFrame: true,
    // Its 9 frames end on 5 of the same closed claw
    trim: { 'grab@south': [0, 7] },
    animations: {
      idle: { mode: 'still' },
      grab: { mode: 'pixminimax', action: 'the open hand snaps its long bony fingers shut into a tight grabbing claw, then holds the closed claw still, the wrist staying in place', frames: 8 },
    },
  },
  champion('warrior', {
    name: 'Kael',
    description: 'a young knight in steel plate armor with a blue tabard, holding a longsword and a round steel shield',
    attack: 'swings his longsword in a quick horizontal slash',
    // Redone 2026-11-04: the old take's sweep ran off the frame
    q: 'steps in and makes a wide horizontal sweep with the longsword in front of him, then recovers',
    w: 'raises his shield and braces as a pale glow surrounds him',
    e: 'charges forward shield first',
    r: 'leaps up and brings the longsword down in a mighty overhead strike',
  }),
  champion('magnus', {
    name: 'Magnus',
    description: 'a broad-shouldered bearded battlemage in crimson robes with iron pauldrons, face clearly visible, holding a tall staff at his side with a burning orb above his head height',
    attack: 'thrusts the staff forward and fires a small fire bolt',
    // Redone 2026-11-04: the old take drew its own fireball over him as the game's flew off
    q: 'swings the staff forward in an overhand arc and points it straight ahead, then pulls it back',
    w: 'plants the staff as a shimmering arcane barrier forms around him',
    e: 'points the staff at the ground, conjuring a swirling pool of mud',
    // Redone 2026-11-04: Inferno Zone falls far away; the old take burned around his feet
    r: 'raises the staff high above his head with both hands and looks up at the sky, then sweeps it down to point forward',
  }),
  champion('elara', {
    name: 'Elara',
    description: 'a priestess in white and gold robes with long silver hair, holding a slender golden staff with a glowing crystal',
    attack: 'flicks the staff and fires a small spark of light',
    // Redone 2026-11-04 with the body's motion only (the game draws the light): the old takes
    // drew a beam, a shield and a pillar into the frames, and the pillar ran off the top
    q: 'raises the staff and points it gently forward at an ally, then lowers it',
    w: 'steps forward and holds the open palm of her free hand out toward an ally',
    e: 'spins gracefully once on the spot, robes swirling',
    r: 'raises the golden staff straight up above her head with both arms fully stretched toward the sky, holds it there looking up, then lowers it',
    feetFromFirstFrame: true,
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
    // Redone 2026-11-04: the old take's violet arc ran off the frame
    r: 'draws a second curved blade from his back and drops into a low two-blade fighting stance',
  }),
  champion('gorath', {
    name: 'Gorath',
    description: 'a stout stone guardian in heavy stone-plated armor with a braided beard and glowing amber runes, carrying a huge stone hammer',
    attack: 'swings the stone hammer down in a heavy blow',
    // Redone 2026-11-04 with the body's motion only, lined up by the standing frame: the old
    // slams drew cracks below his feet, which lifted the strip and cut the raised hammer off
    q: 'raises the stone hammer high over his head with both hands, then slams it down into the ground in front of him',
    w: 'crosses his arms over his chest and bows his head, bracing his whole body',
    e: 'throws his head back and arms wide and roars a challenge',
    r: 'lifts the stone hammer far behind his head with both hands, then smashes it straight down into the ground with all his strength',
    feetFromFirstFrame: true,
  }),
];

interface ManifestEntry {
  characterId?: string;
  /** Animation ids by name, each with all of the set's directions */
  animations: Record<string, string>;
}
type Manifest = Record<string, ManifestEntry>;

interface Options {
  only: string[] | null;
  redo: string[];
  newCharacter: boolean;
  seed: number;
  /** Where to write the contact sheets and checks, if anywhere */
  review: string | null;
  /** Stop after the character, to look at its rotations before animating it */
  characterOnly: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { only: null, redo: [], newCharacter: false, seed: 7, review: null, characterOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') options.only = argv[++i].split(',');
    else if (argv[i] === '--redo') options.redo = argv[++i].split(',');
    else if (argv[i] === '--new-character') options.newCharacter = true;
    else if (argv[i] === '--seed') options.seed = Number(argv[++i]);
    else if (argv[i] === '--review') options.review = argv[++i];
    else if (argv[i] === '--character-only') options.characterOnly = true;
  }
  return options;
}

const apiKey = process.env.PIXELLAB_API_KEY;
/** Animations made at once, each a job per direction (PixelLab answers 429 past a few jobs at once) */
const CONCURRENT_ANIMATIONS = 3;

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

function base64Image(image: RgbaImage): { type: 'base64'; base64: string } {
  return { type: 'base64', base64: `data:image/png;base64,${Buffer.from(encodePng(image)).toString('base64')}` };
}

function pngFileBase64(path: string): string {
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`;
}

/** The set's south-facing look: the PNG or the create-image-pixen take its reference names */
async function referenceImage(spec: SpriteSetSpec, reference: Reference): Promise<string> {
  if ('file' in reference) return pngFileBase64(reference.file);
  const generated = await api<{ image: { base64: string } }>('/create-image-pixen', {
    description: reference.description,
    image_size: { width: spec.size, height: spec.size },
    no_background: true,
    outline: 'single color black outline',
    view: 'low top-down',
    direction: 'south',
    ...(spec.detail ? { detail: spec.detail } : {}),
    seed: reference.seed,
  });
  const base64 = generated.image.base64;
  return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
}

/** A set's own drawings of other directions, as create-character-v3 takes them; east mirrored is west */
function directionImages(files: NonNullable<SpriteSetSpec['directionImages']>): Record<string, { type: 'base64'; base64: string }> {
  const images: Record<string, { type: 'base64'; base64: string }> = {};
  if (files.north) images.north = { type: 'base64', base64: pngFileBase64(files.north) };
  if (files.east) {
    const east = decodePng(readFileSync(files.east));
    images.east = base64Image(east);
    images.west = base64Image(mirrored(east));
  }
  return images;
}

function mirrored(image: RgbaImage): RgbaImage {
  const out = createImage(image.width, image.height);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const from = (y * image.width + x) * 4;
      out.data.set(image.data.subarray(from, from + 4), (y * image.width + image.width - 1 - x) * 4);
    }
  }
  return out;
}

async function createCharacter(spec: SpriteSetSpec, seed: number): Promise<string> {
  log(`${spec.name}: creating the character`);
  const look = spec.reference
    // Turned from its picked south-facing look, in four directions
    ? {
      reference_image: { type: 'base64', base64: await referenceImage(spec, spec.reference) },
      n_directions: 4,
      ...(spec.directionImages ? { direction_images: directionImages(spec.directionImages) } : {}),
    }
    : { image_size: { width: spec.size, height: spec.size }, ...(spec.detail ? { detail: spec.detail } : {}) };
  const created = await api<{ character_id: string; background_job_id: string }>('/create-character-v3', {
    description: spec.description,
    name: spec.name,
    ...look,
    view: 'low top-down',
    template_id: spec.template,
    no_background: true,
    seed,
  });
  await waitForJob(created.background_job_id, `${spec.name} character`);
  return created.character_id;
}

interface CharacterDetail {
  rotation_urls: Record<string, string>;
  animations: { animation_group_id: string; directions: { direction: string; frames: string[] }[] }[];
}

async function downloadImage(url: string): Promise<RgbaImage> {
  for (let attempt = 1; ; attempt++) {
    // The file host rejects some default user agents
    const response = await fetch(url, { headers: { 'User-Agent': 'curl/8' } });
    if (response.ok) return decodePng(new Uint8Array(await response.arrayBuffer()));
    // It sometimes answers 500 for a moment
    if (response.status < 500 || attempt >= 4) throw new Error(`${url}: HTTP ${response.status}`);
    await sleep(3000 * attempt);
  }
}

/** The character standing still, facing each direction: where its animations start */
async function downloadRotations(characterId: string, directions: Direction[]): Promise<Record<Direction, RgbaImage>> {
  const character = await api<CharacterDetail>(`/characters/${characterId}`);
  const entries = await Promise.all(directions.map(async direction => [direction, await downloadImage(character.rotation_urls[direction])] as const));
  return Object.fromEntries(entries) as Record<Direction, RgbaImage>;
}

/** Every color the character's rotations use, the most used first (PixelLab takes up to 256) */
function paletteOf(images: RgbaImage[]): string[] {
  const counts = new Map<string, number>();
  for (const image of images) {
    for (let i = 0; i < image.data.length; i += 4) {
      if (image.data[i + 3] === 0) continue;
      const hex = '#' + [0, 1, 2].map(c => image.data[i + c].toString(16).padStart(2, '0')).join('');
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 256).map(([hex]) => hex);
}

/** One animation facing one direction: its manifest key */
function animationKey(name: string, direction: Direction): string {
  return direction === 'east' ? name : `${name}@${direction}`;
}

function parseKey(key: string): { name: string; direction: Direction } {
  const [name, direction] = key.split('@');
  return { name, direction: (direction ?? 'east') as Direction };
}

/**
 * Added to an action facing that way: told to strike "forward", a character
 * seen from behind turns around to face the viewer
 */
const DIRECTION_HINTS: Partial<Record<Direction, { action: string; pose: string }>> = {
  north: {
    action: 'seen from behind the whole time, its back toward the viewer, facing away from the viewer',
    pose: 'standing still, seen from behind, facing away from the viewer',
  },
};

interface CreatedAnimation {
  animation_group_id: string;
  background_job_ids: string[];
}

/**
 * One animation in all of the set's directions, as one PixelLab animation:
 * the first direction makes it and the others are added to it, each its own
 * job (PixelLab draws each direction on its own anyway), so each gets its own
 * hint and, for a loop, its own end pose.
 */
async function createAnimation(
  characterId: string,
  spec: SpriteSetSpec,
  name: string,
  directions: Direction[],
  seed: number,
  rotations: Record<Direction, RgbaImage>,
  palette: string[] | null,
): Promise<string> {
  const animation = spec.animations[name];
  if (animation.mode === 'still') throw new Error(`${name} is a still: nothing to animate`);
  const request = (direction: Direction, groupId?: string): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      character_id: characterId,
      animation_name: name,
      directions: [direction],
      seed,
      ...(groupId ? { animation_group_id: groupId } : {}),
    };
    if (animation.mode === 'template') {
      Object.assign(body, { mode: 'template', template_animation_id: animation.template });
    } else {
      const hint = DIRECTION_HINTS[direction];
      const own = spec.directionActions?.[animationKey(name, direction)];
      const action = own ?? (hint ? `${animation.action}, ${hint.action}` : animation.action);
      Object.assign(body, { mode: animation.mode, action_description: action, frame_count: animation.frames });
      if (animation.mode === 'pixminimax') {
        body.subject_description = spec.description;
        if (hint) body.initial_pose = hint.pose;
      }
      // A loop is drawn back to where it starts
      if (animation.loop) body.end_frame = base64Image(rotations[direction]);
      if (palette) body.target_palette = { colors: palette };
    }
    return body;
  };
  const [first, ...others] = directions;
  log(`${spec.name}: animating ${name} (${animation.mode}, ${directions.join(', ')})`);
  const created = await api<CreatedAnimation>('/characters/animations', request(first));
  const groupId = created.animation_group_id;
  await waitForJob(created.background_job_ids[0], `${spec.name} ${name} ${first}`);
  await Promise.all(others.map(async direction => {
    const added = await api<CreatedAnimation>('/characters/animations', request(direction, groupId));
    await waitForJob(added.background_job_ids[0], `${spec.name} ${name} ${direction}`);
  }));
  return groupId;
}

async function downloadFrames(character: CharacterDetail, groupId: string, direction: Direction): Promise<RgbaImage[]> {
  const animation = character.animations.find(a => a.animation_group_id === groupId);
  const facing = animation?.directions.find(d => d.direction === direction);
  if (!facing) throw new Error(`Animation ${groupId} has no ${direction} frames`);
  return Promise.all(facing.frames.map(downloadImage));
}

/** The strip file of an animation facing a direction: idle.png, idle_south.png */
function stripFile(key: string): string {
  const { name, direction } = parseKey(key);
  return direction === 'east' ? `${name}.png` : `${name}_${direction}.png`;
}

/** A frame without the pieces (8-connected) of at most maxPixels apart from its biggest one */
function withoutDetached(frame: RgbaImage, maxPixels: number): RgbaImage {
  const { width, height } = frame;
  const piece = new Int32Array(width * height).fill(-1);
  const sizes: number[] = [];
  for (let start = 0; start < width * height; start++) {
    if (frame.data[start * 4 + 3] === 0 || piece[start] >= 0) continue;
    const id = sizes.length;
    const stack = [start];
    piece[start] = id;
    let size = 0;
    while (stack.length) {
      const at = stack.pop()!;
      size++;
      const x = at % width, y = Math.floor(at / width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (frame.data[next * 4 + 3] === 0 || piece[next] >= 0) continue;
          piece[next] = id;
          stack.push(next);
        }
      }
    }
    sizes.push(size);
  }
  const biggest = sizes.indexOf(Math.max(...sizes));
  const out = createImage(width, height);
  out.data.set(frame.data);
  for (let i = 0; i < width * height; i++) {
    if (piece[i] >= 0 && piece[i] !== biggest && sizes[piece[i]] <= maxPixels) out.data[i * 4 + 3] = 0;
  }
  return out;
}

/**
 * Lay out each animation's frames side by side on a square canvas shared by
 * all of them, centered, with every animation's feet on the idle's row (its
 * lowest pixel, or with byFirstFrame its first frame's).
 */
function buildStrips(animations: Record<string, RgbaImage[]>, byFirstFrame = false, idleKey = 'idle'): Record<string, RgbaImage> {
  const canvas = Math.max(...Object.values(animations).flat().map(frame => Math.max(frame.width, frame.height)));
  const centered = (frame: RgbaImage, dy = 0) => {
    const out = createImage(canvas, canvas);
    blit(out, frame, Math.floor((canvas - frame.width) / 2), Math.floor((canvas - frame.height) / 2) + dy);
    return out;
  };
  const feetRow = (frames: RgbaImage[]) => Math.max(...(byFirstFrame ? frames.slice(0, 1) : frames).map(frame => bottomRow(centered(frame))));
  const idleFeet = feetRow(animations[idleKey]);

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

// =============================================================================
// The check: frames that lost part of the body, grew something or jump
// =============================================================================

/** A frame with less of the body than standing still lost something (a foot, a pincer) */
const MISSING_SHARE = 0.8;
/** A frame with this much more grew something: an effect, a cloud, sand */
const EXTRA_SHARE = 1.35;
/** A frame that changes this many times more than the animation's usual step jumps */
const JUMP_FACTOR = 2.5;
/** ...as long as it changes at least this share of the body */
const JUMP_MIN = 0.2;

function visiblePixels(image: RgbaImage): number {
  let count = 0;
  for (let i = 3; i < image.data.length; i += 4) if (image.data[i] > 0) count++;
  return count;
}

/** Pixels that differ between two frames of the same size */
function changedPixels(a: RgbaImage, b: RgbaImage): number {
  let count = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const aOn = a.data[i + 3] > 0;
    const bOn = b.data[i + 3] > 0;
    if (aOn !== bOn) count++;
    else if (aOn && Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 60) count++;
  }
  return count;
}

/** The check's findings for one strip, empty when it looks fine */
function checkStrip(frames: RgbaImage[], standing: RgbaImage, loop: boolean): string[] {
  const body = visiblePixels(standing);
  const findings: string[] = [];
  frames.forEach((frame, i) => {
    const share = visiblePixels(frame) / body;
    if (share < MISSING_SHARE) findings.push(`frame ${i} has ${Math.round(share * 100)}% of the body (something missing?)`);
    if (share > EXTRA_SHARE) findings.push(`frame ${i} has ${Math.round(share * 100)}% of the body (an effect drawn in?)`);
  });
  const steps = frames.map((frame, i) => (i === 0 ? 0 : changedPixels(frames[i - 1], frame) / body)).slice(1);
  if (loop) steps.push(changedPixels(frames[frames.length - 1], frames[0]) / body);
  const usual = [...steps].sort((a, b) => a - b)[Math.floor(steps.length / 2)] ?? 0;
  steps.forEach((step, i) => {
    if (step > JUMP_MIN && step > usual * JUMP_FACTOR) {
      const to = (i + 1) % frames.length;
      findings.push(`frame ${i} -> ${to} jumps (${Math.round(step * 100)}% changes, usually ${Math.round(usual * 100)}%)`);
    }
  });
  return findings;
}

/** Each strip's frames scaled up on a checkerboard, one strip per row */
function contactSheet(strips: RgbaImage[], scale: number): RgbaImage {
  const gap = 4;
  const width = Math.max(...strips.map(strip => strip.width)) * scale;
  const height = strips.reduce((total, strip) => total + strip.height * scale + gap, 0);
  const sheet = createImage(width, height);
  let top = 0;
  for (const strip of strips) {
    for (let y = 0; y < strip.height * scale; y++) {
      for (let x = 0; x < width; x++) {
        const sx = Math.floor(x / scale);
        const from = (Math.floor(y / scale) * strip.width + sx) * 4;
        const alpha = sx < strip.width ? strip.data[from + 3] / 255 : 0;
        const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 70 : 92;
        // A red line between frames
        const edge = sx % strip.height === 0 && x % scale === 0;
        const to = ((top + y) * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          sheet.data[to + c] = edge ? (c === 0 ? 200 : 60) : Math.round(checker * (1 - alpha) + (alpha ? strip.data[from + c] * alpha : 0));
        }
        sheet.data[to + 3] = 255;
      }
    }
    top += strip.height * scale + gap;
  }
  return sheet;
}

// =============================================================================
// A set
// =============================================================================

async function generateSpriteSet(spec: SpriteSetSpec, manifest: Manifest, options: Options): Promise<void> {
  const entry = (manifest[spec.key] ??= { animations: {} });
  const directions = spec.directions ?? ['east'];
  const names = Object.keys(spec.animations);
  // A strip per animation and direction
  const keys = names.flatMap(name => directions.map(direction => animationKey(name, direction)));
  const idleKey = animationKey('idle', directions[0]);
  const fileOf = (key: string) => (directions.length === 1 ? `${parseKey(key).name}.png` : stripFile(key));
  if (!entry.characterId || options.newCharacter) {
    entry.characterId = await createCharacter(spec, options.seed);
    entry.animations = {};
    saveManifest(manifest);
  }
  const characterId = entry.characterId;
  const rotations = await downloadRotations(characterId, directions);
  if (options.characterOnly) {
    if (options.review) {
      mkdirSync(options.review, { recursive: true });
      const standing = buildStrips(Object.fromEntries(directions.map(direction => [animationKey('idle', direction), [rotations[direction]]])), false, idleKey);
      writeFileSync(join(options.review, `${spec.key}-character.png`), encodePng(contactSheet(Object.values(standing), 4)));
    }
    log(`${spec.name}: character ${characterId} (${directions.join(', ')})`);
    return;
  }
  const palette = spec.lockPalette ? [...paletteOf(Object.values(rotations)), ...(spec.paletteExtras ?? [])] : null;

  // Missing animations, a few at a time (a redo is a new animation: the old take stays in the PixelLab library)
  const missing = names.filter(name => spec.animations[name].mode !== 'still' && (!entry.animations[name] || options.redo.includes(name)));
  await runPool(missing, async name => {
    entry.animations[name] = await createAnimation(characterId, spec, name, directions, options.seed, rotations, palette);
    saveManifest(manifest);
  });

  const character = await api<CharacterDetail>(`/characters/${characterId}`);
  const frames: Record<string, RgbaImage[]> = {};
  for (const key of keys) {
    const { name, direction } = parseKey(key);
    const animation = spec.animations[name];
    const drawn = animation.mode === 'still' ? [rotations[direction]] : await downloadFrames(character, entry.animations[name], direction);
    // A loop's last frame is drawn back to its first pose: drop it so the pose doesn't show twice
    const kept = 'loop' in animation && animation.loop && drawn.length > 2 ? drawn.slice(0, -1) : drawn;
    const trim = spec.trim?.[key];
    const trimmed = trim ? kept.slice(trim[0], trim[1] + 1) : kept;
    const dropAbove = spec.dropDetachedIn?.[name] ?? spec.dropDetached;
    frames[key] = dropAbove ? trimmed.map(frame => withoutDetached(frame, dropAbove)) : trimmed;
  }
  const strips = buildStrips(frames, spec.feetFromFirstFrame, idleKey);
  mkdirSync(spec.outputDir, { recursive: true });
  for (const key of keys) {
    writeFileSync(join(spec.outputDir, fileOf(key)), encodePng(strips[key]));
  }
  log(`${spec.name}: wrote ${spec.outputDir} (${keys.map(key => `${key} ${frames[key].length}`).join(', ')} frames, ${strips[idleKey].height}px)`);

  const report: string[] = [];
  for (const key of keys) {
    const { name, direction } = parseKey(key);
    const animation = spec.animations[name];
    const findings = checkStrip(frames[key], rotations[direction], animation.mode === 'template' || ('loop' in animation && animation.loop === true));
    report.push(findings.length ? `${key}:\n${findings.map(finding => `  - ${finding}`).join('\n')}` : `${key}: ok`);
  }
  log(`${spec.name}: check\n${report.join('\n')}`);
  if (options.review) {
    mkdirSync(options.review, { recursive: true });
    writeFileSync(join(options.review, `${spec.key}.png`), encodePng(contactSheet(keys.map(key => strips[key]), 3)));
    writeFileSync(join(options.review, `${spec.key}.txt`), `${report.join('\n')}\n\nRows: ${keys.join(', ')}\n`);
    log(`${spec.name}: contact sheet in ${join(options.review, `${spec.key}.png`)}`);
  }
}

function loadManifest(): Manifest {
  return existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : {};
}

function saveManifest(manifest: Manifest): void {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

async function runPool<T>(jobs: T[], worker: (job: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENT_ANIMATIONS }, async () => {
    while (next < jobs.length) await worker(jobs[next++]);
  }));
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
