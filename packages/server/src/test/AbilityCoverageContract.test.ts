/**
 * Ability coverage contract.
 *
 * Every ability in every champion's kit must either have a registered ability
 * handler, or use only definition fields that the generic paths execute for
 * its target type. A new champion whose kit needs something the generic paths
 * don't do fails here instead of silently doing nothing.
 *
 * GENERIC_SUPPORT mirrors ServerAbilityExecutor (cast flow, target validation
 * and dispatch) and the generic paths it dispatches to in abilities/generic/.
 * It is typed over every AbilityDefinition field, so adding a field fails the
 * typecheck until it is classified. When a generic path learns a field,
 * update its rule; when an ability needs a field no generic path executes,
 * give the ability a handler.
 */

import { describe, test, expect } from 'bun:test';
import {
  CHAMPION_DEFINITIONS,
  getAbilityDefinition,
  type AbilityDefinition,
  type AbilitySlot,
  type AbilityTargetType,
} from '@siege/shared';
import { abilityHandlerRegistry, championHooksRegistry } from '../abilities';
// Registers all ability handlers and champion hooks (once per test process)
import './ServerTestUtils';

const SLOTS: AbilitySlot[] = ['Q', 'W', 'E', 'R'];

// =============================================================================
// Generic executor support
// =============================================================================

/** true if a generic path executes the field, otherwise why it needs a handler */
type Support = true | string;
type FieldRule = (definition: AbilityDefinition) => Support;

/** Target types ServerAbilityExecutor.executeAbility dispatches to a generic path */
const GENERIC_TARGET_TYPES: AbilityTargetType[] = [
  'self', 'no_target', 'target_enemy', 'target_ally', 'skillshot', 'ground_target',
];

/** Target types that give a dash or teleport somewhere to go */
const DESTINATION_TARGET_TYPES: AbilityTargetType[] = [
  'skillshot', 'ground_target', 'target_enemy', 'target_ally', 'target_unit',
];

/** Charge fields read by the generic skillshot path (generic/Skillshot) */
const GENERIC_CHARGE_FIELDS = ['minChargeTime', 'maxChargeTime', 'maxChargeRangeBonus'];

const always: FieldRule = () => true;

const never = (reason: string): FieldRule => () => reason;

const onlyFor = (targetTypes: AbilityTargetType[], field: string): FieldRule => (d) =>
  targetTypes.includes(d.targetType) || `${field} is only executed for ${targetTypes.join('/')} abilities`;

/** Skillshots with a dash skip the projectile; the dash carries the ability */
const isProjectileSkillshot = (d: AbilityDefinition) => d.targetType === 'skillshot' && !d.dash;

const projectileField = (field: string): FieldRule => (d) =>
  isProjectileSkillshot(d) || `${field} is only used by skillshots that fire a projectile`;

/** Circular ground_target areas: not traps, not cones */
const isCircleArea = (d: AbilityDefinition) =>
  d.targetType === 'ground_target' && !d.trap && !(d.shape === 'cone' && d.coneAngle);

const zoneField = (field: string): FieldRule => (d) =>
  isCircleArea(d) || `${field} is only used by circular ground_target areas`;

/** Entity-type filters apply to targeted validation, areas, cones, projectiles and zones */
const entityFilter: FieldRule = (d) =>
  !d.dash || 'dash collisions ignore entity-type filters';

const GENERIC_SUPPORT: Record<keyof AbilityDefinition, FieldRule> = {
  // Identity, cost and dispatch (ServerAbilityExecutor: castAbility, validateTarget)
  id: always,
  name: always,
  description: always,
  type: always,
  maxRank: always,
  manaCost: always,
  cooldown: always,
  range: always,
  targetType: (d) =>
    GENERIC_TARGET_TYPES.includes(d.targetType) || `targetType '${d.targetType}' has no generic execution path`,
  castTime: (d) => !d.castTime || 'castTime is not implemented: casts resolve instantly',
  excludesSelf: always,

  // Damage, healing, shields and effects (the generic/ path modules)
  damage: (d) => {
    if (d.targetType === 'self' || d.targetType === 'target_ally') {
      return `damage is not applied by ${d.targetType} abilities`;
    }
    if (d.trap) return 'traps deal trap.explosionDamage, not damage';
    if (d.targetType === 'skillshot' && d.dash && !d.aoeRadius) {
      return 'dash skillshots only deal damage on dash collision, which needs aoeRadius';
    }
    return true;
  },
  heal: onlyFor(['no_target', 'target_ally'], 'heal'),
  shield: (d) => {
    if (d.targetType === 'self' && d.statTransform) return 'self abilities with statTransform skip shield';
    return onlyFor(['self', 'target_ally'], 'shield')(d);
  },
  appliesEffects: (d) => {
    if (d.targetType === 'self' && d.statTransform) return 'self abilities with statTransform skip appliesEffects';
    if (d.trap) return 'traps ignore appliesEffects';
    return true;
  },
  effectDuration: always,
  affectsChampions: entityFilter,
  affectsMinions: entityFilter,
  affectsTowers: entityFilter,
  affectsJungleCamps: entityFilter,
  affectsWards: entityFilter,

  // Projectiles (generic/Skillshot)
  projectileSpeed: projectileField('projectileSpeed'),
  projectileRadius: projectileField('projectileRadius'),
  piercing: projectileField('piercing'),
  stopsOnWall: never('stopsOnWall is not read by the server'),

  // Areas and zones (generic/NoTargetArea, GroundTarget, Cone, Trap; aura: StatTransform)
  shape: (d) =>
    d.shape !== 'cone' || (d.targetType === 'ground_target' && d.coneAngle !== undefined) ||
    'cone shape is only executed for ground_target abilities with coneAngle',
  coneAngle: (d) =>
    (d.targetType === 'ground_target' && d.shape === 'cone') || 'coneAngle is only used by cone ground_target abilities',
  aoeRadius: (d) =>
    d.targetType === 'no_target' || d.targetType === 'ground_target' || d.dash !== undefined ||
    'aoeRadius is only used by no_target/ground_target areas and dash hitboxes',
  aoeDelay: (d) =>
    d.targetType === 'no_target' || d.targetType === 'ground_target' ||
    'aoeDelay is only scheduled for no_target and ground_target areas (circles and cones)',
  aoeDuration: never('aoeDuration is not read by the executor (zones use zoneDuration)'),
  aoeTickRate: never('aoeTickRate is not read by the executor (zones use zoneTickRate)'),
  // Quoted because the lint id-denylist reserves the identifier
  'width': never('width is not read by the executor'),
  zoneDuration: zoneField('zoneDuration'),
  zoneTickRate: zoneField('zoneTickRate'),
  trap: onlyFor(['ground_target'], 'trap'),
  aura: (d) =>
    (d.targetType === 'self' && d.statTransform !== undefined) || 'aura is only started by self statTransform abilities',

  // Movement (generic/Movement)
  dash: (d) =>
    DESTINATION_TARGET_TYPES.includes(d.targetType) || `dash needs a destination, which ${d.targetType} abilities lack`,
  teleport: (d) =>
    DESTINATION_TARGET_TYPES.includes(d.targetType) || `teleport needs a destination, which ${d.targetType} abilities lack`,
  // Read by ServerAbilityExecutor's rooted check: the ability's handler moves the caster
  movesCaster: always,
  recastMovesCaster: (d) => d.recast !== undefined || 'recastMovesCaster needs a recast',

  // Composable behaviors (recast: ServerAbilityExecutor.handleRecast and generic/Movement;
  // charge: generic/Skillshot; statTransform: generic/StatTransform)
  recast: (d) => {
    if (!isProjectileSkillshot(d)) return 'generic recast is enabled by projectile hits, so it needs a projectile skillshot';
    if (typeof d.recast !== 'number') return 'generic recast dashes to the hit position; a different recast ability needs a handler';
    if (d.recastCondition !== 'on_hit' && d.recastCondition !== 'always') {
      return `recastCondition '${d.recastCondition}' is never enabled by projectiles`;
    }
    return true;
  },
  recastWindow: always, // checked by the recast rule
  recastCondition: always, // checked by the recast rule
  charge: (d) => {
    if (!isProjectileSkillshot(d)) return 'charge only extends the range of projectile skillshots';
    const unread = Object.keys(d.charge!).filter((key) => !GENERIC_CHARGE_FIELDS.includes(key));
    return unread.length === 0 || `charge.${unread.join(', charge.')} not read by the server`;
  },
  statTransform: (d) => {
    if (d.targetType !== 'self') return 'statTransform is only executed for self abilities';
    return d.statTransform!.canEndEarly === undefined || 'statTransform.canEndEarly is not implemented';
  },
  ammo: never('ammo charges are not tracked by the executor'),
  channel: never('channels are not implemented by the executor'),
  toggle: never('toggles are not implemented by the executor'),
  transform: never('form transforms are not implemented by the executor'),
  empowered: never('empowered behavior is not implemented by the executor'),
  postEffects: never('postEffects are not implemented by the executor'),

  // Passive-only fields
  passiveTrigger: never('passive fields are not executed by the ability executor'),
  passiveCooldown: never('passive fields are not executed by the ability executor'),
};

/**
 * Fields of a definition that no generic path executes, with the reason.
 */
function findGenericGaps(definition: AbilityDefinition): Record<string, string> {
  const gaps: Record<string, string> = {};
  for (const [field, value] of Object.entries(definition)) {
    if (value === undefined) continue;
    const rule = GENERIC_SUPPORT[field as keyof AbilityDefinition];
    const support = rule ? rule(definition) : 'unclassified field: add a rule to GENERIC_SUPPORT';
    if (support !== true) gaps[field] = support;
  }
  return gaps;
}

// =============================================================================
// Known gaps
// =============================================================================

/**
 * Abilities without a handler that use a field no generic path executes
 * correctly, with what goes wrong in game. Each entry is a real bug, listed
 * so it stays visible. Fixing it (a handler or generic support) makes the
 * entry stale, which fails the contract until the entry is removed.
 */
const KNOWN_GAPS: Record<string, Partial<Record<keyof AbilityDefinition, string>>> = {};

// =============================================================================
// Contract
// =============================================================================

const allChampionAbilityIds = Object.values(CHAMPION_DEFINITIONS).flatMap((champion) =>
  SLOTS.map((slot) => champion.abilities[slot])
);

describe('Ability coverage contract', () => {
  for (const [championId, champion] of Object.entries(CHAMPION_DEFINITIONS)) {
    describe(championId, () => {
      for (const slot of SLOTS) {
        const abilityId = champion.abilities[slot];

        test(`${slot} (${abilityId}) has a handler or full generic support`, () => {
          const definition = getAbilityDefinition(abilityId);
          expect(definition).toBeDefined();

          if (abilityHandlerRegistry.has(abilityId)) return;

          const gaps = findGenericGaps(definition!);
          const known = KNOWN_GAPS[abilityId] ?? {};
          const unexpected = Object.keys(gaps)
            .filter((field) => !(field in known))
            .map((field) => `${field}: ${gaps[field]}`);
          const fixed = Object.keys(known)
            .filter((field) => !(field in gaps))
            .map((field) => `${field}: no longer a gap, remove it from KNOWN_GAPS`);

          expect({ abilityId, unexpected, fixed }).toEqual({ abilityId, unexpected: [], fixed: [] });
        });
      }
    });
  }

  test('every ability definition field is classified', () => {
    const unclassified = allChampionAbilityIds.flatMap((abilityId) =>
      Object.keys(getAbilityDefinition(abilityId) ?? {})
        .filter((field) => !(field in GENERIC_SUPPORT))
        .map((field) => `${abilityId}.${field}`)
    );
    expect(unclassified).toEqual([]);
  });

  test('known gaps only list champion abilities without a handler', () => {
    const stale = Object.keys(KNOWN_GAPS).filter(
      (abilityId) => !allChampionAbilityIds.includes(abilityId) || abilityHandlerRegistry.has(abilityId)
    );
    expect(stale).toEqual([]);
  });

  test('every ability handler belongs to a champion kit', () => {
    const orphans = abilityHandlerRegistry
      .getRegisteredAbilities()
      .filter((abilityId) => !allChampionAbilityIds.includes(abilityId));
    expect(orphans).toEqual([]);
  });

  test('every champion hook set belongs to a champion', () => {
    const orphans = championHooksRegistry
      .getRegisteredChampions()
      .filter((championId) => !(championId in CHAMPION_DEFINITIONS));
    expect(orphans).toEqual([]);
  });
});
