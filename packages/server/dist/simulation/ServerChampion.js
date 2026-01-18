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
        this.playerId = config.playerId;
        this.definition = config.definition;
        // Initialize from definition
        const baseStats = this.definition.baseStats;
        this.health = baseStats.health;
        this.maxHealth = baseStats.health;
        this.resource = baseStats.resource;
        this.maxResource = baseStats.resource;
        this.movementSpeed = baseStats.movementSpeed;
        // Set initial direction based on side
        this.direction = new Vector(config.side === 0 ? 1 : -1, 0);
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
        if (this.targetPosition) {
            this.moveToward(this.targetPosition, dt);
            // Update facing direction
            const dir = this.targetPosition.subtracted(this.position);
            if (dir.length() > 0.1) {
                this.direction = dir.normalized();
            }
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
        // Update effect timers
        this.activeEffects = this.activeEffects.filter(effect => {
            effect.timeRemaining -= dt;
            return effect.timeRemaining > 0;
        });
        // Recalculate CC status
        // TODO: Implement proper CC calculation based on effect definitions
        this.ccStatus = defaultCCStatus();
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
        // Apply modifiers
        for (const modifier of this.statModifiers) {
            this.applyStatModifier(stats, modifier);
        }
        // Apply item stats
        for (const item of this.items) {
            if (item) {
                // TODO: Apply item stats
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
        };
    }
}
//# sourceMappingURL=ServerChampion.js.map