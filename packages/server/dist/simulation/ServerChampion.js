/**
 * ServerChampion - Server-side champion implementation.
 *
 * This class handles the authoritative champion state:
 * - Position, health, mana
 * - Abilities and cooldowns
 * - Effects and crowd control
 * - Items and stats
 *
 * NO RENDERING - purely simulation.
 */
import { Vector, EntityType, calculateStat, calculateAttackSpeed, LEVEL_EXPERIENCE, defaultCCStatus, calculatePhysicalDamage, calculateMagicDamage, GameConfig, } from '@siege/shared';
import { ServerEntity } from './ServerEntity';
import { getServerItemById, } from '../data/items';
import { getServerEffectById, isCCEffect, isStatEffect, isOverTimeEffect, } from '../data/effects';
export class ServerChampion extends ServerEntity {
    constructor(config) {
        super({
            id: config.id,
            entityType: EntityType.CHAMPION,
            position: config.position,
            side: config.side,
        });
        // Champion-specific state
        this.resource = 0;
        this.maxResource = 0;
        this.level = 1;
        this.experience = 0;
        this.experienceToNextLevel = LEVEL_EXPERIENCE[1];
        this.skillPoints = 1;
        // Combat state
        this.inCombat = false;
        this.timeSinceCombat = 0;
        this.respawnTimer = 0;
        this.isRecalling = false;
        this.recallProgress = 0;
        // Stats
        this.statModifiers = [];
        this.cachedStats = null;
        // Abilities
        this.abilityRanks = { Q: 0, W: 0, E: 0, R: 0 };
        this.abilityCooldowns = { Q: 0, W: 0, E: 0, R: 0 };
        this.abilityStates = {
            Q: this.createDefaultAbilityState(),
            W: this.createDefaultAbilityState(),
            E: this.createDefaultAbilityState(),
            R: this.createDefaultAbilityState(),
        };
        // Effects
        this.activeEffects = [];
        this.ccStatus = defaultCCStatus();
        // Items
        this.items = [null, null, null, null, null, null];
        this.gold = GameConfig.ECONOMY.STARTING_GOLD;
        this.totalGoldSpent = 0;
        // Combat tracking
        this.attackCooldown = 0;
        this.kills = 0;
        this.deaths = 0;
        this.assists = 0;
        this.cs = 0; // Creep score
        // Shields and forced movement
        this.shields = [];
        this.forcedMovement = null;
        // Direction facing
        this.direction = new Vector(1, 0);
        // Vision - champions provide fog of war vision
        this.sightRange = 800;
        // Trinket (ward placement) state
        this.trinketCharges = 2; // Start with 2 charges
        this.trinketMaxCharges = 2;
        this.trinketCooldown = 0; // Cooldown after placing a ward
        this.trinketRechargeTimer = 0; // Time accumulator for next charge
        this.trinketRechargeTime = 120; // 120 seconds to recharge one ward
        this.playerId = config.playerId;
        this.definition = config.definition;
        // DEBUG: Log champion creation
        console.log(`[ServerChampion] Created champion for player ${this.playerId}: id="${this.definition.id}", name="${this.definition.name}", Q=${this.definition.abilities.Q}`);
        // Initialize from definition
        const baseStats = this.definition.baseStats;
        this.health = baseStats.health;
        this.maxHealth = baseStats.health;
        this.resource = baseStats.resource;
        this.maxResource = baseStats.resource;
        this.movementSpeed = baseStats.movementSpeed;
        // Set initial direction based on side
        this.direction = new Vector(config.side === 0 ? 1 : -1, 0);
        // Auto-level Q ability at start so players can cast abilities immediately
        this.levelUpAbility('Q');
    }
    createDefaultAbilityState() {
        return {
            rank: 0,
            cooldownRemaining: 0,
            cooldownTotal: 0,
            isCasting: false,
            castTimeRemaining: 0,
            isToggled: false,
            passiveCooldownRemaining: 0,
        };
    }
    /**
     * Update champion for one tick.
     */
    update(dt, context) {
        if (this.isDead) {
            this.updateDead(dt, context);
            return;
        }
        // Update forced movement first
        if (this.forcedMovement) {
            this.updateForcedMovement(dt);
        }
        else if (this.ccStatus.canMove) {
            // Normal movement
            this.updateMovement(dt, context);
        }
        // Update combat state
        this.updateCombat(dt, context);
        // Update abilities
        this.updateAbilities(dt);
        // Update effects
        this.updateEffects(dt);
        // Update shields
        this.updateShields(dt);
        // Update recall
        if (this.isRecalling) {
            this.updateRecall(dt);
        }
        // Regeneration (out of combat)
        this.updateRegeneration(dt);
        // Update trinket (ward) charges
        this.updateTrinket(dt);
        // Passive gold income
        this.gold += GameConfig.ECONOMY.PASSIVE_GOLD_PER_SECOND * dt;
        // Invalidate cached stats
        this.cachedStats = null;
    }
    /**
     * Update while dead (respawn timer).
     */
    updateDead(dt, context) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
            this.respawn(context);
        }
    }
    /**
     * Respawn the champion.
     */
    respawn(context) {
        const spawnPos = this.side === 0
            ? context.mapConfig.CHAMPION_SPAWN.BLUE
            : context.mapConfig.CHAMPION_SPAWN.RED;
        this.position.setFrom(spawnPos);
        this.isDead = false;
        this.respawnTimer = 0;
        // Restore health and mana
        const stats = this.getStats();
        this.health = stats.maxHealth;
        this.resource = stats.maxResource;
        // Clear effects
        this.activeEffects = [];
        this.shields = [];
        this.ccStatus = defaultCCStatus();
        this.forcedMovement = null;
    }
    /**
     * Update movement.
     */
    updateMovement(dt, context) {
        if (!this.targetPosition && !this.targetEntityId)
            return;
        // If targeting an entity, update target position
        if (this.targetEntityId) {
            const target = context.getEntity(this.targetEntityId);
            if (target && !target.isDead) {
                this.targetPosition = target.position.clone();
            }
            else {
                this.targetEntityId = null;
                this.targetPosition = null;
                return;
            }
        }
        const target = this.targetPosition;
        if (target) {
            // Update facing direction first (before moveToward might clear targetPosition)
            const dir = target.subtracted(this.position);
            if (dir.length() > 0.1) {
                this.direction = dir.normalized();
            }
            this.moveToward(target, dt);
        }
    }
    /**
     * Update forced movement (dash/knockback).
     */
    updateForcedMovement(dt) {
        if (!this.forcedMovement)
            return;
        const fm = this.forcedMovement;
        fm.elapsed += dt;
        const progress = Math.min(fm.elapsed / fm.duration, 1);
        const moveDistance = fm.distance * (progress - (fm.elapsed - dt) / fm.duration);
        const movement = fm.direction.clone().scalar(moveDistance);
        this.position.add(movement);
        if (fm.elapsed >= fm.duration) {
            this.forcedMovement = null;
        }
    }
    /**
     * Update combat state.
     */
    updateCombat(dt, context) {
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }
        // Update combat timer
        if (this.inCombat) {
            this.timeSinceCombat += dt;
            if (this.timeSinceCombat >= GameConfig.COMBAT.COMBAT_TIMEOUT) {
                this.inCombat = false;
            }
        }
        // Auto-attack target if in range and can attack
        if (this.targetEntityId && this.attackCooldown <= 0 && this.ccStatus.canAttack) {
            const target = context.getEntity(this.targetEntityId);
            if (target && !target.isDead && this.isInRange(target, this.getStats().attackRange)) {
                this.performBasicAttack(target, context);
            }
        }
    }
    /**
     * Perform a basic attack on a target.
     */
    performBasicAttack(target, context) {
        const stats = this.getStats();
        const baseDamage = stats.attackDamage;
        // Calculate damage
        const damage = calculatePhysicalDamage(baseDamage, 0); // TODO: Get target armor
        // Deal damage
        target.takeDamage(damage, 'physical', this.id);
        // Set attack cooldown
        this.attackCooldown = 1 / stats.attackSpeed;
        // Enter combat
        this.enterCombat();
    }
    /**
     * Update abilities (cooldowns).
     */
    updateAbilities(dt) {
        const slots = ['Q', 'W', 'E', 'R'];
        for (const slot of slots) {
            const state = this.abilityStates[slot];
            if (state.cooldownRemaining > 0) {
                state.cooldownRemaining = Math.max(0, state.cooldownRemaining - dt);
            }
            if (state.castTimeRemaining > 0) {
                state.castTimeRemaining = Math.max(0, state.castTimeRemaining - dt);
                if (state.castTimeRemaining <= 0) {
                    state.isCasting = false;
                }
            }
        }
    }
    /**
     * Update effects.
     */
    updateEffects(dt) {
        // Process over-time effects and update timers
        this.activeEffects = this.activeEffects.filter(effect => {
            const def = getServerEffectById(effect.definitionId);
            // Handle over-time effects (DoT/HoT)
            if (def && isOverTimeEffect(def)) {
                this.processOverTimeEffect(effect, def, dt);
            }
            // Update timer
            effect.timeRemaining -= dt;
            return effect.timeRemaining > 0;
        });
        // Recalculate CC status from active effects
        this.ccStatus = this.calculateCCStatus();
        // Invalidate cached stats (effects may modify stats)
        this.cachedStats = null;
    }
    /**
     * Process an over-time effect tick.
     */
    processOverTimeEffect(effect, def, dt) {
        // Initialize nextTickIn if not set
        if (effect.nextTickIn === undefined) {
            effect.nextTickIn = def.tickInterval;
        }
        // Countdown to next tick
        effect.nextTickIn -= dt;
        // Process tick when timer reaches 0
        while (effect.nextTickIn <= 0) {
            const tickValue = def.valuePerTick * effect.stacks;
            switch (def.otType) {
                case 'damage':
                    // Apply damage (DoT)
                    this.takeDamage(tickValue, def.damageType || 'magic', effect.sourceId);
                    break;
                case 'heal':
                    // Apply healing (HoT)
                    this.heal(tickValue);
                    break;
                case 'mana_drain':
                    // Drain mana
                    this.resource = Math.max(0, this.resource - tickValue);
                    break;
                case 'mana_restore':
                    // Restore mana
                    const stats = this.getStats();
                    this.resource = Math.min(stats.maxResource, this.resource + tickValue);
                    break;
            }
            // Reset tick timer
            effect.nextTickIn += def.tickInterval;
        }
    }
    /**
     * Calculate CC status from active effects.
     */
    calculateCCStatus() {
        const status = {
            isStunned: false,
            isSilenced: false,
            isGrounded: false,
            isRooted: false,
            isDisarmed: false,
            canMove: true,
            canAttack: true,
            canCast: true,
            canUseMobilityAbilities: true,
        };
        for (const effect of this.activeEffects) {
            const def = getServerEffectById(effect.definitionId);
            if (!def || !isCCEffect(def))
                continue;
            switch (def.ccType) {
                case 'stun':
                case 'knockup':
                case 'knockback':
                case 'suppress':
                    status.isStunned = true;
                    break;
                case 'silence':
                    status.isSilenced = true;
                    break;
                case 'grounded':
                    status.isGrounded = true;
                    break;
                case 'root':
                    status.isRooted = true;
                    break;
                case 'disarm':
                case 'blind':
                    status.isDisarmed = true;
                    break;
                case 'slow':
                    // Slow doesn't set a flag, it modifies movement speed via stat effect
                    break;
            }
        }
        // Compute ability to act
        status.canMove = !status.isStunned && !status.isRooted;
        status.canAttack = !status.isStunned && !status.isDisarmed;
        status.canCast = !status.isStunned && !status.isSilenced;
        status.canUseMobilityAbilities = status.canMove && status.canCast && !status.isGrounded;
        return status;
    }
    /**
     * Update shields.
     */
    updateShields(dt) {
        this.shields = this.shields.filter(shield => {
            shield.remainingDuration -= dt;
            return shield.remainingDuration > 0 && shield.amount > 0;
        });
    }
    /**
     * Update recall.
     */
    updateRecall(dt) {
        this.recallProgress += dt;
        if (this.recallProgress >= GameConfig.TIMING.RECALL_DURATION) {
            this.completeRecall();
        }
    }
    /**
     * Start recalling.
     */
    startRecall() {
        if (this.isRecalling || this.isDead || this.inCombat) {
            return false;
        }
        this.isRecalling = true;
        this.recallProgress = 0;
        return true;
    }
    /**
     * Cancel recall.
     */
    cancelRecall() {
        this.isRecalling = false;
        this.recallProgress = 0;
    }
    /**
     * Complete recall (teleport to base).
     */
    completeRecall() {
        this.isRecalling = false;
        this.recallProgress = 0;
        // Teleport to spawn
        const spawnPos = this.side === 0
            ? new Vector(-1100, 1100)
            : new Vector(1100, -1100);
        this.position.setFrom(spawnPos);
        // Restore health and mana
        const stats = this.getStats();
        this.health = stats.maxHealth;
        this.resource = stats.maxResource;
    }
    /**
     * Update regeneration.
     */
    updateRegeneration(dt) {
        const stats = this.getStats();
        const regenMultiplier = this.inCombat ? 1 : GameConfig.COMBAT.OOC_REGEN_MULTIPLIER;
        // Health regen
        if (this.health < stats.maxHealth) {
            this.health = Math.min(stats.maxHealth, this.health + stats.healthRegen * regenMultiplier * dt);
        }
        // Resource regen
        if (this.resource < stats.maxResource) {
            this.resource = Math.min(stats.maxResource, this.resource + stats.resourceRegen * regenMultiplier * dt);
        }
    }
    /**
     * Update trinket (ward) charges.
     */
    updateTrinket(dt) {
        // Update cooldown
        if (this.trinketCooldown > 0) {
            this.trinketCooldown = Math.max(0, this.trinketCooldown - dt);
        }
        // Recharge if not at max charges
        if (this.trinketCharges < this.trinketMaxCharges) {
            this.trinketRechargeTimer += dt;
            if (this.trinketRechargeTimer >= this.trinketRechargeTime) {
                this.trinketCharges++;
                this.trinketRechargeTimer = 0;
            }
        }
    }
    /**
     * Check if can place a ward.
     */
    canPlaceWard() {
        return this.trinketCharges > 0 && this.trinketCooldown <= 0 && !this.isDead;
    }
    /**
     * Consume a trinket charge when placing a ward.
     * Returns true if successful.
     */
    consumeTrinketCharge() {
        if (!this.canPlaceWard()) {
            return false;
        }
        this.trinketCharges--;
        this.trinketCooldown = 1; // 1 second cooldown after placing
        return true;
    }
    /**
     * Get trinket recharge progress (0-1).
     */
    getTrinketRechargeProgress() {
        if (this.trinketCharges >= this.trinketMaxCharges)
            return 1;
        return this.trinketRechargeTimer / this.trinketRechargeTime;
    }
    /**
     * Enter combat state.
     */
    enterCombat() {
        this.inCombat = true;
        this.timeSinceCombat = 0;
        this.cancelRecall();
    }
    /**
     * Take damage (override for shields and resistances).
     */
    takeDamage(amount, type, sourceId) {
        if (this.isDead)
            return 0;
        this.enterCombat();
        // Calculate damage after resistances
        let damage = this.calculateDamage(amount, type);
        // Apply shields first
        for (const shield of this.shields) {
            if (shield.amount >= damage) {
                shield.amount -= damage;
                return 0; // All damage absorbed
            }
            else {
                damage -= shield.amount;
                shield.amount = 0;
            }
        }
        // Apply remaining damage to health
        this.health = Math.max(0, this.health - damage);
        if (this.health <= 0) {
            this.onDeath(sourceId);
        }
        return damage;
    }
    /**
     * Calculate damage after resistances.
     */
    calculateDamage(amount, type) {
        if (type === 'true' || type === 'pure') {
            return amount;
        }
        const stats = this.getStats();
        if (type === 'physical') {
            return calculatePhysicalDamage(amount, stats.armor);
        }
        else if (type === 'magic') {
            return calculateMagicDamage(amount, stats.magicResist);
        }
        return amount;
    }
    /**
     * Handle death.
     */
    onDeath(killerId) {
        super.onDeath(killerId);
        this.deaths++;
        // Calculate respawn time
        const baseRespawn = GameConfig.RESPAWN.BASE_RESPAWN_TIME;
        const levelBonus = GameConfig.RESPAWN.RESPAWN_TIME_PER_LEVEL * (this.level - 1);
        this.respawnTimer = Math.min(baseRespawn + levelBonus, GameConfig.RESPAWN.MAX_RESPAWN_TIME);
        // Clear state
        this.targetPosition = null;
        this.targetEntityId = null;
        this.forcedMovement = null;
        this.isRecalling = false;
        this.recallProgress = 0;
    }
    /**
     * Get current stats (with modifiers).
     */
    getStats() {
        if (this.cachedStats) {
            return this.cachedStats;
        }
        const base = this.definition.baseStats;
        const growth = this.definition.growthStats;
        const level = this.level;
        const stats = {
            health: this.health,
            maxHealth: calculateStat(base.health, growth.health, level),
            healthRegen: calculateStat(base.healthRegen, growth.healthRegen, level),
            resource: this.resource,
            maxResource: calculateStat(base.resource, growth.resource, level),
            resourceRegen: calculateStat(base.resourceRegen, growth.resourceRegen, level),
            attackDamage: calculateStat(base.attackDamage, growth.attackDamage, level),
            abilityPower: base.abilityPower,
            attackSpeed: calculateAttackSpeed(base.attackSpeed, growth.attackSpeed, level),
            attackRange: base.attackRange,
            armor: calculateStat(base.armor, growth.armor, level),
            magicResist: calculateStat(base.magicResist, growth.magicResist, level),
            movementSpeed: base.movementSpeed,
            critChance: base.critChance,
            critDamage: base.critDamage,
            level,
        };
        // Apply modifiers from abilities/buffs
        for (const modifier of this.statModifiers) {
            this.applyStatModifier(stats, modifier);
        }
        // Apply item stats
        for (const item of this.items) {
            if (item) {
                const itemDef = getServerItemById(item.definitionId);
                if (itemDef) {
                    this.applyItemStats(stats, itemDef);
                }
            }
        }
        // Apply effect stat modifiers (buffs/debuffs)
        for (const effect of this.activeEffects) {
            const effectDef = getServerEffectById(effect.definitionId);
            if (effectDef && isStatEffect(effectDef)) {
                this.applyEffectStatModifier(stats, effectDef, effect.stacks);
            }
        }
        // Update cached values
        this.maxHealth = stats.maxHealth;
        this.maxResource = stats.maxResource;
        this.movementSpeed = stats.movementSpeed;
        this.cachedStats = stats;
        return stats;
    }
    /**
     * Apply a stat modifier.
     */
    applyStatModifier(stats, modifier) {
        if (modifier.flat) {
            for (const [key, value] of Object.entries(modifier.flat)) {
                const statKey = key;
                if (statKey in stats && typeof value === 'number') {
                    stats[statKey] += value;
                }
            }
        }
        if (modifier.percent) {
            for (const [key, value] of Object.entries(modifier.percent)) {
                const statKey = key;
                if (statKey in stats && typeof value === 'number') {
                    stats[statKey] *= value;
                }
            }
        }
    }
    /**
     * Add a stat modifier.
     */
    addModifier(modifier) {
        this.statModifiers.push(modifier);
        this.cachedStats = null;
    }
    /**
     * Remove a stat modifier by source.
     */
    removeModifier(source) {
        this.statModifiers = this.statModifiers.filter(m => m.source !== source);
        this.cachedStats = null;
    }
    /**
     * Apply item stats to champion stats.
     */
    applyItemStats(stats, itemDef) {
        for (const [key, value] of Object.entries(itemDef.stats)) {
            const statKey = key;
            if (statKey in stats && typeof value === 'number') {
                // Special handling for attack speed (percentage based)
                if (statKey === 'attackSpeed') {
                    stats.attackSpeed *= (1 + value);
                }
                else if (statKey === 'health') {
                    stats.maxHealth += value;
                }
                else if (statKey === 'resource') {
                    stats.maxResource += value;
                }
                else {
                    stats[statKey] += value;
                }
            }
        }
    }
    /**
     * Apply effect stat modifier to champion stats.
     */
    applyEffectStatModifier(stats, effectDef, stacks) {
        // Map effect stat type to ChampionStats key
        // Note: lifesteal/spell_vamp/penetration are not in ChampionStats, handled separately
        const statMap = {
            'attack_damage': 'attackDamage',
            'ability_power': 'abilityPower',
            'armor': 'armor',
            'magic_resist': 'magicResist',
            'attack_speed': 'attackSpeed',
            'movement_speed': 'movementSpeed',
            'health_regen': 'healthRegen',
            'mana_regen': 'resourceRegen',
            'crit_chance': 'critChance',
            'crit_damage': 'critDamage',
        };
        const statKey = statMap[effectDef.stat];
        if (!statKey || !(statKey in stats))
            return;
        // Apply flat value (multiplied by stacks)
        if (effectDef.flatValue !== undefined) {
            stats[statKey] += effectDef.flatValue * stacks;
        }
        // Apply percent value (compounded by stacks)
        if (effectDef.percentValue !== undefined) {
            const multiplier = Math.pow(1 + effectDef.percentValue, stacks);
            stats[statKey] *= multiplier;
        }
    }
    /**
     * Apply an effect to this champion.
     */
    applyEffect(effectId, duration, sourceId, stacks = 1) {
        const def = getServerEffectById(effectId);
        if (!def) {
            console.warn(`[ServerChampion] Unknown effect: ${effectId}`);
            return;
        }
        // Check for existing effect
        const existing = this.activeEffects.find(e => e.definitionId === effectId);
        if (existing) {
            // Handle stack behavior
            switch (def.stackBehavior) {
                case 'refresh':
                    existing.timeRemaining = duration;
                    break;
                case 'extend':
                    existing.timeRemaining += duration;
                    break;
                case 'stack':
                    if (!def.maxStacks || existing.stacks < def.maxStacks) {
                        existing.stacks += stacks;
                    }
                    existing.timeRemaining = duration; // Usually refresh on stack
                    break;
                case 'replace':
                    existing.timeRemaining = duration;
                    existing.stacks = stacks;
                    break;
                case 'ignore':
                    // Do nothing
                    break;
            }
        }
        else {
            // Add new effect
            const newEffect = {
                definitionId: effectId,
                sourceId,
                timeRemaining: duration,
                stacks,
                instanceId: `${effectId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            };
            // Initialize over-time effect tick timer
            if (isOverTimeEffect(def)) {
                newEffect.nextTickIn = def.tickInterval;
            }
            this.activeEffects.push(newEffect);
        }
        // Invalidate cached stats and recalculate CC status
        this.cachedStats = null;
        this.ccStatus = this.calculateCCStatus();
    }
    /**
     * Remove an effect from this champion.
     */
    removeEffect(effectId) {
        const index = this.activeEffects.findIndex(e => e.definitionId === effectId);
        if (index === -1)
            return false;
        this.activeEffects.splice(index, 1);
        this.cachedStats = null;
        this.ccStatus = this.calculateCCStatus();
        return true;
    }
    /**
     * Remove all effects matching a category.
     */
    removeEffectsByCategory(category) {
        const before = this.activeEffects.length;
        this.activeEffects = this.activeEffects.filter(e => {
            const def = getServerEffectById(e.definitionId);
            return def?.category !== category;
        });
        this.cachedStats = null;
        this.ccStatus = this.calculateCCStatus();
        return before - this.activeEffects.length;
    }
    /**
     * Cleanse all cleansable debuffs.
     */
    cleanse() {
        const before = this.activeEffects.length;
        this.activeEffects = this.activeEffects.filter(e => {
            const def = getServerEffectById(e.definitionId);
            // Keep if not a debuff, or if not cleansable
            return def?.category !== 'debuff' || !def.cleansable;
        });
        this.cachedStats = null;
        this.ccStatus = this.calculateCCStatus();
        return before - this.activeEffects.length;
    }
    /**
     * Check if champion has a specific effect.
     */
    hasEffect(effectId) {
        return this.activeEffects.some(e => e.definitionId === effectId);
    }
    /**
     * Get an active effect by ID.
     */
    getEffect(effectId) {
        return this.activeEffects.find(e => e.definitionId === effectId);
    }
    /**
     * Set movement target.
     */
    setMoveTarget(position) {
        this.targetPosition = position.clone();
        this.targetEntityId = null;
        this.cancelRecall();
    }
    /**
     * Set attack target.
     */
    setAttackTarget(entityId) {
        this.targetEntityId = entityId;
        this.cancelRecall();
    }
    /**
     * Stop all actions.
     */
    stop() {
        this.targetPosition = null;
        this.targetEntityId = null;
    }
    /**
     * Level up an ability.
     */
    levelUpAbility(slot) {
        if (this.skillPoints <= 0)
            return false;
        const currentRank = this.abilityRanks[slot];
        const maxRank = 5; // TODO: Get from ability definition
        // R ability has special level requirements
        if (slot === 'R') {
            const rRequiredLevels = [6, 11, 16];
            const currentRRank = this.abilityRanks.R;
            if (this.level < rRequiredLevels[currentRRank]) {
                return false;
            }
        }
        if (currentRank >= maxRank)
            return false;
        this.abilityRanks[slot]++;
        this.abilityStates[slot].rank = this.abilityRanks[slot];
        this.skillPoints--;
        return true;
    }
    /**
     * Gain experience.
     */
    gainExperience(amount) {
        this.experience += amount;
        // Check for level up
        while (this.experience >= this.experienceToNextLevel && this.level < GameConfig.LIMITS.MAX_LEVEL) {
            this.experience -= this.experienceToNextLevel;
            this.levelUp();
        }
    }
    /**
     * Level up.
     */
    levelUp() {
        this.level++;
        this.skillPoints++;
        this.experienceToNextLevel = LEVEL_EXPERIENCE[this.level] ?? LEVEL_EXPERIENCE[17];
        // Heal percentage of new max health
        const stats = this.getStats();
        this.health = Math.min(stats.maxHealth, this.health + stats.maxHealth * 0.1);
        this.resource = Math.min(stats.maxResource, this.resource + stats.maxResource * 0.1);
        this.cachedStats = null;
    }
    // =====================
    // Item System
    // =====================
    /**
     * Buy an item.
     * @returns true if purchase succeeded
     */
    buyItem(itemId) {
        const itemDef = getServerItemById(itemId);
        if (!itemDef) {
            console.log(`[ServerChampion] Item not found: ${itemId}`);
            return false;
        }
        // Check gold
        if (this.gold < itemDef.cost) {
            console.log(`[ServerChampion] Not enough gold for ${itemDef.name}: have ${this.gold}, need ${itemDef.cost}`);
            return false;
        }
        // Check if unique and already owned
        if (itemDef.isUnique && this.hasItem(itemId)) {
            console.log(`[ServerChampion] Already owns unique item: ${itemDef.name}`);
            return false;
        }
        // Find empty slot
        const emptySlot = this.findEmptySlot();
        if (emptySlot === null) {
            console.log(`[ServerChampion] Inventory full, cannot buy ${itemDef.name}`);
            return false;
        }
        // Deduct gold and add item
        this.gold -= itemDef.cost;
        this.totalGoldSpent += itemDef.cost;
        this.items[emptySlot] = {
            definitionId: itemId,
            slot: emptySlot,
            passiveCooldowns: {},
            nextIntervalTick: {},
        };
        // Invalidate cached stats
        this.cachedStats = null;
        console.log(`[ServerChampion] ${this.playerId} bought ${itemDef.name} for ${itemDef.cost}g (remaining: ${this.gold}g)`);
        return true;
    }
    /**
     * Sell an item from a specific slot.
     * @returns gold gained, or 0 if failed
     */
    sellItem(slot) {
        if (slot < 0 || slot >= 6) {
            console.log(`[ServerChampion] Invalid slot: ${slot}`);
            return 0;
        }
        const item = this.items[slot];
        if (!item) {
            console.log(`[ServerChampion] No item in slot ${slot}`);
            return 0;
        }
        const itemDef = getServerItemById(item.definitionId);
        if (!itemDef) {
            console.log(`[ServerChampion] Item definition not found: ${item.definitionId}`);
            return 0;
        }
        // Add gold and remove item
        const goldGained = itemDef.sellValue;
        this.gold += goldGained;
        this.items[slot] = null;
        // Invalidate cached stats
        this.cachedStats = null;
        console.log(`[ServerChampion] ${this.playerId} sold ${itemDef.name} for ${goldGained}g (total: ${this.gold}g)`);
        return goldGained;
    }
    /**
     * Check if champion has a specific item.
     */
    hasItem(itemId) {
        return this.items.some(item => item?.definitionId === itemId);
    }
    /**
     * Find first empty inventory slot.
     */
    findEmptySlot() {
        for (let i = 0; i < 6; i++) {
            if (!this.items[i]) {
                return i;
            }
        }
        return null;
    }
    // =====================
    // Collision Interface
    // =====================
    /**
     * Champions participate in collision.
     */
    isCollidable() {
        return !this.isDead;
    }
    /**
     * Champion collision radius.
     */
    getRadius() {
        return 25; // Standard champion collision radius
    }
    /**
     * Champion collision mass.
     * Champions are heavier than minions, so they push minions more.
     */
    getMass() {
        return 100; // Standard champion mass
    }
    /**
     * Convert to network snapshot.
     */
    toSnapshot() {
        const stats = this.getStats();
        return {
            entityId: this.id,
            entityType: EntityType.CHAMPION,
            side: this.side,
            championId: this.definition.id,
            playerId: this.playerId,
            x: this.position.x,
            y: this.position.y,
            targetX: this.targetPosition?.x,
            targetY: this.targetPosition?.y,
            targetEntityId: this.targetEntityId ?? undefined,
            health: this.health,
            maxHealth: stats.maxHealth,
            resource: this.resource,
            maxResource: stats.maxResource,
            level: this.level,
            experience: this.experience,
            attackDamage: stats.attackDamage,
            abilityPower: stats.abilityPower,
            armor: stats.armor,
            magicResist: stats.magicResist,
            attackSpeed: stats.attackSpeed,
            movementSpeed: stats.movementSpeed,
            isDead: this.isDead,
            respawnTimer: this.respawnTimer,
            isRecalling: this.isRecalling,
            recallProgress: this.recallProgress,
            abilities: this.abilityStates,
            activeEffects: this.activeEffects,
            items: this.items,
            gold: this.gold,
            kills: this.kills,
            deaths: this.deaths,
            assists: this.assists,
            cs: this.cs,
            trinketCharges: this.trinketCharges,
            trinketMaxCharges: this.trinketMaxCharges,
            trinketCooldown: this.trinketCooldown,
            trinketRechargeProgress: this.getTrinketRechargeProgress(),
        };
    }
}
//# sourceMappingURL=ServerChampion.js.map