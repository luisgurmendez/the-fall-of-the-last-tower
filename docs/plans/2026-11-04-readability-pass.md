# Plan: readability pass (timings, animations, VFX, sounds, status marks)

Asked on 2026-11-04, with 3 hours and USD 15 more of PixelLab. The goal: a player can tell what an
enemy is about to do and dodge it. That takes three things:
- **Enough warning:** a cast time, an area's delay, a projectile's flight.
- **Its own animation:** each ability has one, and it matches what the ability does.
- **Its own VFX and sound:** each ability has them. Shared things look alike: burning, slows,
  stuns.

## 1. Dodge rule (done first, shared)

`packages/shared/src/abilities/dodge.ts`: the **ratio** is an ability's warning (its cast time and
area delay, or a skillshot's flight at full range) over the time it takes to walk out (radius plus a
body, at 100 a second).

| Kind | Least ratio | Why |
|---|---|---|
| Ground area | 1.0 (ultimates 0.9) | League's mage areas give 1.1 to 2 (Brand W ~1.1, Syndra Q ~1.4, Veigar W ~2); Nocthar's Q, which reads well, ~1 |
| Area around the caster, cone or line from it (melee) | 0.35 | the enemy is close and only steps back out of the edge |
| Skillshot | 2.0 | stepping sideways out of its path at full range |

- **Exemptions:** an ability may be exempt only with a reason in its definition (`dodgeExempt`).
  Valid reasons:
  - its warning is in its handler (a windup or a flight);
  - it isn't walked out of (homing on marks, a lingering zone you leave, a beam).
- **The test:** `packages/shared/src/test/dodge.test.ts` checks every kit; 22 abilities failed when
  it was written.

## 2. Per champion (four agents in parallel, one group each)

| Agent | Champions |
|---|---|
| A | Kael (warrior), Magnus, Elara, Vex, Gorath |
| B | Vile, Lume, Uruk, Oitboil, Caelum |
| C | Elora, Fenris, Calamitus, Protobot, Hop-To-Eat, the jungle monsters (dragon, gromp) |
| D | Zhak'rul, Kip, Nocthar |

For each ability of its champions:
1. **Timings:** meet the dodge rule, or exempt it with a reason. Keep the VFX's warning and the
   sound's windup in step.
2. **Animation:**
   - Look at every frame.
   - Art cut at the frame's edges gets regenerated. Measured cuts: Vile R 46 px, Gorath Q 33, Oitboil
     R 30, Elara R 29, Caelum Q 26, Kael Q 25, Gorath R 22, Vex R 13, Protobot R 6.
   - A missing animation gets made: Vile has no W.
   - The animation must match the ability: where its projectile or effect leaves from (staff tip,
     hand, mouth), what it shows (breathing fire means the VFX is fire from the mouth, not a generic
     orb), and the blow frame lining up with the impact.
3. **VFX:** its own for each ability, in the champion's colors:
   - a tell during the cast or delay;
   - its travel;
   - its impact.

   Shared statuses use the shared marks (section 3).
4. **Sound:** its own for each ability, with a windup sound where there's a cast time worth hearing.

Budget per agent: about USD 3.5 of PixelLab and 300 ElevenLabs credits (1,791 left this month).

## 3. Status marks (shared)

What a unit is under, drawn on it (`src/render/overlays/crowdControl.ts`). Already drawn:
- stasis;
- stun, suppression and airborne;
- root;
- silence;
- taunt;
- fear;
- blind.

Added:
- **slow:** chevrons pointing down, circling the feet;
- **burning:** small flames;
- **poisoned:** green bubbles;
- **disarmed:** a crossed sword;
- **hasted:** speed lines.

## Results (2026-11-04)

Every kit meets the dodge rule or says why it's exempt (`bun test dodge` in packages/shared). The
details, with before/after ratios, are in `docs/reviews/2026-11-04-readability/group-{a,b,c,d}.md`;
the whole table is in `docs/reviews/2026-11-04-ability-timings.md`.

- **Timings:**
  - Gorath stands and winds up his slams (cast times), and Kael's cleave lands later.
  - Magnus's meteor falls over 1.3 s and his mud is a pool you walk out of.
  - Lume's orb flies slower, and her W gathers 0.45 s first.
  - Caelum's roots rise later.
  - Calamitus's burst has a cast, Protobot's overload charges for 1.05 s, and Fenris's swipe winds up.
  - Zhak'rul's cloud billows out for 0.75 s before it bites.
  - Nocthar's hands, wail and Bone Volley got small nudges.
  - Kip's homing volleys, Lume's beam, Uruk's frost burst and Oitboil's point-blank spray are exempt,
    each with a reason in its definition.
- **Animations:**
  - About 30 strips were regenerated with body motion only (no effects baked in), and blow frames
    were retimed.
  - The cuts went from up to 46 px to at most 7 px (a weapon tip on one frame:
    `bun scripts/sprite-crop-audit.ts`).
  - Missing animations were made: Vile W, Lume W.
  - Caelum was rebuilt holding his staff.
  - Kip's bow no longer pops in and out (east and south).
  - The jungle dragon's fire and the thornspitter's spit now leave the mouth at the breath frame.
- **Blow timing fix (shared):** an ability with a cast time showed its blow frame a cast time early.
  The cast state now carries the windup it played through (`lead`; `abilityBlowShare` in
  `stripBody.ts`).
- **VFX and sounds:**
  - New tells for Calamitus Q, Fenris W, Zhak'rul Q/E/R, Kip E and Elora R.
  - New windup sounds for Gorath, Magnus, Calamitus, Fenris and Lume.
  - Kip has his own sounds instead of Elora's.
- **Status marks and sounds:** slow chevrons, burning, poison, bleeding, haste and disarm; a chip
  sound when crowd control lands on us.
- **Spent:** PixelLab about USD 1.5 of the 17 (balance about 16), ElevenLabs about 65 credits.
- **Left:**
  - Kip's north attack and Q lose the bow mid-shot.
  - Elara's R doesn't raise the staff overhead.
  - Melee monsters deal damage at the start of their attack, not on the bite frame.
  - Lines (Elora R, Calamitus W) would read better with a real line warning, which needs a new GPU
    VFX type.
