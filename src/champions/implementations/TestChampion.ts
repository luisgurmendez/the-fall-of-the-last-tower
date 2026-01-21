/**
 * TestChampion - A simple champion for testing ability input.
 *
 * Q: Arrow Shot - Fires a skillshot arrow in the mouse direction
 * W: Speed Boost - Self buff
 * E: (placeholder)
 * R: (placeholder)
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import { Side } from '@/types';
import { Champion } from '@/champions/Champion';
import { ChampionDefinition } from '@/champions/types';
import Ability from '@/abilities/Ability';
import { SkillshotAbility } from '@/abilities/SkillshotAbility';
import { AbilitySlot, AbilityDefinition, AbilityCastContext } from '@/abilities/types';
import { DamageEffect } from '@/effects/StatEffect';
import { TargetedProjectile, TargetedProjectileConfig } from '@/abilities/projectiles/TargetedProjectile';

// ===================
// Custom Arrow Projectile for Auto Attacks
// ===================

class ArrowProjectile extends TargetedProjectile {
  /**
   * Render the arrow projectile with custom visuals.
   */
  protected override renderProjectile(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const pos = this.position;
    const angle = Math.atan2(this.direction.y, this.direction.x);

    // Arrow shaft
    const shaftLength = 25;
    const shaftEnd = new Vector(
      pos.x - Math.cos(angle) * shaftLength,
      pos.y - Math.sin(angle) * shaftLength
    );

    ctx.strokeStyle = '#8B4513'; // Brown shaft
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shaftEnd.x, shaftEnd.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    // Arrowhead (silver triangle)
    const headLength = 8;
    const headWidth = 5;
    const tipPos = new Vector(
      pos.x + Math.cos(angle) * headLength,
      pos.y + Math.sin(angle) * headLength
    );
    const leftBarb = new Vector(
      pos.x + Math.cos(angle + Math.PI * 0.8) * headWidth,
      pos.y + Math.sin(angle + Math.PI * 0.8) * headWidth
    );
    const rightBarb = new Vector(
      pos.x + Math.cos(angle - Math.PI * 0.8) * headWidth,
      pos.y + Math.sin(angle - Math.PI * 0.8) * headWidth
    );

    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath();
    ctx.moveTo(tipPos.x, tipPos.y);
    ctx.lineTo(leftBarb.x, leftBarb.y);
    ctx.lineTo(rightBarb.x, rightBarb.y);
    ctx.closePath();
    ctx.fill();

    // Fletching (feathers at the back)
    const fletchOffset = shaftLength - 5;
    const fletchLength = 6;
    ctx.strokeStyle = '#F5F5DC'; // Beige feathers
    ctx.lineWidth = 2;

    for (const angle_offset of [-0.3, 0, 0.3]) {
      const fletchStart = new Vector(
        pos.x - Math.cos(angle) * fletchOffset,
        pos.y - Math.sin(angle) * fletchOffset
      );
      const fletchEnd = new Vector(
        fletchStart.x + Math.cos(angle + Math.PI / 2 + angle_offset) * fletchLength,
        fletchStart.y + Math.sin(angle + Math.PI / 2 + angle_offset) * fletchLength
      );
      ctx.beginPath();
      ctx.moveTo(fletchStart.x, fletchStart.y);
      ctx.lineTo(fletchEnd.x, fletchEnd.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ===================
// Champion Definition
// ===================

const TestChampionDefinition: ChampionDefinition = {
  id: 'test_champion',
  name: 'Test Champion',
  title: 'The Tester',
  class: 'marksman',
  attackType: 'ranged',
  resourceType: 'mana',

  baseStats: {
    health: 500,
    healthRegen: 5,
    resource: 300,
    resourceRegen: 8,
    attackDamage: 50,
    abilityPower: 0,
    attackSpeed: 0.65,
    attackRange: 500,
    armor: 25,
    magicResist: 25,
    movementSpeed: 50,
    critChance: 0,
    critDamage: 2.0,
  },

  growthStats: {
    health: 80,
    healthRegen: 0.5,
    resource: 30,
    resourceRegen: 0.5,
    attackDamage: 3,
    attackSpeed: 2,
    armor: 3,
    magicResist: 1,
  },

  abilities: {
    Q: 'test_arrow_shot',
    W: 'test_speed_boost',
    E: 'test_placeholder',
    R: 'test_placeholder_ult',
  },
};

// ===================
// Simple Placeholder Ability
// ===================

class PlaceholderAbility extends Ability {
  protected execute(context: AbilityCastContext): void {
    // Does nothing
  }
}

// ===================
// Speed Boost Ability (Self Buff)
// ===================

class SpeedBoostAbility extends Ability {
  protected execute(context: AbilityCastContext): void {
    if (!this.owner) return;

    // Add movement speed buff
    this.owner.addStatModifier('movementSpeed', 50, 0);

    // Remove after 3 seconds (simplified)
    setTimeout(() => {
      this.owner?.removeStatModifier('movementSpeed', 50, 0);
    }, 3000);
  }
}

// ===================
// TestChampion Class
// ===================

export class TestChampion extends Champion {
  protected readonly definition = TestChampionDefinition;

  constructor(position: Vector, side: Side) {
    super(position, side);
  }

  /**
   * Initialize abilities.
   */
  protected initializeAbilities(): void {
    // Q: Arrow Shot (skillshot)
    const arrowShot = new SkillshotAbility(
      {
        id: 'test_arrow_shot',
        name: 'Arrow Shot',
        description: 'Fire an arrow in target direction dealing {damage} physical damage.',
        range: 800,
        width: 40,
        projectile: {
          speed: 1200,
          ttl: 1.5,
          radius: 20,
          piercing: false,
          width: 6,
          color: '#A0522D', // Brown arrow
        },
        onHitEffects: [new DamageEffect(80, 'physical')],
        manaCost: [40, 45, 50, 55, 60],
        cooldown: [6, 5.5, 5, 4.5, 4],
      },
      'Q'
    );
    arrowShot.setOwner(this);

    // W: Speed Boost (self buff)
    const speedBoostDef: AbilityDefinition = {
      id: 'test_speed_boost',
      name: 'Speed Boost',
      description: 'Gain 50 movement speed for 3 seconds.',
      type: 'active',
      targetType: 'self',
      maxRank: 5,
      manaCost: [50, 55, 60, 65, 70],
      cooldown: [12, 11, 10, 9, 8],
    };
    const speedBoost = new SpeedBoostAbility(speedBoostDef, 'W');
    speedBoost.setOwner(this);

    // E: Placeholder
    const placeholderEDef: AbilityDefinition = {
      id: 'test_placeholder',
      name: 'Placeholder E',
      description: 'Not implemented.',
      type: 'active',
      targetType: 'no_target',
      maxRank: 5,
      manaCost: [0, 0, 0, 0, 0],
      cooldown: [10, 10, 10, 10, 10],
    };
    const placeholderE = new PlaceholderAbility(placeholderEDef, 'E');
    placeholderE.setOwner(this);

    // R: Placeholder
    const placeholderRDef: AbilityDefinition = {
      id: 'test_placeholder_ult',
      name: 'Placeholder R',
      description: 'Not implemented.',
      type: 'active',
      targetType: 'no_target',
      maxRank: 3,
      manaCost: [100, 100, 100],
      cooldown: [100, 80, 60],
    };
    const placeholderR = new PlaceholderAbility(placeholderRDef, 'R');
    placeholderR.setOwner(this);

    // Add to abilities map
    this.abilities.set('Q', arrowShot);
    this.abilities.set('W', speedBoost);
    this.abilities.set('E', placeholderE);
    this.abilities.set('R', placeholderR);
  }

  /**
   * Initialize the champion.
   */
  override init(gctx: GameContext): void {
    super.init(gctx);

    // Auto rank up Q and W for testing
    const qAbility = this.abilities.get('Q');
    const wAbility = this.abilities.get('W');
    if (qAbility) qAbility.rankUp();
    if (wAbility) wAbility.rankUp();
  }

  /**
   * Update loop.
   */
  override step(gctx: GameContext): void {
    super.step(gctx);

    // Update skillshot ability with game context
    const qAbility = this.abilities.get('Q');
    if (qAbility instanceof SkillshotAbility) {
      qAbility.setGameContext(gctx);
    }
  }

  /**
   * Render the champion.
   */
  protected renderChampion(gctx: GameContext): void {
    const ctx = gctx.canvasRenderingContext;
    const pos = this.position;

    // Body (archer-like blue/purple)
    ctx.fillStyle = this.side === 0 ? '#4169E1' : '#8B008B';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
    ctx.fill();

    // Bow
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    const bowAngle = Math.atan2(this.direction.y, this.direction.x);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 25, bowAngle - 0.8, bowAngle + 0.8);
    ctx.stroke();

    // Bowstring
    ctx.strokeStyle = '#F5F5DC';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const stringStart = new Vector(
      pos.x + Math.cos(bowAngle - 0.8) * 25,
      pos.y + Math.sin(bowAngle - 0.8) * 25
    );
    const stringEnd = new Vector(
      pos.x + Math.cos(bowAngle + 0.8) * 25,
      pos.y + Math.sin(bowAngle + 0.8) * 25
    );
    ctx.moveTo(stringStart.x, stringStart.y);
    ctx.lineTo(stringEnd.x, stringEnd.y);
    ctx.stroke();

    // Arrow nocked
    ctx.strokeStyle = '#A0522D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(
      pos.x + this.direction.x * 30,
      pos.y + this.direction.y * 30
    );
    ctx.stroke();

    // Arrow tip
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath();
    ctx.arc(
      pos.x + this.direction.x * 30,
      pos.y + this.direction.y * 30,
      3,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Health bar
    this.renderHealthBar(ctx, pos);

    // Mana bar
    this.renderManaBar(ctx, pos);
  }

  /**
   * Create a custom arrow projectile for ranged basic attacks.
   */
  protected override createBasicAttackProjectile(
    target: Champion,
    damage: number,
    isCrit: boolean,
    onHit: (target: Champion, damage: number) => void
  ): TargetedProjectile | null {
    return new ArrowProjectile(
      this.position.clone(),
      target,
      this,
      {
        speed: 1400,
        damage,
        damageType: 'physical',
        onHit,
        damageSource: 'Basic Attack',
      }
    );
  }

  /**
   * Render health bar.
   */
  private renderHealthBar(ctx: CanvasRenderingContext2D, pos: Vector): void {
    const stats = this.getStats();
    const healthPercent = this.state.health / stats.maxHealth;

    const barWidth = 40;
    const barHeight = 5;
    const barY = pos.y - 28;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(pos.x - barWidth / 2, barY, barWidth, barHeight);

    // Health
    ctx.fillStyle = this.side === 0 ? '#4CAF50' : '#F44336';
    ctx.fillRect(
      pos.x - barWidth / 2,
      barY,
      barWidth * healthPercent,
      barHeight
    );
  }

  /**
   * Render mana bar.
   */
  private renderManaBar(ctx: CanvasRenderingContext2D, pos: Vector): void {
    const stats = this.getStats();
    const manaPercent = this.state.resource / stats.maxResource;

    const barWidth = 40;
    const barHeight = 3;
    const barY = pos.y - 22;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(pos.x - barWidth / 2, barY, barWidth, barHeight);

    // Mana (blue)
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(
      pos.x - barWidth / 2,
      barY,
      barWidth * manaPercent,
      barHeight
    );
  }
}

export default TestChampion;
