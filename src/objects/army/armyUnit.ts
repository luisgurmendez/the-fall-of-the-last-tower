import { ArmyUnitSide, Target } from "@/objects/army/types";
import { Square } from "@/objects/shapes";
import BaseObject from "@/objects/baseObject";
import { PhysicableMixin } from "@/mixins/physics";
import { CollisionableMixin } from "@/mixins/collisionable";
import Cooldown from "../cooldown";
import GameContext from "@/core/gameContext";
import Disposable, { isDisposable } from "@/behaviors/disposable";
import { generateBloodDrops, generateBloodExplotion } from "./ParticleUtils";
import Background, { BACKGROUND_ID, isNotInsidePlayableAreaFn } from "../background";
import Vector from "@/physics/vector";
import PixelArtSpriteAnimator from "@/sprites/PixelArtSpriteAnimator";
import RenderElement from "@/render/renderElement";
import Particle from "../particle/particle";
import PixelArtDrawUtils from "@/utils/pixelartDrawUtils";
import { CASTLE_ID } from "../castle/castle";
import { otherSideObjectsFiltering } from "./utils";
import RandomUtils from "@/utils/random";
import { isAttackable } from "@/behaviors/attackable";

export const ATTACK_ANIMATION_ID = "a";
export const WALK_ANIMATION_ID = "w";

const BaseArmyUnit = PhysicableMixin(
    CollisionableMixin<Square>()(BaseObject)
);

abstract class ArmyUnit extends BaseArmyUnit implements Disposable {
    shouldDispose: boolean = false;
    dispose?: (() => void | undefined) | undefined;
    abstract side: ArmyUnitSide;
    protected abstract outOfSightRange: number;
    protected abstract health: number;
    protected abstract maxHealth: number;
    protected abstract maxArmor: number;
    protected abstract armor: number;
    protected abstract attackCooldown: Cooldown;
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

    protected abstract spriteAnimator: PixelArtSpriteAnimator;
    private bloodDropsToAddOnNextStep: Particle[] = [];

    /// The frame in which the attack should be triggered.
    protected abstract triggerAttackAnimationFrame: number;
    private queuedAttackWithAnimationFrame: ((gctx: GameContext) => void) | null = null;
    private prevPosition: Vector = new Vector();

    abstract chooseTypeOfBloodstainWhenDying(background: Background): (inPosition: Vector) => void;

    protected attack(attackCb: (gctx: GameContext) => void) {
        if (!this.isAttacking) {
            this.spriteAnimator.playAnimation(ATTACK_ANIMATION_ID, true);
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
        this.shouldDispose = true;
        gameContext.objects.push(
            ...generateBloodExplotion(this.position.clone())
        );
        this.chooseTypeOfBloodstainWhenDying(gameContext.background)(this.position.clone().add(new Vector(0, this.collisionMask.h / 2)));
        if (this.side === 1) {
            gameContext.setMoney(gameContext.money + 50);
        }
    }

    private checkDeath(gctx: GameContext) {
        if (this.health <= 0) {
            this.die(gctx);
        }
    }

    protected beforeStep(gctx: GameContext) {
        const { dt } = gctx;

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
        this.position = this.calculatePosition(gctx.dt);

        if (this.spriteAnimator.currentAnimation === ATTACK_ANIMATION_ID && this.spriteAnimator.isPlayingAnimation) {
            this.acceleration = new Vector();
            this.velocity = new Vector();
        }
        const collidingWithCastle = this.collisions.some(o => o === gctx.castle);
        if (collidingWithCastle || isNotInsidePlayableAreaFn(this.position)) {

            // if its colliding with castle and its not looking towards the castle teleport them 10 pixels away from the castle
            const pointingTowardsCastle = gctx.castle!.position.clone().sub(this.position).normalize();
            if (collidingWithCastle && this.direction.dot(pointingTowardsCastle) < 0) {
                this.position = this.position.add(this.direction.clone().scalar(10));
            } else {
                this.position = this.prevPosition
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


    protected fixTarget(gameContext: GameContext) {

        const { spatialHashing, castle } = gameContext;

        // set the target to null if target is too far away or if it should be disposed or the target is actually the CASTLE,
        // units take priority over castle
        if (this.target && (this.target.id === CASTLE_ID || (isDisposable(this.target) && this.target.shouldDispose) || (!this.targetHasBeenSetByPlayer && this.target.position.distanceTo(this.position) > this.outOfSightRange))) {
            this.target = null;
        }

        // set the targetPos to null if it's already reached
        if (this.targetPosition && this.targetPosition.distanceTo(this.position) < 10) {
            this.targetPosition = null;
        }

        // if there is a targetPosition don't look for new targets
        if (this.targetPosition) {
            this.target = null;
        } else {
            if (!this.target) {
                const nearByObjs = spatialHashing.queryInRange(this.position, this.outOfSightRange / 2);
                const nearByEnemies = nearByObjs.filter(otherSideObjectsFiltering(this.side)).filter(isAttackable);
                if (nearByEnemies.length > 0) {
                    this.target = RandomUtils.getRandomValueOf(nearByEnemies) as Target;
                    this.targetHasBeenSetByPlayer = false
                } else if (this.side === 1) {
                    this.target = castle ?? null;
                    this.targetHasBeenSetByPlayer = false
                }
            }
        }
    }

    protected move(g: GameContext) {
        if (!this.isAttacking) {
            let _lookingAtDirection = this.direction.clone();

            if (this.targetPosition) {
                _lookingAtDirection = this.targetPosition.clone().sub(this.position).normalize();
            } else if (this.target) {
                const distanceToTarget = this.target.position.distanceTo(this.position);
                const comfortRange = this.attackRange + 10; // Add a buffer, you can adjust the value based on your needs

                // Check if target is too close
                if (distanceToTarget < this.attackRange) {
                    _lookingAtDirection = this.position.clone().sub(this.target.position.clone()).normalize();
                }
                // Check if target is within the comfort range but outside the attack range.
                // In this case, the archer won't change the direction and will continue in its current direction.
                else if (distanceToTarget >= this.attackRange && distanceToTarget <= comfortRange) {
                    // Keep the current direction and don't change the _lookingAtDirection
                }
                // If target is beyond the comfort range
                else {
                    _lookingAtDirection = this.target.position.clone().sub(this.position.clone()).normalize();
                }
            } else {
                this.velocity = new Vector(0, 0);
                this.acceleration = new Vector(0, 0);
                return;
            }

            this.direction = _lookingAtDirection.clone();
            this.acceleration = _lookingAtDirection.clone().scalar(this.accelerationRate);
            this.velocity = this.calculateVelocity(g.dt);
        }
    }

    step(gctx: GameContext) {
        this.beforeStep(gctx);
        this.fixTarget(gctx);
        this.attackIfPossible(gctx);
        this.move(gctx)
        this.afterStep(gctx)
    }

    // Consumes the armor first, then the health
    applyDamage(rawDamage: number) {
        const remainingDamage = Math.max(0, rawDamage - this.armor);
        this.armor = Math.max(0, this.armor - rawDamage);
        this.health = Math.max(0, this.health - remainingDamage);
        this.bloodDropsToAddOnNextStep.push(...generateBloodDrops(this.position.clone()))
    }

    protected abstract attackIfPossible(g: GameContext): void;

    buildRenderElement() {
        return new RenderElement((gtx) => {
            const { canvasRenderingContext } = gtx;
            let color = this.side === 0 ? "white" : "red";

            // Draws a circle around the unit if it's selected or hovered
            if (this.isSelected || this.isBeingHovered) {
                const drawUtils = new PixelArtDrawUtils(canvasRenderingContext, color, 2);
                drawUtils.drawPixelatedEllipse(this.position.x, this.position.y + this.collisionMask.h / 2, this.collisionMask.w / 2, this.collisionMask.h / 4,);
            }

            this.spriteAnimator.render(
                canvasRenderingContext,
                this.position,
                this.direction.x < 0
            );
        }, true);
    }

    protected get isAttacking() {
        return (
            this.spriteAnimator.currentAnimation === ATTACK_ANIMATION_ID &&
            this.spriteAnimator.isPlayingAnimation
        );
    }

}


export default ArmyUnit;