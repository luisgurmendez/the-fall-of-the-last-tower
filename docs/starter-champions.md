# Starter Champions

5 simple champions designed for easy implementation. Minimal complexity, straightforward mechanics.

---

## 1. Bran, the Footsoldier

**Role:** Fighter
**Theme:** A veteran infantry soldier - simple, reliable, brutal.

**Lore:** Twenty years in the shield wall taught Bran one thing: fancy sword tricks get you killed. He fights simple—hit hard, don't die. It's kept him alive longer than any knight.

### Passive: Veteran's Grit
Bran regenerates 1% of his max health per second while below 30% health.

*Implementation: Health regen buff when health threshold crossed.*

### Q: Heavy Slash
Bran swings his sword in a frontal arc, dealing **80/120/160/200/240 physical damage** to all enemies hit.

- Cooldown: 6s
- Range: Melee arc (roughly 180 degrees in front)

*Implementation: Cone-shaped damage area in facing direction.*

### W: Shield Block
Bran raises his shield, gaining **30/40/50/60/70% damage reduction** for 2 seconds. He is slowed by 20% while blocking.

- Cooldown: 12s

*Implementation: Self-buff that modifies incoming damage, applies slow to self.*

### E: Shoulder Charge
Bran charges forward a fixed distance, dealing **60/90/120/150/180 physical damage** to the first enemy hit and stunning them for **0.75 seconds**.

- Cooldown: 10s
- Range: 400 units

*Implementation: Dash with collision detection, apply damage + stun on hit.*

### R: War Cry
Bran shouts, granting himself **20/30/40% attack speed** and **15/25/35% movement speed** for 6 seconds.

- Cooldown: 80s

*Implementation: Self-buff with duration timer.*

---

## 2. Elara, the Bowmaiden

**Role:** Marksman
**Theme:** A skilled archer who relies on range and precision.

**Lore:** Elara learned to shoot before she could write. In a kingdom where women couldn't be knights, the bow became her sword. She never misses—and she never forgives.

### Passive: Steady Aim
Elara's basic attacks deal **10% bonus damage** to targets more than 500 units away.

*Implementation: Distance check on auto-attack, multiply damage if far.*

### Q: Piercing Arrow
Elara fires an arrow in a line that passes through enemies, dealing **70/110/150/190/230 physical damage** to all enemies hit.

- Cooldown: 7s
- Range: 800 units

*Implementation: Linear skillshot projectile, doesn't stop on hit.*

### W: Quick Step
Elara dashes a short distance in target direction and gains **30% movement speed** for 2 seconds.

- Cooldown: 14s
- Dash Range: 300 units

*Implementation: Dash + self movement speed buff.*

### E: Crippling Shot
Elara fires an arrow at target enemy, dealing **50/80/110/140/170 physical damage** and slowing them by **30/35/40/45/50%** for 2 seconds.

- Cooldown: 10s
- Range: 600 units

*Implementation: Point-and-click projectile, apply damage + slow.*

### R: Arrow Storm
Elara fires a volley of arrows at a target area after a 1 second delay, dealing **200/300/400 physical damage** to all enemies in the area.

- Cooldown: 90s
- Area Radius: 250 units
- Range: 700 units

*Implementation: Ground-target AoE with delay, then damage all enemies in radius.*

---

## 3. Magnus, the Battlemage

**Role:** Mage
**Theme:** A war wizard who channels raw destructive magic.

**Lore:** Magnus didn't have the patience for scholarly magic. He learned one thing—how to make things explode—and perfected it. The university expelled him. The army promoted him.

### Passive: Arcane Surge (STACKING)
Magnus's abilities generate **Arcane Charge** stacks (max 4). Each stack increases his ability damage by **5%**. Stacks decay one at a time every 5 seconds out of combat.

*Implementation: Stack counter, modify ability damage output, decay timer.*

### Q: Fireball
Magnus hurls a fireball in a line, dealing **80/125/170/215/260 magic damage** to the first enemy hit.

- Cooldown: 5s
- Range: 700 units

*Implementation: Linear skillshot projectile, stops on first enemy hit.*

### W: Arcane Shield
Magnus surrounds himself with a magic barrier that absorbs **60/100/140/180/220 damage** for 3 seconds.

- Cooldown: 14s

*Implementation: Shield (temporary HP buffer) with duration.*

### E: Blink
Magnus teleports to target location.

- Cooldown: 16s
- Range: 400 units

*Implementation: Instant position change (no travel time).*

### R: Meteor
Magnus calls down a meteor at target location after a **1.5 second delay**, dealing **250/375/500 magic damage** to all enemies in the area.

- Cooldown: 100s
- Area Radius: 300 units
- Range: 800 units

*Implementation: Ground-target AoE with delay indicator, then damage.*

---

## 4. Thorne, the Sellsword

**Role:** Assassin
**Theme:** A mercenary who kills quickly and efficiently.

**Lore:** Thorne has no loyalty except to gold. He's killed kings and peasants alike—the price is the only difference. Fast, silent, and gone before the body hits the ground.

### Passive: Killer Instinct
Thorne deals **15% bonus damage** to enemies below 40% health.

*Implementation: Check target health percentage, multiply damage if low.*

### Q: Swift Strike
Thorne dashes through a target enemy, dealing **70/105/140/175/210 physical damage** and appearing behind them.

- Cooldown: 8s
- Range: 450 units

*Implementation: Targeted dash that ends behind the target.*

### W: Blade Flurry
Thorne slashes rapidly around himself, dealing **60/95/130/165/200 physical damage** to all nearby enemies.

- Cooldown: 9s
- Radius: 200 units

*Implementation: Instant AoE damage around self.*

### E: Shadow Step
Thorne becomes invisible for **2/2.25/2.5/2.75/3 seconds** and gains **20% movement speed**. Attacking or using abilities breaks invisibility.

- Cooldown: 18s

*Implementation: Invisibility state + movement speed buff, break on action.*

### R: Deathmark
Thorne marks target enemy for death. After 3 seconds, the mark detonates, dealing **150/250/350 physical damage** plus **30% of damage Thorne dealt to them** during the mark duration.

- Cooldown: 90s
- Range: 500 units

*Implementation: Debuff that tracks damage dealt, then deals bonus damage on expiry.*

---

## 5. Greta, the Field Medic

**Role:** Support
**Theme:** A battlefield healer who keeps her allies fighting.

**Lore:** Greta was a village herbalist until the war burned her village. Now she walks the battlefield, saving who she can. Her hands have closed more wounds than any surgeon in the kingdom.

### Passive: Triage
Greta's healing is **20% more effective** on allies below 40% health.

*Implementation: Check target health percentage, multiply heal if low.*

### Q: Healing Touch
Greta heals target ally for **70/110/150/190/230 health**.

- Cooldown: 8s
- Range: 600 units

*Implementation: Point-and-click heal on ally.*

### W: Purifying Light
Greta removes all debuffs from target ally and heals them for **40/60/80/100/120 health**.

- Cooldown: 14s
- Range: 500 units

*Implementation: Clear debuff list on target + heal.*

### E: Protective Blessing
Greta blesses target ally, granting them **20/30/40/50/60 armor and magic resist** for 4 seconds.

- Cooldown: 12s
- Range: 600 units

*Implementation: Stat buff with duration on ally.*

### R: Sanctuary
Greta creates a healing zone at target location for 5 seconds. Allies inside regenerate **40/60/80 health per second**.

- Cooldown: 100s
- Radius: 300 units
- Range: 600 units

*Implementation: Ground-target zone that heals allies inside over time.*

---

## Implementation Complexity Summary

| Champion | Passive | Q | W | E | R |
|----------|---------|---|---|---|---|
| Bran | HP regen threshold | Cone damage | Self damage reduction | Dash + stun | Self buff |
| Elara | Distance damage bonus | Pierce skillshot | Dash + speed | Point-click slow | Delayed AoE |
| Magnus | **Stacking buff** | Skillshot | Shield | Blink | Delayed AoE |
| Thorne | Execute damage bonus | Targeted dash | Self AoE | Invisibility | Damage mark |
| Greta | Heal bonus threshold | Point-click heal | Cleanse + heal | Stat buff ally | Zone heal |

## Required Systems

These champions need the following systems to work:

1. **Projectiles** (skillshots) - Elara Q, Magnus Q
2. **Dash/Blink** - Bran E, Elara W, Magnus E, Thorne Q
3. **Self buffs** - Bran W/R, Elara W, Magnus W/Passive, Thorne E
4. **Ally buffs** - Greta E
5. **Ally heals** - Greta Q/W/R
6. **AoE damage** - Bran Q, Thorne W, Elara R, Magnus R
7. **Delayed AoE** - Elara R, Magnus R
8. **Slow debuff** - Elara E
9. **Stun debuff** - Bran E
10. **Invisibility** - Thorne E
11. **Debuff cleanse** - Greta W
12. **Zone effect** - Greta R
13. **Damage tracking** - Thorne R (tracks damage during mark)

## Recommended Implementation Order

1. **Bran** - Most straightforward, tests basic combat
2. **Elara** - Tests skillshots and ranged combat
3. **Magnus** - Tests stacking passive and blink
4. **Greta** - Tests ally-targeting and healing
5. **Thorne** - Most complex (invisibility, damage tracking)
