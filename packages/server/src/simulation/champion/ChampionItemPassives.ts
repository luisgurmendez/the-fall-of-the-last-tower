/**
 * ChampionItemPassives - What a champion's items do besides their stats and
 * actives.
 *
 * Each passive in the item catalog (@siege/shared config/items.ts) has an
 * effectType, applied here. The champion reports to it:
 * - its basic attacks landing (onBasicAttackHit): on-hit damage, lifesteal,
 *   charged and counted attacks, slows and speed
 * - damage it deals, of any kind (onDamageDealt): omnivamp, Wounds, burns,
 *   slows and armor shred from abilities, Tithe, Harvest
 * - damage it's about to deal (amplifyDamage): executes, Giantslayer,
 *   structure and monster damage
 * - damage it's about to take (reduceIncomingDamage): Veil, Bark, Hobnails,
 *   Chill Shell; basic attacks that land on it (onHitByBasicAttack): thorns
 * - heals and shields it gives an ally (onAllyHealedOrShielded): Hymn, Renewal
 * - takedowns, kills and its death: stacking items
 * - each tick (update): burns, auras, Lone Wolf, Wanderlust, Static's charge
 *
 * Damage its items deal counts as item damage (ServerChampion.withDamageKind),
 * so it doesn't set off other item passives meant for attacks and abilities.
 * Passives with the same stack key apply once however many items carry them
 * (the one on the most expensive item wins), and cooldowns are kept by
 * passive id. Some passives show their state with an effect on the champion
 * (item_static, item_veil...).
 */

import {
  EntityType,
  GameEventType,
  calculateStat,
  getItemCatalogEntry,
  type DamageType,
  type EquippedItemState,
  type ItemCatalogEntry,
  type ItemPassiveData,
  type ItemPassiveEffect,
} from '@siege/shared';
import type { ServerEntity } from '../ServerEntity';
import type { ServerChampion, DamageKind } from '../ServerChampion';
import type { ServerGameContext } from '../../game/ServerGameContext';

/** A passive on an item the champion holds */
interface HeldPassive {
  passive: ItemPassiveData;
  item: EquippedItemState;
  definition: ItemCatalogEntry;
}

/** A burn this champion's items keep on a target */
interface Burn {
  perSecond: number;
  until: number;
  nextTickIn: number;
}

/** Seconds between ticks of burns, auras and the like */
const TICK = 0.5;
/** Seconds between immolate hits */
const IMMOLATE_INTERVAL = 1;
/** Minions and monsters take this much more from immolates */
const IMMOLATE_NON_CHAMPION_BONUS = 1.5;
/** Omnivamp heals for this share against minions and monsters */
const OMNIVAMP_NON_CHAMPION_SHARE = 1 / 3;
/** Monsters that count as epic for Bedrock */
const EPIC_MONSTERS = new Set(['dragon', 'rootwyrm']);

/** Hymn's on-hit damage, from the catalog */
const HYMN_ON_HIT = Number(getItemCatalogEntry('dawnsong_censer')?.passives.find(p => p.effectType === 'ally_buff_on_heal')?.effectData.onHit ?? 0);

export class ChampionItemPassives {
  /** Remaining cooldown, by passive id */
  private readonly cooldowns = new Map<string, number>();
  /** Spellblade passives charged by an ability cast: game time the charge ends */
  private readonly chargedUntil = new Map<string, number>();
  /** Burns on targets, by target id */
  private readonly burns = new Map<string, Burn>();
  private tickIn = TICK;
  private immolateIn = IMMOLATE_INTERVAL;
  /** Game time of its last basic attack on a champion (Opening Cut) */
  private lastChampionHitAt = -Infinity;
  /** Basic attacks landed, for Triple Volley */
  private attackCount = 0;
  /** Static's charge (0-100) and where the champion was, to count distance walked */
  private staticCharge = 0;
  private lastPosition: { x: number; y: number } | null = null;
  /** Tithe's charges and the time to its next one */
  private titheCharges = -1;
  private titheRechargeIn = 0;
  /** Healing from Harvest is limited */
  private harvestHealIn = 0;
  /** A Renewal echo is being healed: it doesn't echo again */
  private echoing = false;

  constructor(private readonly champion: ServerChampion) {}

  // ===========================================================================
  // Tick
  // ===========================================================================

  /**
   * Count down cooldowns; tick burns and immolates; keep auras and
   * conditional buffs up.
   */
  update(dt: number, context: ServerGameContext): void {
    for (const [passiveId, remaining] of this.cooldowns) {
      if (remaining - dt <= 0) this.cooldowns.delete(passiveId);
      else this.cooldowns.set(passiveId, remaining - dt);
    }
    this.harvestHealIn = Math.max(0, this.harvestHealIn - dt);
    this.updateBurns(dt, context);
    this.updateTithe(dt);

    const champion = this.champion;
    if (champion.isDead) {
      this.lastPosition = null;
      return;
    }
    this.updateStatic();

    this.immolateIn -= dt;
    if (this.immolateIn <= 0) {
      this.immolateIn += IMMOLATE_INTERVAL;
      this.immolate(context);
    }

    this.tickIn -= dt;
    if (this.tickIn > 0) return;
    this.tickIn += TICK;
    this.refreshAuras(context);
  }

  /** Effects kept up while their condition holds, refreshed every tick */
  private refreshAuras(context: ServerGameContext): void {
    const champion = this.champion;
    const lasting = TICK * 2;

    const rally = this.passive('ally_aura');
    if (rally) {
      for (const ally of context.getAllChampions()) {
        if (ally.isDead || ally.side !== champion.side) continue;
        if (ally.position.distanceTo(champion.position) <= Number(rally.effectData.radius)) {
          ally.applyEffect(String(rally.effectData.effect), lasting, champion.id);
        }
      }
    }

    const loneWolf = this.passive('lone_wolf');
    if (loneWolf) {
      const alone = !context.getAllChampions().some(ally =>
        ally !== champion && !ally.isDead && ally.side === champion.side &&
        ally.position.distanceTo(champion.position) <= Number(loneWolf.effectData.radius));
      if (alone) champion.applyEffect(String(loneWolf.effectData.effect), lasting, champion.id);
    }

    if (this.passive('out_of_combat_ms') && !champion.inCombat) {
      champion.applyEffect('item_wanderlust', lasting, champion.id);
    }

    const veil = this.passive('spell_shield');
    if (veil && this.isReady(veil)) champion.applyEffect(String(veil.effectData.effect), lasting, champion.id);
  }

  /** Smolder and Magma: hit enemies around while in combat */
  private immolate(context: ServerGameContext): void {
    const champion = this.champion;
    const passive = this.passive('immolate');
    if (!passive || !champion.inCombat) return;
    const data = passive.effectData;
    const perSecond = Number(data.base) + Number(data.perLevel) * champion.level
      + Number(data.bonusHealthRatio) * bonusHealth(champion);
    for (const enemy of context.getEnemiesInRadius(champion.position, Number(data.radius), champion.side)) {
      if (!isUnit(enemy) || enemy.isDead) continue;
      const damage = enemy.entityType === EntityType.CHAMPION ? perSecond : perSecond * IMMOLATE_NON_CHAMPION_BONUS;
      this.dealItemDamage(enemy, damage, 'magic', context);
    }
  }

  /** Burns deal their damage every half second until they run out */
  private updateBurns(dt: number, context: ServerGameContext): void {
    const now = context.getGameTime();
    for (const [targetId, burn] of this.burns) {
      const target = context.getEntity(targetId);
      if (!target || target.isDead || now > burn.until) {
        this.burns.delete(targetId);
        continue;
      }
      burn.nextTickIn -= dt;
      while (burn.nextTickIn <= 0) {
        burn.nextTickIn += TICK;
        this.dealItemDamage(target, burn.perSecond * TICK, 'magic', context);
      }
    }
  }

  private updateTithe(dt: number): void {
    const tithe = this.passive('tithe');
    if (!tithe) {
      this.titheCharges = -1;
      return;
    }
    const max = Number(tithe.effectData.charges);
    if (this.titheCharges < 0) this.titheCharges = max;
    if (this.titheCharges >= max) return;
    this.titheRechargeIn -= dt;
    if (this.titheRechargeIn <= 0) {
      this.titheCharges++;
      this.titheRechargeIn = Number(tithe.effectData.recharge);
    }
  }

  /** Static charges with the distance walked */
  private updateStatic(): void {
    const champion = this.champion;
    const position = { x: champion.position.x, y: champion.position.y };
    const energize = this.passive('energize');
    if (energize && this.lastPosition) {
      const walked = Math.hypot(position.x - this.lastPosition.x, position.y - this.lastPosition.y);
      // A blink or a respawn isn't walking
      if (walked < 50) this.addStatic(energize, walked * Number(energize.effectData.perDistance));
    }
    this.lastPosition = position;
  }

  private addStatic(passive: ItemPassiveData, amount: number): void {
    if (this.staticCharge >= 100) return;
    this.staticCharge = Math.min(100, this.staticCharge + amount);
    if (this.staticCharge >= 100) this.champion.applyEffect(String(passive.effectData.effect), 3600, this.champion.id);
  }

  // ===========================================================================
  // Abilities and basic attacks
  // ===========================================================================

  /**
   * The champion cast an ability: charge spellblade passives that are ready.
   */
  onAbilityCast(context: ServerGameContext): void {
    for (const passive of this.passivesOfType('spellblade')) {
      if (!this.isReady(passive)) continue;
      const window = Number(passive.effectData.window ?? 10);
      this.chargedUntil.set(passive.id, context.getGameTime() + window);
      this.champion.applyEffect(markerEffectId(passive), window, this.champion.id);
    }
  }

  /**
   * One of the champion's basic attacks hit `target`, dealing `dealt` damage
   * (after the target's resistances).
   */
  onBasicAttackHit(target: ServerEntity, dealt: number, context: ServerGameContext): void {
    const champion = this.champion;
    const stats = champion.getStats();
    const now = context.getGameTime();
    const onChampion = target.entityType === EntityType.CHAMPION;

    for (const passive of this.passivesOfType('on_hit_damage')) {
      this.dealItemDamage(target, Number(passive.effectData.damage), damageTypeOf(passive), context);
    }

    const openingCut = this.passive('first_strike');
    if (openingCut && onChampion) {
      if (now - this.lastChampionHitAt >= Number(openingCut.effectData.idle)) {
        this.dealItemDamage(target, Number(openingCut.effectData.damage), damageTypeOf(openingCut), context);
      }
    }
    if (onChampion) this.lastChampionHitAt = now;

    const avalanche = this.passive('max_health_on_hit');
    if (avalanche) this.dealItemDamage(target, stats.maxHealth * Number(avalanche.effectData.percent), 'physical', context);

    const venom = this.passive('current_health_on_hit');
    if (venom) {
      let damage = Number(venom.effectData.flat) + target.health * Number(venom.effectData.percent);
      if (target.entityType === EntityType.JUNGLE_CAMP) damage = Math.min(damage, Number(venom.effectData.monsterCap));
      this.dealItemDamage(target, damage, 'magic', context);
    }

    this.attackCount++;
    const volley = this.passive('nth_hit');
    if (volley && this.attackCount % Number(volley.effectData.every) === 0) {
      this.dealItemDamage(target, Number(volley.effectData.damage), damageTypeOf(volley), context);
    }

    for (const passive of this.passivesOfType('spellblade')) {
      const charged = (this.chargedUntil.get(passive.id) ?? -Infinity) >= now;
      if (!charged) continue;
      this.chargedUntil.delete(passive.id);
      champion.removeEffect(markerEffectId(passive));
      this.startCooldown(passive);
      const bonus = Number(passive.effectData.apRatio ?? 0) * stats.abilityPower
        + Number(passive.effectData.adRatio ?? 0) * stats.attackDamage;
      this.dealItemDamage(target, bonus, damageTypeOf(passive), context);
    }

    const energize = this.passive('energize');
    if (energize) {
      if (this.staticCharge >= 100) this.discharge(energize, target, context);
      else this.addStatic(energize, Number(energize.effectData.perAttack));
    }

    if (champion.hasEffect('item_hymn') && HYMN_ON_HIT > 0) this.dealItemDamage(target, HYMN_ON_HIT, 'magic', context);

    const momentum = this.passive('ms_on_hit');
    if (momentum) champion.applyEffect(String(momentum.effectData.effect), Number(momentum.effectData.duration), champion.id);

    const harvest = this.heldPassive('monster_hunter');
    if (harvest && onChampion && this.isAwakened(harvest)) {
      (target as ServerChampion).applyEffect('slow_20', 1, champion.id);
    }

    if (stats.lifesteal > 0 && dealt > 0) this.lifesteal(dealt * stats.lifesteal, context);
  }

  /** Static discharges into the target and up to a few enemies near it */
  private discharge(passive: ItemPassiveData, target: ServerEntity, context: ServerGameContext): void {
    const champion = this.champion;
    this.staticCharge = 0;
    champion.removeEffect(String(passive.effectData.effect));
    const damage = Number(passive.effectData.damage);
    const others = context.getEnemiesInRadius(target.position, Number(passive.effectData.radius), champion.side)
      .filter(enemy => enemy !== target && isUnit(enemy) && !enemy.isDead)
      .sort((a, b) => a.position.distanceTo(target.position) - b.position.distanceTo(target.position))
      .slice(0, Number(passive.effectData.targets));
    this.dealItemDamage(target, damage, 'magic', context);
    for (const enemy of others) this.dealItemDamage(enemy, damage, 'magic', context);
    context.addEvent(GameEventType.ABILITY_CAST, { entityId: champion.id, abilityId: 'item_static', targetX: target.position.x, targetY: target.position.y });
  }

  /** Lifesteal heals; with Overfed, healing past max health becomes a shield */
  private lifesteal(amount: number, context: ServerGameContext): void {
    const champion = this.champion;
    const room = champion.maxHealth - champion.health;
    champion.heal(amount, context, champion.id);
    const overfed = this.passive('overheal_shield');
    const overflow = amount - room;
    if (!overfed || overflow <= 0) return;
    const cap = Number(overfed.effectData.base) + Number(overfed.effectData.perLevel) * champion.level;
    const duration = Number(overfed.effectData.duration);
    const shield = champion.shields.find(s => s.sourceId === 'item_overfed');
    if (shield) {
      shield.amount = Math.min(cap, shield.amount + overflow);
      shield.remainingDuration = duration;
    } else {
      champion.grantShield(Math.min(cap, overflow), duration, 'item_overfed');
    }
  }

  // ===========================================================================
  // Damage dealt and taken
  // ===========================================================================

  /**
   * Damage it's about to deal to `target`, raised by its items: Execution,
   * Giantslayer, Demolish (basic attacks on structures), Harvest (monsters).
   */
  amplifyDamage(target: ServerEntity, amount: number, _context: ServerGameContext): number {
    const champion = this.champion;
    let multiplier = 1;
    if (target.entityType === EntityType.CHAMPION) {
      const execution = this.passive('execute');
      if (execution && target.health / target.maxHealth < Number(execution.effectData.threshold)) {
        multiplier += Number(execution.effectData.bonus);
      }
      const giantslayer = this.passive('giant_slayer');
      if (giantslayer && target.maxHealth > champion.maxHealth) {
        const bonus = (target.maxHealth - champion.maxHealth) / 100 * Number(giantslayer.effectData.perHundred);
        multiplier += Math.min(Number(giantslayer.effectData.max), bonus);
      }
    } else if (isStructure(target)) {
      const demolish = this.passive('structure_damage');
      if (demolish && champion.damageKind === 'basic') multiplier += Number(demolish.effectData.bonus);
    } else if (target.entityType === EntityType.JUNGLE_CAMP) {
      const harvest = this.passive('monster_hunter');
      if (harvest) multiplier += Number(harvest.effectData.bonus);
    }
    return amount * multiplier;
  }

  /**
   * It dealt `dealt` damage (after resistances) of a kind to `target`:
   * omnivamp, Wounds, ability burns and slows, Sunder, Tithe, Harvest's heal.
   */
  onDamageDealt(target: ServerEntity, dealt: number, type: DamageType, kind: DamageKind, context: ServerGameContext): void {
    const champion = this.champion;
    if (dealt <= 0 || champion.isDead) return;
    const stats = champion.getStats();
    const onChampion = target.entityType === EntityType.CHAMPION && target.side !== champion.side;
    const victim = target as ServerChampion;

    if (stats.omnivamp > 0) {
      const bloodlust = this.passive('bloodlust');
      const doubled = bloodlust && champion.health / champion.maxHealth < Number(bloodlust.effectData.threshold);
      const share = onChampion ? 1 : OMNIVAMP_NON_CHAMPION_SHARE;
      champion.heal(dealt * stats.omnivamp * share * (doubled ? 2 : 1), context, champion.id);
    }

    if (target.entityType === EntityType.JUNGLE_CAMP) {
      const harvest = this.passive('monster_hunter');
      if (harvest && this.harvestHealIn <= 0) {
        this.harvestHealIn = TICK;
        champion.heal(Number(harvest.effectData.heal), context, champion.id);
      }
    }

    if (!onChampion || victim.isDead) return;

    for (const passive of this.passivesOfType('wounds')) {
      if (passive.effectData.damageType === type) {
        victim.applyEffect('wounds', Number(passive.effectData.duration), champion.id);
        break;
      }
    }

    const sunder = this.passive('shred');
    if (sunder && type === 'physical') {
      victim.applyEffect(String(sunder.effectData.effect), Number(sunder.effectData.duration), champion.id);
    }

    if (kind === 'basic' || kind === 'ability') {
      const tithe = this.passive('tithe');
      if (tithe && this.titheCharges > 0) {
        this.titheCharges--;
        if (this.titheRechargeIn <= 0) this.titheRechargeIn = Number(tithe.effectData.recharge);
        const gold = Number(tithe.effectData.gold);
        champion.grantGold(gold);
        context.addEvent(GameEventType.GOLD_EARNED, { entityId: champion.id, amount: gold, sourceType: EntityType.CHAMPION, x: champion.position.x, y: champion.position.y });
      }
    }

    if (kind !== 'ability') return;

    const burn = this.passive('ability_burn');
    if (burn) {
      const duration = Number(burn.effectData.duration);
      const perSecond = burn.effectData.flat !== undefined
        ? Number(burn.effectData.flat) / duration
        : victim.maxHealth * Number(burn.effectData.maxHealthPercentPerSecond);
      const existing = this.burns.get(victim.id);
      this.burns.set(victim.id, {
        perSecond,
        until: context.getGameTime() + duration,
        nextTickIn: existing?.nextTickIn ?? TICK,
      });
      victim.applyEffect('item_burn', duration, champion.id);
    }

    const rime = this.passive('ability_slow');
    if (rime) victim.applyEffect(String(rime.effectData.effect), Number(rime.effectData.duration), champion.id);
  }

  /**
   * Damage it's about to take from `source` (before resistances), lowered or
   * blocked by its items: Veil blocks an enemy champion's ability; Bark,
   * Hobnails and Chill Shell lower basic attacks and crits.
   * @returns What's left (0 if blocked)
   */
  reduceIncomingDamage(amount: number, source: ServerEntity, context: ServerGameContext): number {
    const champion = this.champion;
    const sourceChampion = source.entityType === EntityType.CHAMPION ? source as ServerChampion : undefined;
    const enemyChampion = sourceChampion && sourceChampion.side !== champion.side ? sourceChampion : undefined;

    const veil = this.passive('spell_shield');
    if (veil && enemyChampion?.damageKind === 'ability' && this.isReady(veil)) {
      this.startCooldown(veil);
      champion.removeEffect(String(veil.effectData.effect));
      context.addEvent(GameEventType.ABILITY_CAST, { entityId: champion.id, abilityId: 'item_veil', targetX: champion.position.x, targetY: champion.position.y });
      return 0;
    }

    // Minions', monsters' and towers' damage is all basic attacks
    const basic = sourceChampion ? sourceChampion.damageKind === 'basic' : isAttacker(source);
    if (!basic) return amount;

    const bark = this.passive('damage_block');
    if (bark && enemyChampion) amount = Math.max(0, amount - Number(bark.effectData.amount));
    const hobnails = this.passive('basic_damage_reduction');
    if (hobnails) amount *= 1 - Number(hobnails.effectData.percent);
    const chillShell = this.passive('crit_reduction');
    if (chillShell && sourceChampion?.dealingCrit) amount *= 1 - Number(chillShell.effectData.percent);
    return amount;
  }

  /**
   * An enemy's basic attack hit the champion: thorns hit back (and wound).
   * Structures aren't hit back.
   */
  onHitByBasicAttack(attacker: ServerEntity, context: ServerGameContext): void {
    const champion = this.champion;
    if (attacker.isDead || attacker.side === champion.side || isStructure(attacker)) return;
    const thorns = this.passive('thorns');
    if (!thorns) return;
    const damage = Number(thorns.effectData.damage) + Number(thorns.effectData.armorRatio ?? 0) * champion.getStats().armor;
    this.dealItemDamage(attacker, damage, damageTypeOf(thorns), context);
    const wounds = Number(thorns.effectData.wounds ?? 0);
    if (wounds > 0 && attacker.entityType === EntityType.CHAMPION && !attacker.isDead) {
      (attacker as ServerChampion).applyEffect('wounds', wounds, champion.id);
    }
  }

  /**
   * The champion took damage and is still alive: shields for low health.
   */
  onDamaged(): void {
    const champion = this.champion;
    const healthRatio = champion.health / champion.maxHealth;
    for (const passive of this.passivesOfType('shield')) {
      if (!this.isReady(passive) || healthRatio > (passive.healthThreshold ?? 0.3)) continue;
      this.startCooldown(passive);
      const duration = Number(passive.effectData.duration);
      champion.grantShield(champion.maxHealth * Number(passive.effectData.percentMaxHealth), duration, markerEffectId(passive));
      champion.applyEffect(markerEffectId(passive), duration, champion.id);
    }
  }

  /** How much stronger heals and shields it receives are (Verdant) */
  receivedMultiplier(): number {
    const verdant = this.passive('heal_received');
    return verdant ? 1 + Number(verdant.effectData.percent) : 1;
  }

  // ===========================================================================
  // Allies, takedowns, kills, death
  // ===========================================================================

  /**
   * It healed or shielded an allied champion for `amount`: Hymn buffs both;
   * Renewal heals the most wounded other ally near.
   */
  onAllyHealedOrShielded(ally: ServerChampion, amount: number, context: ServerGameContext): void {
    if (this.echoing) return;
    const champion = this.champion;

    const hymn = this.passive('ally_buff_on_heal');
    if (hymn) {
      const effect = String(hymn.effectData.effect);
      const duration = Number(hymn.effectData.duration);
      ally.applyEffect(effect, duration, champion.id);
      champion.applyEffect(effect, duration, champion.id);
    }

    const renewal = this.passive('echo_heal');
    if (renewal) {
      const radius = Number(renewal.effectData.radius);
      const other = context.getAllChampions()
        .filter(c => c !== ally && c !== champion && !c.isDead && c.side === champion.side &&
          c.position.distanceTo(champion.position) <= radius && c.health < c.maxHealth)
        .sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)[0];
      if (other) {
        this.echoing = true;
        try {
          other.heal(amount * Number(renewal.effectData.percent), context, champion.id);
        } finally {
          this.echoing = false;
        }
      }
    }
  }

  /** It got a champion takedown (a kill or an assist): stacking items grow */
  onTakedown(_victim: ServerEntity, _context: ServerGameContext): void {
    this.addStacks(from => from === 'takedown' || from === 'takedown_or_epic');
  }

  /** It killed a unit: Harvest grows on monsters, Bedrock on epic monsters */
  onKill(victim: ServerEntity, _context: ServerGameContext): void {
    if (victim.entityType !== EntityType.JUNGLE_CAMP) return;
    const harvest = this.heldPassive('monster_hunter');
    if (harvest) {
      harvest.item.stacks = Math.min(Number(harvest.passive.effectData.awaken), (harvest.item.stacks ?? 0) + 1);
    }
    const creatureType = (victim as ServerEntity & { creatureType?: string }).creatureType ?? '';
    if (EPIC_MONSTERS.has(creatureType)) this.addStacks(from => from === 'takedown_or_epic');
  }

  /** It died: Hoard loses some of its stacks; Static's charge is gone */
  onDeath(): void {
    for (const { passive, item } of this.heldPassives('stacking')) {
      const loss = Number(passive.effectData.deathLoss ?? 0);
      if (loss > 0 && item.stacks) item.stacks = Math.floor(item.stacks * (1 - loss));
    }
    this.champion.invalidateStats();
    this.staticCharge = 0;
    this.burns.clear();
  }

  private addStacks(counts: (from: string) => boolean): void {
    let grew = false;
    for (const { passive, item } of this.heldPassives('stacking')) {
      if (!counts(String(passive.effectData.from))) continue;
      const max = Number(passive.effectData.max);
      if ((item.stacks ?? 0) >= max) continue;
      item.stacks = (item.stacks ?? 0) + 1;
      grew = true;
    }
    if (grew) this.champion.invalidateStats();
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  /**
   * Whether a spellblade passive is charged (for tests and the HUD).
   */
  isCharged(passiveId: string, context: ServerGameContext): boolean {
    return (this.chargedUntil.get(passiveId) ?? -Infinity) >= context.getGameTime();
  }

  /** Static's charge, 0 to 100 */
  getStaticCharge(): number {
    return this.staticCharge;
  }

  /** Tithe's charges left (-1 without a Tithe item) */
  getTitheCharges(): number {
    return this.titheCharges;
  }

  private isAwakened(held: HeldPassive): boolean {
    return (held.item.stacks ?? 0) >= Number(held.passive.effectData.awaken);
  }

  /**
   * The passives of the champion's items with this effect type, one per
   * stack key: the one on the most expensive item.
   */
  private heldPassives(effectType: ItemPassiveEffect): HeldPassive[] {
    const found = new Map<string, HeldPassive>();
    for (const item of this.champion.items) {
      if (!item) continue;
      const definition = getItemCatalogEntry(item.definitionId);
      if (!definition) continue;
      for (const passive of definition.passives) {
        if (passive.effectType !== effectType) continue;
        const key = passive.stackKey ?? passive.id;
        const current = found.get(key);
        if (!current || definition.cost > current.definition.cost) found.set(key, { passive, item, definition });
      }
    }
    return [...found.values()];
  }

  private heldPassive(effectType: ItemPassiveEffect): HeldPassive | undefined {
    return this.heldPassives(effectType)[0];
  }

  private passivesOfType(effectType: ItemPassiveEffect): ItemPassiveData[] {
    return this.heldPassives(effectType).map(held => held.passive);
  }

  /** The (first) passive of this effect type the champion's items have */
  private passive(effectType: ItemPassiveEffect): ItemPassiveData | undefined {
    return this.heldPassive(effectType)?.passive;
  }

  private isReady(passive: ItemPassiveData): boolean {
    return !this.cooldowns.has(passive.id);
  }

  private startCooldown(passive: ItemPassiveData): void {
    if (passive.cooldown > 0) this.cooldowns.set(passive.id, passive.cooldown);
  }

  /** Damage from an item: it doesn't set off item passives meant for attacks and abilities */
  private dealItemDamage(target: ServerEntity, amount: number, type: DamageType, context: ServerGameContext): void {
    if (target.isDead || amount <= 0) return;
    this.champion.withDamageKind('item', () => target.takeDamage(amount, type, this.champion.id, context));
  }
}

/** Health a champion has beyond its level's base health */
export function bonusHealth(champion: ServerChampion): number {
  const base = champion.definition.baseStats.health;
  const growth = champion.definition.growthStats.health;
  return Math.max(0, champion.maxHealth - calculateStat(base, growth, champion.level));
}

/** The marker effect showing a passive's state (data/effects.ts) */
function markerEffectId(passive: ItemPassiveData): string {
  return `item_${passive.id}`;
}

function damageTypeOf(passive: ItemPassiveData): DamageType {
  return (passive.effectData.damageType as DamageType | undefined) ?? 'physical';
}

function isStructure(entity: ServerEntity): boolean {
  return entity.entityType === EntityType.TOWER || entity.entityType === EntityType.INHIBITOR ||
    entity.entityType === EntityType.NEXUS;
}

/** Units that fight: champions, minions and monsters */
function isUnit(entity: ServerEntity): boolean {
  return entity.entityType === EntityType.CHAMPION || entity.entityType === EntityType.MINION ||
    entity.entityType === EntityType.JUNGLE_CAMP;
}

/** Units whose damage is all basic attacks: minions, monsters, towers */
function isAttacker(entity: ServerEntity): boolean {
  return entity.entityType === EntityType.MINION || entity.entityType === EntityType.JUNGLE_CAMP ||
    entity.entityType === EntityType.TOWER;
}
