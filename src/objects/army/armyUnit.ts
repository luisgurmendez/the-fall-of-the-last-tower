import { ArmyUnitSide, Target } from "@/objects/army/types";
import { Square } from "@/objects/shapes";
import BaseObject from "@/objects/baseObject";
import { PhysicableMixin } from "@/mixins/physics";
import { CollisionableMixin } from "@/mixins/collisionable";
import Cooldown from "../cooldown";
import GameContext from "@/core/gameContext";
import Disposable, { isDisposable } from "@/behaviors/disposable";
import { generateBloodDrops, generateBloodExplotion } from "./ParticleUtils";
import Background from "../background";
import Vector from "@/physics/vector";
import PixelArtSpriteAnimator from "@/sprites/PixelArtSpriteAnimator";
import RenderElement from "@/render/renderElement";
import Particle from "../particle/particle";
import PixelArtDrawUtils from "@/utils/pixelartDrawUtils";
import { GameConfig } from "@/config";
import {
    IGameUnit,
    UnitType,
    UnitSide,
    DamageType,
    UnitBaseStats,
    UnitReward,
    TeamId,
} from "@/units/types";
import { ActiveEffect, computeCCStatus, CrowdControlStatus } from "@/effects/types";
import {
    UnitBehavior,
    BehaviorContext,
    BehaviorDecision,
    AggressiveBehavior,
} from "@/behaviors/unit";

export const ATTACK_ANIMATION_ID = "a";
export const WALK_ANIMATION_ID = "w";

/**
 * Active shield on an army unit.
 */
interface ArmyUnitShield {
    amount: number;
    remainingDuration: number;
    source?: string;
}

/**
 * Forced movement for army units.
 */
interface ArmyUnitForcedMovement {
    direction: Vector;
    distance: number;
    duration: number;
    elapsed: number;
    type: 'dash' | 'knockback';
}

const BaseArmyUnit = PhysicableMixin(
    CollisionableMixin<Square>()(BaseObject)
);

abstract class ArmyUnit extends BaseArmyUnit implements Disposable, IGameUnit {
    // ===================
    // IGameUnit Properties
    // ===================

    readonly unitType: UnitType = 'troop';

    // ===================
    // Disposable
    // ===================

    shouldDispose: boolean = false;
    dispose?: (() => void | undefined) | undefined;

    // ===================
    // Core Properties
    // ===================

    abstract side: ArmyUnitSide;
    protected abstract outOfSightRange: number;
    protected abstract health: number;
    protected abstract maxHealth: number;
    protected abstract maxArmor: number;
    protected abstract armor: number;
    protected abstract magicResist: number;
    protected abstract attackCooldown: Cooldown;

    // ===================
    // IGameUnit State
    // ===================

    /** Active shields */
    protected shields: ArmyUnitShield[] = [];

    /** Active immunities */
    protected immunities: Set<string> = new Set();

    /** Active effects */
    protected activeEffects: ActiveEffect[] = [];

    /** Current forced movement */
    protected forcedMovement: ArmyUnitForcedMovement | null = null;

    /** Is the unit dead */
    protected _isDead: boolean = false;
    targetHasBeenSetByPlayer = false;

    /// Enemy to attack if in reach
    abstract target: Target | null;
    protected abstract attackRange: number;
    protected abstract accelerationRate: number;
    // Whether the  player is hovering
    isBeingHovered = false;
    /// Whether the unit is selected by the player
    isSelected = false;

    /// position vector of the desired position to move to
    targetPosition: Vector | null = null;

    // ===================
    // Behavior System
    // ===================

    /** The AI behavior controlling this unit */
    protected behavior: UnitBehavior = new AggressiveBehavior();

    /// Cached path waypoints for pathfinding
    private currentPath: Vector[] = [];
    private currentPathIndex: number = 0;
    private pathGridVersion: number = -1; // Track grid version for path invalidation

    /// Lane waypoints for MOBA lane following (bypasses A* pathfinding)
    protected laneWaypoints: Vector[] = [];
    protected laneWaypointIndex: number = 0;

    protected abstract spriteAnimator: PixelArtSpriteAnimator;
    private bloodDropsToAddOnNextStep: Particle[] = [];

    /// The frame in which the attack should be triggered.
    protected abstract triggerAttackAnimationFrame: number;
    private queuedAttackWithAnimationFrame: ((gctx: GameContext) => void) | null = null;
    private prevPosition: Vector = new Vector();

    abstract chooseTypeOfBloodstainWhenDying(background: Background): (inPosition: Vector) => void;

    protected attack(attackCb: (gctx: GameContext) => void) {
        if (!this.isAttacking) {
            this.spriteAnimator.playAnimation(ATTACK_ANIMATION_ID, { interrupt: true });
            this.acceleration = new Vector(0, 0);
            this.velocity = new Vector(0, 0);
            this.attackCooldown.start();
            this.queuedAttackWithAnimationFrame = attackCb;
        }
    }

    protected canAttack() {
        return !this.attackCooldown.isCooling();
    }

    protected die(gameContext: GameContext) {
        this._isDead = true;
        this.shouldDispose = true;
        gameContext.objects.push(
            ...generateBloodExplotion(this.position.clone())
        );
        this.chooseTypeOfBloodstainWhenDying(gameContext.background)(this.position.clone().add(new Vector(0, this.collisionMask.h / 2)));
        // Award money for killing enemy units
        if (this.side === 1) {
            gameContext.setMoney(gameContext.money + GameConfig.ECONOMY.KILL_REWARD);
        }
    }

    private checkDeath(gctx: GameContext) {
        if (this.health <= 0 && !this._isDead) {
            this.die(gctx);
        }
    }

    protected beforeStep(gctx: GameContext) {
        const { dt } = gctx;

        // Update IGameUnit systems
        this.updateShields(dt);
        this.updateEffects(dt);
        this.updateForcedMovement(dt);

        this.checkDeath(gctx);
        if (this.bloodDropsToAddOnNextStep.length > 0) {
            gctx.objects.push(...this.bloodDropsToAddOnNextStep);
            this.bloodDropsToAddOnNextStep = [];
        }

        this.attackCooldown.update(dt);
        this.spriteAnimator.update(dt);

        if (this.queuedAttackWithAnimationFrame !== null) {
            if (this.spriteAnimator.currentFrame === this.triggerAttackAnimationFrame) {
                this.queuedAttackWithAnimationFrame(gctx);
                this.queuedAttackWithAnimationFrame = null;
            }
        }

        this.prevPosition = this.position.clone();
    }

    protected afterStep(gctx: GameContext) {
        const newPosition = this.calculatePosition(gctx.dt);

        if (this.spriteAnimator.currentAnimation === ATTACK_ANIMATION_ID && this.spriteAnimator.isPlayingAnimation) {
            this.acceleration = new Vector();
            this.velocity = new Vector();
        }

        // Use pre-computed navigation grid for collision detection
        const gameMap = gctx.background.gameMap;
        const validPosition = gameMap.getValidMovementPosition(this.prevPosition, newPosition);
        this.position = validPosition;

        // If we hit an obstacle, stop velocity
        if (validPosition.x !== newPosition.x || validPosition.y !== newPosition.y) {
            this.velocity = new Vector();
        }

        // Check castle collision
        const collidingWithCastle = this.collisions.some(o => o === gctx.castle);
        if (collidingWithCastle) {
            const pointingTowardsCastle = gctx.castle!.position.clone().sub(this.position).normalize();
            if (this.direction.dot(pointingTowardsCastle) < 0) {
                this.position = this.position.add(this.direction.clone().scalar(10));
            } else {
                this.position = this.prevPosition;
            }
        }
    }

    public render() {
        if (this.queuedAttackWithAnimationFrame !== null || (this.spriteAnimator.currentAnimation === ATTACK_ANIMATION_ID && this.spriteAnimator.isPlayingAnimation)) {
            this.spriteAnimator.playAnimation(ATTACK_ANIMATION_ID);
        } else if (this.isMoving()) {
            this.spriteAnimator.playAnimation(WALK_ANIMATION_ID);
        } else {
            this.spriteAnimator.stopAnimation();
        }

        return this.buildRenderElement();
    }


    /**
     * Set a target position with pathfinding.
     * Calculates a path using A* and stores waypoints to follow.
     */
    setTargetPositionWithPathfinding(
        targetPos: Vector,
        gameMap: {
            findPath: (from: Vector, to: Vector) => Vector[] | null;
            navigationGrid: { version: number };
        }
    ) {
        const path = gameMap.findPath(this.position, targetPos);
        if (path && path.length > 0) {
            this.currentPath = path;
            this.currentPathIndex = 0;
            this.targetPosition = targetPos;
            this.targetHasBeenSetByPlayer = true;
            this.pathGridVersion = gameMap.navigationGrid.version;
        } else {
            // No path found, try direct movement
            this.currentPath = [];
            this.currentPathIndex = 0;
            this.targetPosition = targetPos;
            this.targetHasBeenSetByPlayer = true;
            this.pathGridVersion = gameMap.navigationGrid.version;
        }
    }

    /**
     * Clear the current path and target position.
     */
    clearPath() {
        this.currentPath = [];
        this.currentPathIndex = 0;
        this.targetPosition = null;
    }

    /**
     * Set lane waypoints for direct following (bypasses A* pathfinding).
     * Used by MOBA lane minions.
     */
    setLaneWaypoints(waypoints: Vector[]) {
        this.laneWaypoints = waypoints.map(wp => wp.clone());
        this.laneWaypointIndex = 0;
        if (waypoints.length > 0) {
            this.targetPosition = waypoints[waypoints.length - 1].clone();
        }
    }

    /**
     * Clear lane waypoints.
     */
    clearLaneWaypoints() {
        this.laneWaypoints = [];
        this.laneWaypointIndex = 0;
    }

    /**
     * Check if unit is following lane waypoints.
     */
    isFollowingLane(): boolean {
        return this.laneWaypoints.length > 0;
    }

    step(gctx: GameContext) {
        this.beforeStep(gctx);

        // Build context for behavior
        const behaviorContext = this.buildBehaviorContext(gctx);

        // Get decision from behavior
        const decision = this.behavior.update(behaviorContext);

        // Apply behavior decision
        this.applyBehaviorDecision(decision, gctx);

        // Execute attack if behavior decided to attack
        if (decision.shouldAttack && this.target && !this.isAttacking) {
            this.performAttack(gctx);
        }

        // Apply movement from behavior
        this.applyBehaviorMovement(decision, gctx);

        this.afterStep(gctx);
    }

    // ===================
    // Behavior System Methods
    // ===================

    /**
     * Get the current behavior.
     */
    getBehavior(): UnitBehavior {
        return this.behavior;
    }

    /**
     * Set the unit's behavior.
     * @param newBehavior - The new behavior to use
     */
    setBehavior(newBehavior: UnitBehavior): void {
        // Detach old behavior
        this.behavior.onDetach?.();

        // Attach new behavior
        this.behavior = newBehavior;
        this.behavior.onAttach?.();
    }

    /**
     * Build the context for behavior decision-making.
     */
    protected buildBehaviorContext(gctx: GameContext): BehaviorContext {
        return {
            gameContext: gctx,
            dt: gctx.dt,
            position: this.position.clone(),
            direction: this.direction.clone(),
            teamId: this.side,
            currentTarget: this.target,
            currentTargetPosition: this.targetPosition,
            attackRange: this.attackRange,
            sightRange: this.outOfSightRange,
            canAttack: this.canAttack(),
            isAttacking: this.isAttacking,
            targetSetByPlayer: this.targetHasBeenSetByPlayer,
        };
    }

    /**
     * Apply the behavior's targeting decision.
     */
    protected applyBehaviorDecision(decision: BehaviorDecision, gctx: GameContext): void {
        // Apply targeting decision
        switch (decision.targeting) {
            case 'clear':
                this.target = null;
                this.targetHasBeenSetByPlayer = false;
                break;
            case 'set':
                if (decision.newTarget) {
                    this.target = decision.newTarget;
                    this.targetHasBeenSetByPlayer = false;
                }
                break;
            case 'acquire':
                // Let behavior handle acquisition in next frame
                break;
            case 'keep':
                // Keep current target
                break;
        }

        // Clear target position if we've reached it
        if (this.targetPosition && this.targetPosition.distanceTo(this.position) < 10) {
            this.targetPosition = null;
            this.clearPath();
        }
    }

    /**
     * Apply the behavior's movement decision.
     */
    protected applyBehaviorMovement(decision: BehaviorDecision, gctx: GameContext): void {
        if (this.isAttacking) {
            // Don't move while attacking
            this.velocity = new Vector(0, 0);
            this.acceleration = new Vector(0, 0);
            return;
        }

        let moveDirection: Vector | null = null;

        switch (decision.movement) {
            case 'hold':
                this.velocity = new Vector(0, 0);
                this.acceleration = new Vector(0, 0);
                return;

            case 'move_to_target':
                if (this.target) {
                    moveDirection = this.target.position.clone().sub(this.position).normalize();
                }
                break;

            case 'move_to_position':
                if (decision.moveToPosition) {
                    // Use pathfinding if we have a path
                    moveDirection = this.getPathDirection(decision.moveToPosition, gctx);
                }
                break;

            case 'flee_from_target':
                if (this.target) {
                    moveDirection = this.position.clone().sub(this.target.position).normalize();
                }
                break;

            case 'patrol':
                // Patrol not implemented yet
                break;
        }

        if (moveDirection) {
            // Apply face direction if specified
            if (decision.faceDirection) {
                this.direction = decision.faceDirection.clone();
            } else {
                this.direction = moveDirection.clone();
            }

            this.acceleration = moveDirection.clone().scalar(this.accelerationRate);
            this.velocity = this.calculateVelocity(gctx.dt);
        } else {
            this.velocity = new Vector(0, 0);
            this.acceleration = new Vector(0, 0);
        }
    }

    /**
     * Get movement direction considering pathfinding.
     */
    protected getPathDirection(targetPos: Vector, gctx: GameContext): Vector {
        // Priority 1: Lane waypoints (MOBA lane minions) - now uses pathfinding between waypoints
        if (this.laneWaypoints.length > 0 && this.laneWaypointIndex < this.laneWaypoints.length) {
            const waypoint = this.laneWaypoints[this.laneWaypointIndex];
            const distToWaypoint = this.position.distanceTo(waypoint);

            if (distToWaypoint < 30) {
                this.laneWaypointIndex++;
                // Clear A* path when reaching lane waypoint so we recalculate to next one
                this.currentPath = [];
                this.currentPathIndex = 0;
                if (this.laneWaypointIndex >= this.laneWaypoints.length) {
                    // Reached end of lane, clear waypoints
                    this.clearLaneWaypoints();
                    return targetPos.clone().sub(this.position).normalize();
                }
            }

            // Use A* pathfinding to reach the current lane waypoint
            const currentLaneTarget = this.laneWaypoints[this.laneWaypointIndex];

            // Check if we need a new A* path to this lane waypoint
            if (gctx.navigationGrid && this.currentPath.length === 0) {
                const path = gctx.navigationGrid.findPath(this.position, currentLaneTarget);
                if (path && path.length > 0) {
                    this.currentPath = path;
                    this.currentPathIndex = 0;
                }
            }

            // Follow A* path if available
            if (this.currentPath.length > 0 && this.currentPathIndex < this.currentPath.length) {
                const pathWaypoint = this.currentPath[this.currentPathIndex];
                const distToPathWaypoint = this.position.distanceTo(pathWaypoint);

                if (distToPathWaypoint < 20) {
                    this.currentPathIndex++;
                    if (this.currentPathIndex >= this.currentPath.length) {
                        this.currentPath = [];
                        this.currentPathIndex = 0;
                    }
                }

                if (this.currentPathIndex < this.currentPath.length) {
                    return this.currentPath[this.currentPathIndex].clone().sub(this.position).normalize();
                }
            }

            // Fallback: direct movement to lane waypoint
            return currentLaneTarget.clone().sub(this.position).normalize();
        }

        // Priority 2: A* pathfinding waypoints
        const gameMap = gctx.background.gameMap;

        // Check if navigation grid has changed and path needs recalculation
        if (this.currentPath.length > 0 && this.pathGridVersion !== gameMap.navigationGrid.version) {
            const remainingPath = this.currentPath.slice(this.currentPathIndex);
            if (!gameMap.navigationGrid.isPathValid(remainingPath)) {
                const newPath = gameMap.findPath(this.position, targetPos);
                if (newPath && newPath.length > 0) {
                    this.currentPath = newPath;
                    this.currentPathIndex = 0;
                } else {
                    this.clearPath();
                }
            }
            this.pathGridVersion = gameMap.navigationGrid.version;
        }

        // Follow path waypoints if we have them
        if (this.currentPath.length > 0 && this.currentPathIndex < this.currentPath.length) {
            const waypoint = this.currentPath[this.currentPathIndex];
            const distToWaypoint = this.position.distanceTo(waypoint);

            if (distToWaypoint < 20) {
                this.currentPathIndex++;
                if (this.currentPathIndex >= this.currentPath.length) {
                    this.clearPath();
                    return targetPos.clone().sub(this.position).normalize();
                }
            }

            return this.currentPath[this.currentPathIndex].clone().sub(this.position).normalize();
        }

        // Direct movement fallback
        return targetPos.clone().sub(this.position).normalize();
    }

    /**
     * Execute an attack against the current target.
     * Called by the behavior system when it decides to attack.
     *
     * Subclasses implement this to define HOW they attack:
     * - Melee units deal direct damage
     * - Ranged units spawn projectiles
     *
     * The behavior has already verified:
     * - Target exists and is valid
     * - Unit is in range
     * - Attack is off cooldown
     * - Unit is not already attacking
     */
    protected abstract performAttack(gctx: GameContext): void;

    // ===================
    // IGameUnit Implementation
    // ===================

    getTeamId(): TeamId {
        return this.side;
    }

    /**
     * @deprecated Use getTeamId() instead.
     */
    getSide(): UnitSide {
        return this.side;
    }

    getSightRange(): number {
        return this.outOfSightRange;
    }

    getPosition(): Vector {
        return this.position.clone();
    }

    setPosition(pos: Vector): void {
        this.position = pos.clone();
    }

    getDirection(): Vector {
        return this.direction.clone();
    }

    isDead(): boolean {
        return this._isDead || this.shouldDispose;
    }

    getCurrentHealth(): number {
        return this.health;
    }

    getBaseStats(): UnitBaseStats {
        return {
            health: this.health,
            maxHealth: this.maxHealth,
            armor: this.armor,
            magicResist: this.magicResist,
            movementSpeed: this.maxSpeed,
        };
    }

    getReward(): UnitReward {
        return {
            gold: GameConfig.ECONOMY.KILL_REWARD,
            experience: 10, // Small exp for troops
        };
    }

    /**
     * Take damage with resistance calculation.
     * This is the IGameUnit-compatible damage method.
     */
    takeDamage(rawDamage: number, damageType: DamageType, source?: IGameUnit): number {
        if (this._isDead) return 0;

        let finalDamage = rawDamage;

        // Apply resistances
        switch (damageType) {
            case 'physical':
                finalDamage = rawDamage * (100 / (100 + this.armor));
                break;
            case 'magic':
                finalDamage = rawDamage * (100 / (100 + this.magicResist));
                break;
            case 'true':
                // True damage ignores resistances
                break;
        }

        // Apply shields first
        finalDamage = this.consumeShields(finalDamage);

        // Apply to health
        this.health = Math.max(0, this.health - finalDamage);

        // Generate blood particles
        this.bloodDropsToAddOnNextStep.push(...generateBloodDrops(this.position.clone()));

        return finalDamage;
    }

    heal(amount: number, source?: IGameUnit): number {
        if (this._isDead) return 0;

        const oldHealth = this.health;
        this.health = Math.min(this.maxHealth, this.health + amount);
        return this.health - oldHealth;
    }

    addShield(amount: number, duration: number, source?: string): void {
        this.shields.push({ amount, remainingDuration: duration, source });
    }

    getTotalShield(): number {
        return this.shields.reduce((total, s) => total + s.amount, 0);
    }

    addImmunity(type: string): void {
        this.immunities.add(type);
    }

    removeImmunity(type: string): void {
        this.immunities.delete(type);
    }

    hasImmunity(type: string): boolean {
        return this.immunities.has(type);
    }

    applyEffect(effect: ActiveEffect): void {
        const existing = this.activeEffects.find(
            e => e.definition.id === effect.definition.id
        );

        switch (effect.definition.stackBehavior) {
            case 'refresh':
                if (existing) {
                    existing.timeRemaining = effect.timeRemaining;
                } else {
                    this.activeEffects.push(effect);
                }
                break;
            case 'extend':
                if (existing) {
                    existing.timeRemaining += effect.timeRemaining;
                } else {
                    this.activeEffects.push(effect);
                }
                break;
            case 'stack':
                if (existing && effect.definition.maxStacks) {
                    if (existing.stacks < effect.definition.maxStacks) {
                        existing.stacks++;
                        existing.timeRemaining = effect.timeRemaining;
                    }
                } else {
                    this.activeEffects.push(effect);
                }
                break;
            case 'replace':
                this.activeEffects = this.activeEffects.filter(
                    e => e.definition.id !== effect.definition.id
                );
                this.activeEffects.push(effect);
                break;
            case 'ignore':
                if (!existing) {
                    this.activeEffects.push(effect);
                }
                break;
        }
    }

    removeEffect(effectId: string): void {
        this.activeEffects = this.activeEffects.filter(
            e => e.definition.id !== effectId
        );
    }

    applyKnockback(direction: Vector, distance: number, duration: number): void {
        if (this.hasImmunity('knockback')) return;

        this.forcedMovement = {
            direction: direction.clone().normalize(),
            distance,
            duration,
            elapsed: 0,
            type: 'knockback',
        };
    }

    isInForcedMovement(): boolean {
        return this.forcedMovement !== null;
    }

    getCrowdControlStatus(): CrowdControlStatus {
        return computeCCStatus(this.activeEffects);
    }

    // ===================
    // Shield Management
    // ===================

    protected consumeShields(damage: number): number {
        let remainingDamage = damage;

        for (const shield of this.shields) {
            if (remainingDamage <= 0) break;

            if (shield.amount >= remainingDamage) {
                shield.amount -= remainingDamage;
                remainingDamage = 0;
            } else {
                remainingDamage -= shield.amount;
                shield.amount = 0;
            }
        }

        this.shields = this.shields.filter(s => s.amount > 0);
        return remainingDamage;
    }

    protected updateShields(dt: number): void {
        for (const shield of this.shields) {
            shield.remainingDuration -= dt;
        }
        this.shields = this.shields.filter(s => s.remainingDuration > 0 && s.amount > 0);
    }

    // ===================
    // Effect Management
    // ===================

    protected updateEffects(dt: number): void {
        for (const effect of this.activeEffects) {
            if (effect.timeRemaining !== undefined) {
                effect.timeRemaining -= dt;
            }
        }
        this.activeEffects = this.activeEffects.filter(
            e => e.timeRemaining === undefined || e.timeRemaining > 0
        );
    }

    // ===================
    // Forced Movement
    // ===================

    protected updateForcedMovement(dt: number): void {
        if (!this.forcedMovement) return;

        this.forcedMovement.elapsed += dt;

        if (this.forcedMovement.elapsed >= this.forcedMovement.duration) {
            this.forcedMovement = null;
            return;
        }

        const speed = this.forcedMovement.distance / this.forcedMovement.duration;
        const movement = this.forcedMovement.direction.clone().scalar(speed * dt);
        this.position.add(movement);
    }

    buildRenderElement() {
        return new RenderElement((gtx) => {
            const { canvasRenderingContext } = gtx;
            let color = this.side === 0 ? "white" : "red";

            // Draws a circle around the unit if it's selected or hovered
            if (this.isSelected || this.isBeingHovered) {
                const drawUtils = new PixelArtDrawUtils(canvasRenderingContext, color, 2);
                drawUtils.drawPixelatedEllipse(this.position.x, this.position.y + this.collisionMask.h / 2, this.collisionMask.w / 2, this.collisionMask.h / 4,);
            }

            // Debug: Draw pathfinding line for selected units
            if (GameConfig.DEBUG.SHOW_PATHS && this.isSelected && this.currentPath.length > 0) {
                this.drawDebugPath(canvasRenderingContext);
            }

            this.spriteAnimator.render(
                canvasRenderingContext,
                this.position,
                this.direction.x < 0
            );
        }, true);
    }

    /**
     * Draw the current path as a debug visualization.
     */
    private drawDebugPath(ctx: CanvasRenderingContext2D) {
        if (this.currentPath.length === 0) return;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(this.position.x, this.position.y);

        // Draw line through all remaining waypoints
        for (let i = this.currentPathIndex; i < this.currentPath.length; i++) {
            const waypoint = this.currentPath[i];
            ctx.lineTo(waypoint.x, waypoint.y);
        }

        ctx.stroke();

        // Draw waypoint markers
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = this.currentPathIndex; i < this.currentPath.length; i++) {
            const waypoint = this.currentPath[i];
            ctx.beginPath();
            ctx.arc(waypoint.x, waypoint.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw final destination marker (larger)
        if (this.currentPath.length > 0) {
            const dest = this.currentPath[this.currentPath.length - 1];
            ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.beginPath();
            ctx.arc(dest.x, dest.y, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    protected get isAttacking() {
        return (
            this.spriteAnimator.currentAnimation === ATTACK_ANIMATION_ID &&
            this.spriteAnimator.isPlayingAnimation
        );
    }

}


export default ArmyUnit;