# Summons

Units a champion raises that fight for it: Nocthar's Hollows and his colossus. The server's
`ServerSummon` (`packages/server/src/simulation/ServerSummon.ts`) is one.

## What they are

A summon is a **minion with an owner**:
- **Its type:** its `entityType` is `MINION` and its `minionType` is its `SummonType`
  (`'hollow' | 'colossus'`, `packages/shared/src/types/minions.ts`).
- **What comes for free:** towers shoot it before champions, lane minions fight it,
  abilities that hit minions hit it, it gives its team vision like a minion, and the
  terrain keeps it out of walls.
- **No rewards:** killing one gives no gold, XP or creep score (it carries no rewards).
  Its death still goes through `RewardSystem.awardKillRewards`, so champions' hooks hear
  of it.

Its numbers (`SummonStats`) come from its owner's kit: health, resists, damage and its
type, attack range (edge to edge, like every attack), attack cooldown and windup, speed,
sight, acquisition range, body radius and mass. `scale` makes it bigger: the body
(radius, mass) grows with it, and clients draw it bigger.

## What it does

- **Rising:** for `riseTime` it's climbing out of the ground. It doesn't act or collide;
  its snapshot's `rising` counts down, and is `null` once it's up.
- **Without orders:** it follows its owner.
  - Each summon has its own spot around the owner, so they don't pile up.
  - It walks around walls (`Terrain.findPath`, recomputed every 0.4 s), at least as fast
    as its owner.
  - It fights what its owner attacks (units and structures within 90% of its leash), and
    hits back at enemy champions and minions right next to it (`acquisitionRange`).
  - It doesn't go for structures or jungle monsters on its own.
- **Orders** (`command`):
  - **Sent somewhere or called back:** it drops the fight it's in and fights nothing on its
    way, until it's there (or by its owner). The same holds when its leash calls it back.
    A call back always applies, even if it was already following its owner and fighting
    on its own.
  - **`move`:** walk to a point, and fight what comes near there.
  - **`attack`:** chase a unit until it dies or hides. An order at something it can't
    attack (an ally, ...) is a walk to where that is.
  - **`follow`:** come back.
- **Leash:** farther than its leash from its owner, it drops its order and comes back. A
  target past the leash is let go.
- **Its owner dying:** it crumbles (`crumble`: a death with no killer). Its owner's kit
  can crumble it too (absorbed into the colossus).
- **Crowd control:** stun and knockup hold it, root keeps it in place, slows slow it, and
  fear makes it run (`fear.ts`). An attack winding up is cancelled.
- **Dash** (`startDash`, the colossus charging): it goes `distance` along `direction`
  over `duration`, whatever its orders and crowd control, until a wall stops it.
  - **Touching:** each enemy unit within `touchRadius` of its body is touched once
    (`onTouch`).
  - **Carrying:** with `carries`, the units it touches are pushed ahead of it to where
    it stops.
  - **Ending:** `onEnd` runs when it stops. Its snapshot's `isCharging` is true meanwhile.

Its basic attack is a `BASIC_ATTACK` event (clients animate it), and the blow lands after
`attackWindup`.

## On the network

A summon's `MinionSnapshot` adds:
- **`ownerId`**
- **`scale`**
- **`rising`** (null once up)
- **`isCharging`**

Delta updates send them, with `isFeared` (any minion's), under the STATE mask: booleans
as `false` when they end.

## What its owner can do to it

- **`frenzyFor`:** it attacks faster (Lament).
- **`chargeFor`:** it runs faster and hits harder (Heed Me's charge).
- **`holdFor`:** it stands still for a windup (Bone Volley, Trample).
- **`payHealth`:** it spends health, only if it has more than the price.

Its last hit counts as its owner's: the gold, creep score, XP and the kill
(`RewardSystem.creditedKiller`). A summon given the same order again keeps the attack it's
winding up.

## On the client

`src/render/entities/summon.ts` draws them from their strips (`/assets/sprites/summons/<type>/`),
like a champion's body.
- **Size:** at their snapshot's scale.
- **Rising:** cut off at their feet while they climb out of the ground.
- **Feared:** a ghost over the head.
- **Animations:** their own events (ABILITY_CAST from them: the colossus's throw and charge)
  play their strips.
- **Deaths:** they crumble into bones (`fx_hollow_crumble`, `fx_colossus_crumble` and their
  sounds).
- **Sight in the client's fog:** that of their kit.

## Nocthar's

The passive raises Hollows; his E gives them orders; his R fuses them into the colossus.
See [champions/nocthar-design.md](../champions/nocthar-design.md) and
[champions.md](champions.md).
