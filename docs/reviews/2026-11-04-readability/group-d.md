# Readability pass, group D: Zhak'rul, Kip, Nocthar

Part of [the readability pass](../../plans/2026-11-04-readability-pass.md).

## Timings

The **ratio** is the warning over the time to walk out. The rule asks:
- **Ground areas:** at least 1.
- **Areas around the caster:** at least 0.35.

Ratios are computed by `packages/shared/src/abilities/dodge.ts`.

| Ability | Before | After | Ratio before → after |
|---|---|---|---|
| Zhak'rul W Toxic Cloud | bites at once around him | billows out for 0.75 s (its warning: no slow or damage yet, a filling telegraph), then 4 s as before | 0 → 0.36 |
| Nocthar Q Grasping Hands | 0.25 s cast + hands after 0.85 s | hands after 0.9 s | 0.96 → 1.0 |
| Nocthar W Lament | 0.5 s wail | 0.6 s wail | 0.29 → 0.35 |
| Nocthar W* Bone Volley | colossus windup 0.4 + flight 0.5 (not in its definition) | windup 0.45 + flight 0.65, stated as its definition's `aoeDelay` | (0) 0.82 → 1.0 |
| Kip W Run Them Down | exempt (`dodgeExempt`) | — | — |
| Kip R Show Them All | exempt (`dodgeExempt`) | — | — |

Kip's W and R are exempt because both hit only enemies Kip marked (homing, the mark shown over them for 4
s). The counterplay is not getting marked.

Everything else in the group already met the rule (Zhak'rul Q, Kip Q's skillshot) or isn't dodged by
walking out (point-and-click stings and orders, dashes).

### Side effects
- **Toxic Cloud:** `ZhakrulWHandler` places the zone and schedules its ticks after the delay.
- **Bone Volley:** the client paces Nocthar's own order at once (`abilityTiming`'s
  `nocthar_colossus_w`), not over the bones' landing.
- **Tests:**
  - Zhak'rul: two new ones, nothing during the billow, and stepping out during it never hurts.
  - Nocthar: the new numbers.
  - `nocthar-kit` scenario: its checks moved to the new times.

## Animations

- **How they were checked:** every strip in every direction on contact sheets. The crop audit shows
  none cut for this group.
- **Kip:**
  - **The bug:** in all seven east strips the bow popped in and out. PixelLab's east view of him hid
    the bow behind his body, so each east animation started without it and grew it a few frames in.
    His idle loop flickered the bow.
  - **The fix:** a new east reference, `scripts/references/kip_east.png`, made from one of his own
    frames with the bow in front, given as `directionImages.east`. Then a new character and all his
    animations.
- **Kip, how it came out:**
  - **East and south:** the bow is in every frame of all fourteen strips.
  - **Blow frames,** retimed in `src/render/champions/kip.ts`:
    - attack 5 (was 7);
    - Q 5;
    - W 3;
    - E 8, the landing crouch (was 7);
    - R 5, the first shot (was 2).
  - **North, a known flaw:** the attack and Q still lose the bow mid-shot and shoot sideways rather
    than away. The old north strips did the same, so this is no regression. A redo would remake
    every direction of those animations.
- **Zhak'rul W:** his "rear up and shake the tail" barely moved facing east. It is redone (seed 9):
  he raises his front with the pincers spread and puffs up, clearly different from his idle in all
  three directions, and it plays while the cloud billows (its blow frame paced to the bite).
- **The crop audit:** none of the new strips are cut.
- **Nocthar:** all of his strips match his abilities (claws into the dirt, the wail, the point, the
  crouch). They are untouched.

## VFX

New tells:
- **Zhak'rul Q:** the cone his pincers close on darkens through the cast and delay (`zhakrul_q_windup`).
- **Zhak'rul W:** the gas billows to the cloud's edge with a filling telegraph, then settles.
- **Zhak'rul E:** the sand stirs where he'll burst out, as wide as the burst, for the burrow's trip.
- **Zhak'rul R:** venom gathers at the stinger through the cast (`zhakrul_r_windup`).
- **Kip E:** his landing spot is marked as wide as the landing's burst.

Nocthar's VFX follow his kit's numbers, so Bone Volley's telegraph lasts the new 1.1 s.

## Sounds

Kip used Elora's sounds for his Q, his leap and Show Them All's volleys. He now has his own: `kip_q`,
`kip_e` and `kip_r_volley`, about 20 ElevenLabs credits.

## Checks

- **Tests:**
  - server 2486 pass;
  - client 484;
  - vitest 49.
- **Shared:** 158 pass. The 16 failures are other groups' dodge rows; this group has none.
- **Types:** the server typecheck and `tsc` are clean.
- **No live look:** the shared browser's tab group was closed by a parallel agent mid-check.

## Costs

| Item | PixelLab (USD) |
|---|---|
| Kip: a new character and seven animations in three directions | about 0.25 |
| Zhak'rul W, three directions | about 0.03 |
