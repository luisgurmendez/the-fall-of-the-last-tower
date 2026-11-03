/**
 * The shapes an ability's preview draws (src/ui/hud/abilityPreview.ts), in
 * world space, against what the server does: a projectile's band is its
 * width, an area around the caster is around the caster wherever the cursor
 * is, a ground circle sits at the cursor brought within range, a dash goes
 * to the cursor up to its distance, and Lume's orb abilities start at the orb.
 */
import { describe, it, expect } from 'bun:test';
import { CHAMPION_DEFINITIONS, getAbilityDefinition, type AbilityDefinition, type AbilitySlot } from '@siege/shared';
import Vector from '@/physics/vector';
import { abilityPreview, type PreviewShape } from '@/ui/hud/abilityPreview';

const ability = (championId: string, slot: AbilitySlot): AbilityDefinition =>
  getAbilityDefinition(CHAMPION_DEFINITIONS[championId].abilities[slot])!;

const FROM = new Vector(100, 100);
const shapes = (definition: AbilityDefinition, cursor: Vector, orb: Vector | null = null) =>
  abilityPreview(definition, FROM, cursor, orb);
const only = <K extends PreviewShape['kind']>(list: PreviewShape[], kind: K) =>
  list.filter((shape): shape is Extract<PreviewShape, { kind: K }> => shape.kind === kind);

describe('ability previews', () => {
  it("a projectile's band is as wide as the projectile (Magnus's fireball: twice its radius) and as long as its range", () => {
    const fireball = ability('magnus', 'Q');
    const [band] = only(shapes(fireball, new Vector(100, 900)), 'band');
    expect(band.width).toBe(fireball.projectileRadius! * 2);
    expect(band.length).toBe(fireball.range);
    expect(band.direction.x).toBeCloseTo(0);
    expect(band.direction.y).toBeCloseTo(1);
  });

  it("every skillshot projectile's band is twice its radius", () => {
    for (const champion of Object.values(CHAMPION_DEFINITIONS)) {
      for (const slot of ['Q', 'W', 'E', 'R'] as const) {
        const definition = ability(champion.id, slot);
        if (definition.targetType !== 'skillshot' || !definition.projectileRadius) continue;
        const [band] = only(shapes(definition, new Vector(400, 100)), 'band');
        expect({ id: definition.id, width: band?.width }).toEqual({ id: definition.id, width: definition.projectileRadius * 2 });
      }
    }
  });

  it("a line area (Urûk's thrust, Calamitus's W) is twice its aoeRadius wide", () => {
    for (const [championId, slot] of [['uruk', 'Q'], ['calamitus', 'W']] as const) {
      const definition = ability(championId, slot);
      const [band] = only(shapes(definition, new Vector(500, 100)), 'band');
      expect(band.width).toBe(definition.aoeRadius! * 2);
      expect(band.length).toBe(definition.range);
    }
  });

  it("Kael's charge goes to the cursor, up to its distance, as wide as its hitbox", () => {
    const charge = ability('warrior', 'E');
    const near = only(shapes(charge, new Vector(200, 100)), 'band')[0];
    expect(near.length).toBeCloseTo(100);
    expect(near.width).toBe(charge.aoeRadius! * 2);
    const far = only(shapes(charge, new Vector(2000, 100)), 'band')[0];
    expect(far.length).toBe(charge.dash!.distance);
  });

  it('a dash with no hitbox shows where it lands: the cursor, brought within its distance', () => {
    for (const [championId, slot] of [['vex', 'E'], ['elora', 'E'], ['oitboil', 'E'], ['hop', 'E']] as const) {
      const definition = ability(championId, slot);
      const [landing] = only(shapes(definition, new Vector(100 + 2000, 100)), 'landing');
      expect(landing.at.x).toBeCloseTo(100 + definition.dash!.distance);
      const [close] = only(shapes(definition, new Vector(150, 100)), 'landing');
      expect(close.at.x).toBeCloseTo(150);
    }
  });

  it('an area around the caster is drawn around the caster, wherever the cursor is', () => {
    const around = [['calamitus', 'Q'], ['calamitus', 'R'], ['oitboil', 'Q'], ['protobot', 'R'], ['zhakrul', 'W'],
      ['elara', 'E'], ['elara', 'R'], ['gorath', 'Q'], ['gorath', 'E'], ['gorath', 'R'], ['uruk', 'E']] as const;
    for (const [championId, slot] of around) {
      const definition = ability(championId, slot);
      const [area] = only(shapes(definition, new Vector(900, -400)), 'area');
      expect({ id: definition.id, x: area?.center.x, y: area?.center.y, radius: area?.radius })
        .toEqual({ id: definition.id, x: FROM.x, y: FROM.y, radius: definition.aoeRadius });
    }
  });

  it('a ground circle sits at the cursor, brought within range', () => {
    const mud = ability('magnus', 'E');
    const [inside] = only(shapes(mud, new Vector(200, 100)), 'area');
    expect(inside.center.x).toBeCloseTo(200);
    const [outside] = only(shapes(mud, new Vector(100 + 5000, 100)), 'area');
    expect(outside.center.x).toBeCloseTo(100 + mud.range!);
    expect(outside.radius).toBe(mud.aoeRadius);
  });

  it('shows the range circle for ranged abilities, and not for cones or areas around the caster', () => {
    expect(only(shapes(ability('magnus', 'E'), new Vector(0, 0)), 'range')[0].radius).toBe(ability('magnus', 'E').range);
    expect(only(shapes(ability('elara', 'Q'), new Vector(0, 0)), 'range')[0].radius).toBe(ability('elara', 'Q').range);
    expect(only(shapes(ability('warrior', 'Q'), new Vector(0, 0)), 'range')).toHaveLength(0);
    expect(only(shapes(ability('gorath', 'R'), new Vector(0, 0)), 'range')).toHaveLength(0);
  });

  it('a cone points at the cursor with its angle and reach', () => {
    const slash = ability('warrior', 'Q');
    const [cone] = only(shapes(slash, new Vector(100, -500)), 'cone');
    expect(cone.radius).toBe(slash.aoeRadius ?? slash.range);
    expect(cone.angle).toBe(slash.coneAngle);
    expect(cone.direction.y).toBeCloseTo(-1);
  });

  it("Lume's orb abilities start at the orb, and show nothing without it", () => {
    const orb = new Vector(400, 400);
    const [pulse] = only(shapes(ability('lume', 'W'), new Vector(0, 0), orb), 'area');
    expect(pulse.center.x).toBe(orb.x);
    expect(pulse.radius).toBe(ability('lume', 'W').aoeRadius);
    const [beam] = only(shapes(ability('lume', 'R'), new Vector(400, 1400), orb), 'band');
    expect(beam.from.x).toBe(orb.x);
    expect(beam.width).toBe(ability('lume', 'R').aoeRadius! * 2);
    expect(beam.direction.y).toBeCloseTo(1);
    expect(shapes(ability('lume', 'W'), new Vector(0, 0), null).filter(shape => shape.kind !== 'range')).toHaveLength(0);
  });

  it('self buffs with no area show nothing', () => {
    expect(shapes(ability('warrior', 'W'), new Vector(0, 0))).toHaveLength(0);
    expect(shapes(ability('vex', 'R'), new Vector(0, 0))).toHaveLength(0);
  });

  it("Vile's charged arrow: its band and range circle grow with the charge, as on the server", () => {
    const arrows = ability('vile', 'Q');
    const bonus = arrows.charge!.maxChargeRangeBonus!;
    for (const charge of [0, 0.5, 1]) {
      const list = abilityPreview(arrows, FROM, new Vector(100, 900), null, charge);
      expect(only(list, 'band')[0].length).toBeCloseTo(arrows.range! + bonus * charge);
      expect(only(list, 'range')[0].radius).toBeCloseTo(arrows.range! + bonus * charge);
    }
    // Not charging: its base range
    expect(only(shapes(arrows, new Vector(100, 900)), 'band')[0].length).toBe(arrows.range);
  });
});
