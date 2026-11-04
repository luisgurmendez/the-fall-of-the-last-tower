# Readability pass: group B (Vile, Lume, Uruk, Oitboil, Caelum)

Part of [the readability pass](../../plans/2026-11-04-readability-pass.md).

## Timings (dodge rule)

Each ratio is its warning over the time to walk out (`packages/shared/src/abilities/dodge.ts`).

| Ability | Before | After | How |
|---|---|---|---|
| Lume Q Send the Light | 0.25 (ground area, the definition alone) | exempt: its warning is the orb's flight | The orb flies at 480 (was 700): at its 360 range it lands 1 s after the press (0.25 s cast + 0.75 s), against 1 s to walk out of its 80 radius, so 1.0 |
| Lume W Warmth | 0 (instant pulse) | exempt: centered on the orb | The orb now gathers warmth 0.45 s (`aoeDelay`, `LumeWHandler` schedules the pulse) where it was at the cast. Meanwhile there's a warning circle, light drawn in and a rising shimmer (`lume_w_gather`), then the pulse. Like League's Orianna W, the counterplay is keeping away from the orb, which everyone sees |
| Lume E Prismatic Beam | 0 | exempt | A beam that stays 2.5 s between Lume and the orb, both in sight: walked around, like a wall |
| Uruk E Silver Scales | 0 | exempt | The frost bursts when the shield breaks or ends (up to 2.5 s): the glowing shield is the warning |
| Oitboil Q Spark Spray | 0 | exempt | A cheap point-blank burst (3 s cooldown) whose reach is his attack range: kept out of, like his basic attack. His crouch is the tell |
| Caelum E Whispering Roots | 0.88 | 1.0 | `aoeDelay` 0.8 → 0.95 (League's Morgana W is about 1.1) |

The others in the group already met the rule: Vile Q (skillshot), Uruk Q (melee line), Lume R (line from the orb), Caelum Q (skillshot). Vile E's trap arms 1 s after it's placed and only catches who steps on it.

## Animations

Cut art (`scripts/sprite-crop-audit.ts`) and mismatches, looked at frame by frame on contact sheets:

| Champion | Problem | Fix |
|---|---|---|
| Vile W | No animation | A new strip: he pulls his cloak around himself and crouches into it. The renderer maps it to `vile_veil_of_darkness` (blow frame 4) |
| Vile R | A huge purple disk drawn over him, cut 46 px by the canvas | Redone with only the body moving (arms spread, head back, cloak billowing); the game's VFX is the eruption |
| Vile E, attack, Q | The rune trap drawn at his feet (the real trap goes where he aims, up to 300 away); the arrow in flight next to the game's projectile | `dropDetachedIn` (new in `generate-sprites.ts`): those animations leave out pieces not joined to his body. His soul wisps, which are detached too, stay elsewhere |
| Oitboil R | The fire stream drawn into the strip, cut 30 px | Redone with only his braced body, nozzles forward. The game's cone of fire (`oitboil_r` VFX) is the stream, as long as the real cone |
| Caelum, every strip | His PixelLab character had no staff: every animation started without it and drew it in a few frames later (it flickered on every attack); idle and walk never had it. Q's burst of light was cut 26 px | A new character from a reference holding the staff (`reference` seed 3) and all seven animations again. Q is the staff's thrust only (the ray is the projectile; blow frame 7 → 2). E is the staff slammed down (the roots rise where they're aimed). His bolt and roots aren't drawn in (`dropDetachedIn`) |
| Lume W | No animation (her idle frame) | Her sheets are hand-drawn, not a PixelLab character. `scripts/animate-frame.ts` (new) animates her idle frame with PixMiniMax, so it keeps her drawing and 152 px size. She cups her hands at her chest while the orb gathers and spreads her palms as it pulses (frame 10 at 0.45 s) |
| Vile E (left as it is) | The rune he presses down is joined to his body (the arrow he holds touches it), so it can't be left out as a detached piece | It reads as him setting a trap, like League's traps are set with a gesture while they land at range; the real trap goes where he aims |
| Vile attack, Q, R (left) | The bow's tip touches the canvas's right edge (3-5 px, measured: R was 46 px) | Barely visible |
| Uruk | Nothing cut. He's the "Silver Dragonborn" but breathes nothing: his animations (jab, lunge, glowing tip, scales, leap) match his abilities | None |

## VFX and sounds

- **Distinct per ability:** every ability in the group already had its own VFX in its champion's colors:
  - Vile: violet arrows, veil, trap;
  - Lume: prism light;
  - Uruk: silver;
  - Oitboil: fire, blue fire;
  - Caelum: gold and leaves.
- **Changed:**
  - Lume W now has a gathering phase (warning circle sized to the pulse, light drawn in) before its pulse. Its sound plays as it pulses.
  - A new `lume_w_gather` sound plays at the cast.
- **Made redundant by the redrawn animations:** the baked effects (Oitboil's stream, Caelum's light, Vile's disk). The VFX that were already there are now the only fire, light and eruption.

## Costs

- **PixelLab:** about USD 0.30-0.40 for this group. The balance went from USD 17.14 to 16.21 while
  the other groups generated on the same account. What it paid for:
  - Vile W, R;
  - Oitboil R;
  - Caelum idle, walk, Q twice, then a new character and seven animations, then E;
  - four reference takes;
  - two Lume W takes.
- **ElevenLabs:** about 6 credits, for `lume_w_gather`.
