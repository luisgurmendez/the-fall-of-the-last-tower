# Readability pass, group C: Elora, Fenris, Calamitus, Protobot 45, Hop-To-Eat, jungle monsters

Branch `feat/readability-c`. Plan: [docs/plans/2026-11-04-readability-pass.md](../../plans/2026-11-04-readability-pass.md).

## Timings (dodge rule)

| Ability | Before | After | Ratio before → after (rule) |
|---|---|---|---|
| Calamitus Q Lava Flow | instant burst | a 0.6 s cast (the ground churns), then the burst | 0 → 0.38 (0.35) |
| Calamitus R Eruption | erupts after 0.6 s | after 0.85 s | 0.25 → 0.35 (0.35) |
| Protobot Q Magnetism | projectile 750/s | 700/s (League's hook, 1800, at 0.42 scale is ~756) | 1.99 → 2.09 (2.0) |
| Protobot R Overload | pulse after 0.5 s | after 1.05 s (text: "charge up for a second") | 0.17 → 0.35 (0.35) |
| Fenris W Savage Claw | swipe 0.15 s after its 0.25 s cast | 0.45 s after (0.7 s in all, about Darius Q's windup) | not measured (a cone without aoeRadius); 0.21 → 0.37 by the melee rule |

The other abilities in the group already passed the rule, or aren't dodged by walking out:
- **Pass:** Elora W and R, Calamitus W.
- **Not walked out of:** point-and-click (Fenris Q, Hop Q and R, Protobot E), dashes, and buffs.

## Animations

I looked at every frame of every strip. Contact sheets were made with a scratch script.

- **Fenris W:** it was the same one-handed slash as his attack. Now it's a two-handed sweep. Its blow
  frame moved from 7 to 5, the sweep.
- **Fenris R:** the prompt asked for "a red glow". The generator bakes effects in, so the wolf
  turned into a flat red silhouette. It's now a real howl: chest out, arms wide. The game draws his
  rage aura itself.
- **Protobot R:** the prompt asked for "a big pulse of blue electricity". It was baked in as a ring,
  cut 6 px at the top of the canvas. It now raises its arms through the charge and throws them wide
  at the pulse; the blow frame moved from 4 to 7, the release, at 1.05 s. Nothing is cut.
- **Protobot W:** "glows bright" ended as a flat glow in the last frame. Now it's body only, and the
  VFX draws the electricity.
- **Calamitus idle:** its last frame was tinted dark red and flickered every loop. Regenerated.
- **Fine as they were:**
  - Calamitus: attack, Q (lava bursts at his feet), W (a stream along the ground ahead), E
    (obsidian), R (arms up, lava).
  - Elora: all; the R aims up for the barrage. Her R arrow leaves the frame by 5 px as it flies
    off, which is harmless.
  - Hop: all, distinct.
  - Protobot: Q (the claw leaves the hand) and E (rocket elbow).
- **Every cast-time ability's blow frame** (fix in `stripBody.ts`, `entities.ts`, `gameEvents.ts`):
  - **The bug:** an ability with a cast time starts its animation at the windup. Its blow frame was
    timed from there by the impact alone, so it played a cast time too early. That's 0.25 s for every
    aimed ability (the default cast time) and 0.6 s for Calamitus Q.
  - **The fix:** the cast state now carries the cast time it played through (`lead`), and the blow
    lands as the ability goes off.

## Jungle monsters

- **The dragon's and the thornspitter's basic attacks:**
  - **The bug:** the projectile (`dragon_fire`, `jungle_spit`) left their middle as the attack
    began. Their strips only open the mouth and breathe fire or spit at the 6th of 9 frames, so the
    shot came first and from the chest.
  - **Server:** it now leaves at that frame, from in front of the mouth (`release`, `mouth` in
    `ServerJungleCreature.RANGED`). A stun, knockup or disarm before then stops it.
  - **Client:** it's drawn from mouth height, dropping to its target (`LIFTED_SHOTS` in
    `projectile.ts`, with the tower's shot).
  - **Test:** `MonsterShots.test.ts`.
- **Special attacks (the dragon's breath, the buffs' slams, the Rootwyrm's eruption):** they held
  the gathering pose through the windup, then went back to idle as the VFX's flames came out.
  - **Server:** their animation now lasts the windup plus 0.45 s.
  - **Client:** after the windup it plays the strip's strike frames (the dragon breathes its fire),
    in `specialPhase` in `jungleCreature.ts`.
  - **Test:** `src/render/entities/specialPhase.test.ts`.

## VFX and sounds

- **Calamitus Q:**
  - **VFX:** a new `calamitus_q_windup` for its cast. The burst's circle glows and churns at its
    real size, embers rise, the screen shakes a little. The burst comes as the cast ends.
  - **Sound:** a new `calamitus_q_windup` (bubbling lava, a building rumble).
- **Fenris W:**
  - **VFX:** a new `fenris_w_windup`. The cone fills in red through the cast and the claws drawn
    back.
  - **Sound:** a snarl first (`fenris_w_windup`), then the swipe's sound when it lands.
- **Protobot R:**
  - **VFX:** the charge's warning circle and gathering already followed the delay.
  - **Sound:** its charge was remade at 1.1 s, so it fills the new charge.
- **Elora R:** its warning was a 3 px line. It now glows as wide as the lane the arrows fall on.
- **Every other ability** already had its own VFX and sound.

## Cost

- **PixelLab:** five new animations, east-facing, 64 px, about USD 0.01 each:
  - Fenris W and R;
  - Protobot W and R;
  - Calamitus idle.

  The balance went from USD 16.65 to 16.21 while the other agents were generating too.
- **ElevenLabs:** about 25 credits, for three sounds.

## Left

- **Melee monsters:** they still hurt at the start of their attack, not at the bite frame. It's the
  same kind of mismatch as the shots, but it changes jungle balance timing, so I left it alone.
- **Line warnings:** Elora R, Calamitus W and other groups' lines would read better with a real line
  telegraph, a new GPU VFX type. That needs a shared change.
