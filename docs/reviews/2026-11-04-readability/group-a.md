# Readability pass, group A: Kael, Magnus, Elara, Vex, Gorath (2026-11-04)

The plan: [docs/plans/2026-11-04-readability-pass.md](../../plans/2026-11-04-readability-pass.md).

## Timings

The ratio is the dodge rule's (`packages/shared/src/abilities/dodge.ts`): an ability's warning over
the time to walk out of it.

| Ability | Kind | Before | After | Change |
|---|---|---|---|---|
| Kael Q Cleaving Strike | cone from him | 0.30 (0.45 s) | **0.37** (0.55 s) | delay 0.2 → 0.3 s |
| Magnus Q Fireball | skillshot | 2.65 | 2.65 | (already dodgeable) |
| Magnus E Quagmire | slow zone | 0.38 | **exempt** | delay 0.25 → 0.5 s; a mud pool you walk out of |
| Magnus R Inferno Zone | ground area | 0.56 (0.95 s) | **0.91** (1.55 s) | delay 0.7 → 1.3 s |
| Vex Q Shadow Shuriken | skillshot | 2.69 | 2.69 | (already dodgeable) |
| Gorath Q Ground Slam | area around him | 0.19 (0.35 s) | **0.36** (0.65 s) | cast 0 → 0.3 s (standing), delay 0.35 s |
| Gorath E Defiant Roar | area around him | 0.15 (0.25 s) | **0.35** (0.60 s) | cast 0 → 0.35 s, delay 0.25 s |
| Gorath R Earthquake | area around him | 0.25 (0.6 s) | **0.35** (0.85 s) | cast 0 → 0.45 s, delay 0.6 → 0.4 s |

The other abilities aren't dodged by walking (Elara's heals, shields and speed; Kael's shield,
charge and leap; Vex's stealth, dash and Ninja Mode; Gorath's Stone Skin).

- **Gorath gets real cast times instead of longer delays.** His areas land where he stood, so a long
  delay would let him walk away from his own slam. He stands and winds up instead:
  - a windup VFX outlines the area at once (`gorath_slam_windup`, `gorath_taunt_windup`,
    `gorath_earthquake_windup`);
  - then the cast's warning fills over the delay;
  - windup sounds: the hammer hoisted, a breath drawn, the quake's rumble starting.
- **Magnus's meteor:**
  - the warning fills for the whole 1.3 s;
  - the burning rock falls in the last 0.7 s, its whistle ending at the impact;
  - in the cast, a beam of fire shoots from his staff into the sky (new VFX and sound).

## Animations

The contact sheets were looked at frame by frame. Redone with PixelLab, describing only the body's
motion (the game draws the effects):

| Strip | Problem | Now |
|---|---|---|
| Gorath Q | hammer cut off at the top (33 px): the slam's ground cracks, drawn below his feet, lifted the strip | raises the hammer over his head, slams it down; strips lined up by the standing frame (`feetFromFirstFrame`) |
| Gorath R | swing cut at the right (22 px), a crescent and cracks drawn in | heaves the hammer behind his head, smashes it down |
| Gorath E | barely moved for a roar | head thrown back, arms wide |
| Gorath W | barely moved | arms crossed, braced |
| Elara Q | a cyan beam drawn in, cut at the right | points the staff gently at the ally |
| Elara W | a big orange shield drawn in (the VFX draws the ally's shield) | holds her palm out to the ally |
| Elara R | a light pillar drawn beside her, cut at the top | raises the staff straight up with both arms |
| Magnus R | flames at his feet, but the meteor falls 400 away | lifts the staff overhead, sweeps it down at the target |
| Magnus Q | a big fireball drawn over him as the game's own flew off | swings the staff forward and points it |
| Kael Q | the crescent cut at the right (25 px) | a wide horizontal sweep |
| Vex R | the violet arc cut at the right (13 px) | draws a second blade into a low stance |

The blow frames follow the new strips (`render/champions/<id>.ts`).

**Fixed along the way:** an ability with a cast time starts its animation at the windup, but its
blow frame was timed from the cast. So it showed early: Gorath's slam frame came 0.3 s before the
hit, and Nocthar's hands too. The strips now use `animationImpactTime`, which is the cast time plus
the impact. Also, vitest now reads `@siege/shared` from source, as Vite does.

## VFX and sounds

Every ability of the five already had its own VFX and sound. Added:
- Gorath's three windup VFX and their sounds;
- Magnus's meteor windup VFX and sound;
- the meteor's longer fall.

The roar now sounds when it lands, and the rumble starts with the windup.

**Small cuts left:** a weapon tip still grazes the frame's right edge on one frame. This is how
PixelLab drew it:
- Gorath Q: 4 px;
- Gorath R: 6 px;
- Kael Q: 7 px;
- Kael's basic attack: 3 px.

**Elara's R:** the second take holds the staff up in front of her rather than overhead. It reads
differently from her Q and W, so it was kept.

## Costs

- **PixelLab:** 13 animations (Gorath 4, Elara 3 plus a redo of R, Magnus 2, Kael 1, Vex 1). The
  balance went from USD 17.14 to 16.35 while the other groups were also generating, so this group's
  share was at most about USD 0.8.
- **ElevenLabs:** three short windup sounds, about 15 credits.
