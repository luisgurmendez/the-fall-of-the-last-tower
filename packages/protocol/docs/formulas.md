# Siege MOBA - Game Logic Formulas

This document specifies all game logic formulas that must be implemented identically across all server implementations (TypeScript, Rust, Go).

## 1. Damage Calculations

### 1.1 Damage Reduction from Resistances

```
if resist >= 0:
    reduction = resist / (100 + resist)
else:
    reduction = resist / (100 - resist)  # Negative resist increases damage

damage_multiplier = 1 - reduction
damage_multiplier = clamp(damage_multiplier, 0.1, 2.0)  # Cap at 90% reduction, 100% amplification
```

**Examples:**
| Resist | Reduction | Multiplier |
|--------|-----------|------------|
| 0      | 0%        | 1.00       |
| 50     | 33.3%     | 0.667      |
| 100    | 50%       | 0.50       |
| 200    | 66.7%     | 0.333      |
| -25    | -33.3%    | 1.333      |

### 1.2 Physical Damage Calculation

```
effective_armor = armor * (1 - armor_pen_percent) - armor_pen_flat
effective_armor = max(0, effective_armor)

physical_damage = raw_damage * calculate_damage_multiplier(effective_armor)
```

### 1.3 Magic Damage Calculation

```
effective_mr = magic_resist * (1 - magic_pen_percent) - magic_pen_flat
effective_mr = max(0, effective_mr)

magic_damage = raw_damage * calculate_damage_multiplier(effective_mr)
```

### 1.4 True Damage

```
true_damage = raw_damage  # No reduction applied
```

### 1.5 Pure Damage

```
pure_damage = raw_damage  # Ignores shields and damage reduction
```

---

## 2. Stat Calculations

### 2.1 Base Stat at Level

```
stat_at_level = base_stat + growth_stat * (level - 1)
```

**Example:** A champion with base_health=580 and health_growth=95
- Level 1: 580 + 95 * 0 = 580
- Level 10: 580 + 95 * 9 = 1435
- Level 18: 580 + 95 * 17 = 2195

### 2.2 Attack Speed at Level

Attack speed uses a different formula due to percent-based scaling:

```
growth_bonus = (base_attack_speed_growth * (level - 1)) / 100
total_bonus = growth_bonus + bonus_attack_speed_percent
attack_speed = base_attack_speed * (1 + total_bonus)
```

**Example:** base_attack_speed=0.658, growth=2.5%
- Level 1: 0.658 * (1 + 0) = 0.658
- Level 10: 0.658 * (1 + 0.225) = 0.806
- Level 18: 0.658 * (1 + 0.425) = 0.938

### 2.3 Final Stat Calculation

```
final_stat = (base_stat_at_level + flat_bonus) * (1 + percent_bonus)
```

Where:
- `flat_bonus` = sum of all flat bonuses from items, buffs, runes
- `percent_bonus` = sum of all percent bonuses (as decimal, e.g., 10% = 0.10)

---

## 3. Experience System

### 3.1 Experience Thresholds

| Level | Total XP Required |
|-------|------------------|
| 1     | 0                |
| 2     | 280              |
| 3     | 660              |
| 4     | 1140             |
| 5     | 1720             |
| 6     | 2400             |
| 7     | 3180             |
| 8     | 4060             |
| 9     | 5040             |
| 10    | 6120             |
| 11    | 7300             |
| 12    | 8580             |
| 13    | 9960             |
| 14    | 11440            |
| 15    | 13020            |
| 16    | 14700            |
| 17    | 16480            |
| 18    | 18360            |

### 3.2 Level Calculation

```
for level in range(18, 0, -1):
    if experience >= LEVEL_THRESHOLDS[level]:
        return level
return 1
```

### 3.3 Experience Sharing

When multiple champions are in XP range (1400 units) of a dying unit:

```
shared_xp = base_xp / num_champions_in_range
```

---

## 4. Ability Scaling

### 4.1 Scaled Damage/Value Calculation

```
scaled_value = base_value[rank - 1]
             + (attack_damage * ad_ratio)
             + (ability_power * ap_ratio)
             + (bonus_health * bonus_health_ratio)
             + (max_health * max_health_ratio)
             + (missing_health * missing_health_ratio)
             + (armor * armor_ratio)
             + (magic_resist * magic_resist_ratio)
```

Where:
- `rank` = ability rank (1-5)
- `base_value` = array of 5 values, one per rank
- Ratios are decimal values (e.g., 60% AD ratio = 0.6)

### 4.2 Cooldown Reduction

```
actual_cooldown = base_cooldown * (1 - ability_haste / (100 + ability_haste))
```

Note: Ability haste replaced CDR. 100 ability haste = 50% CDR.

---

## 5. Respawn System

### 5.1 Respawn Timer Calculation

```
respawn_time = base_respawn_time + respawn_time_per_level * (level - 1)
respawn_time = min(respawn_time, max_respawn_time)
```

**Default values:**
- base_respawn_time = 6 seconds
- respawn_time_per_level = 2 seconds
- max_respawn_time = 60 seconds

**Examples:**
- Level 1: 6 + 2 * 0 = 6 seconds
- Level 10: 6 + 2 * 9 = 24 seconds
- Level 18: min(6 + 2 * 17, 60) = 40 seconds

---

## 6. Regeneration

### 6.1 Health Regeneration per Second

```
if in_combat:
    regen_multiplier = 1.0
else:
    regen_multiplier = out_of_combat_regen_multiplier  # Default: 2.5

health_regen_per_second = health_regen * regen_multiplier
```

Combat status: A champion is "in combat" for 5 seconds after dealing or receiving champion damage.

### 6.2 Resource (Mana) Regeneration

Same formula as health regeneration:

```
resource_regen_per_second = resource_regen * regen_multiplier
```

---

## 7. Gold System

### 7.1 Passive Gold Generation

```
gold_per_second = 1.9  # Configurable
gold_gain_this_tick = gold_per_second * delta_time
```

### 7.2 Minion Gold Rewards

| Minion Type | Gold |
|-------------|------|
| Melee       | 21   |
| Caster      | 14   |
| Siege       | 60   |
| Super       | 45   |

### 7.3 Champion Kill Gold

```
base_kill_gold = 300

# Bounty system (simplified)
if killer_kill_streak >= 3:
    bounty_bonus = 50 * (killer_kill_streak - 2)
    kill_gold = base_kill_gold + bounty_bonus
else:
    kill_gold = base_kill_gold

# Assist gold
assist_gold = kill_gold * 0.5 / num_assists
```

---

## 8. Crowd Control

### 8.1 CC Status Computation

```
can_move = true
can_attack = true
can_cast = true
can_use_mobility = true

for effect in active_effects:
    if effect.cc_type in [STUN, SUPPRESS, SLEEP, KNOCKUP]:
        can_move = false
        can_attack = false
        can_cast = false
    elif effect.cc_type == ROOT:
        can_move = false
        can_use_mobility = false
    elif effect.cc_type == SILENCE:
        can_cast = false
    elif effect.cc_type == DISARM:
        can_attack = false
    elif effect.cc_type == GROUND:
        can_use_mobility = false
```

### 8.2 Tenacity (CC Duration Reduction)

```
actual_cc_duration = base_cc_duration * (1 - tenacity)
actual_cc_duration = max(actual_cc_duration, 0.5)  # Minimum 0.5 second CC
```

Note: Knockups and suppressions are NOT reduced by tenacity.

---

## 9. Vision System

### 9.1 Fog of War Visibility

```
def is_visible(entity, viewer):
    distance = sqrt((entity.x - viewer.x)^2 + (entity.y - viewer.y)^2)
    return distance <= viewer.sight_range
```

### 9.2 Default Sight Ranges

| Entity Type | Sight Range |
|-------------|-------------|
| Champion    | 1200        |
| Minion      | 800         |
| Tower       | 1000        |
| Ward        | 900         |

---

## 10. Movement

### 10.1 Movement Per Tick

```
distance_this_tick = movement_speed * delta_time

direction = normalize(target_position - current_position)
new_position = current_position + direction * distance_this_tick

# Don't overshoot
if distance(new_position, target_position) > distance(current_position, target_position):
    new_position = target_position
```

### 10.2 Slow Calculation

Multiple slows do NOT stack multiplicatively. Only the strongest slow applies:

```
effective_slow = max(all_slow_values)
effective_movement_speed = base_movement_speed * (1 - effective_slow)
effective_movement_speed = max(effective_movement_speed, 110)  # Minimum move speed
```

---

## 11. Combat

### 11.1 Attack Cooldown

```
attack_cooldown = 1 / attack_speed  # In seconds
```

### 11.2 Critical Strike

```
if random() < crit_chance:
    damage = base_damage * crit_damage_multiplier  # Default: 2.0
else:
    damage = base_damage
```

### 11.3 Lifesteal

```
health_restored = physical_damage_dealt * lifesteal_percent
```

---

## Verification Notes

All implementations must pass the test fixtures in `/packages/protocol/tests/fixtures/` which contain concrete input/output pairs for each formula.

Floating point tolerance: Results should match within ±0.01 for most calculations, ±0.001 for percentages.
