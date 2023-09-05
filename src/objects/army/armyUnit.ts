import { ArmyUnitSide, Target } from "@/objects/army/types";
import { Rectangle, Square } from "@/objects/shapes";
import BaseObject from "@/objects/baseObject";
import { PhysicableMixin } from "@/mixins/physics";
import { Collisionable, CollisionableMixin } from "@/mixins/collisionable";
import Cooldown from "../cooldown";
import GameContext from "@/core/gameContext";
import Disposable from "@/behaviors/disposable";
import { generateBloodDrops, generateBloodExplotion } from "./ParticleUtils";
import Background, { BACKGROUND_ID } from "../background";
import Vector from "@/physics/vector";
import PixelArtSpriteAnimator from "@/sprites/PixelArtSpriteAnimator";
import RenderElement from "@/render/renderElement";
import RenderUtils from "@/render/utils";
import Archer from "./archer/archer";
import Particle from "../particle/particle";


export const ATTACK_ANIMATION_ID = "a";
export const WALK_ANIMATION_ID = "w";
export const IDLE_ANIMATION_ID = "w";

const BaseArmyUnit = PhysicableMixin(
    CollisionableMixin<Square>()(BaseObject)
);

abstract class ArmyUnit extends BaseArmyUnit implements Disposable {
    shouldDispose: boolean = false;
    dispose?: (() => void | undefined) | undefined;
    protected abstract side: ArmyUnitSide;
    protected abstract health: number;
    protected abstract maxHealth: number;
    protected abstract maxArmor: number;
    protected abstract armor: number;
    protected abstract attackCooldown: Cooldown;
    protected abstract target: Target | null;
    protected abstract spriteAnimator: PixelArtSpriteAnimator;
    private bloodDropsToAddOnNextStep: Particle[] = [];

    /// The frame in which the attack should be triggered.
    protected abstract triggerAttackAnimationFrame: number;
    private queuedAttackWithAnimationFrame: ((gctx: GameContext) => void) | null = null;

    abstract chooseTypeOfBloodstainWhenDying(background: Background): (inPosition: Vector) => void;

    protected attack(attackCb: (gctx: GameContext) => void) {
        this.spriteAnimator.playAnimation("a", true);
        this.acceleration = new Vector(0, 0);
        this.velocity = new Vector(0, 0);
        this.attackCooldown.start();
        this.queuedAttackWithAnimationFrame = attackCb;
    }

    protected canAttack() {
        return !this.attackCooldown.isCooling();
    }

    protected die(gameContext: GameContext) {
        this.shouldDispose = true;
        gameContext.objects.push(
            ...generateBloodExplotion(this.position.clone())
        );
        const background = gameContext.objects.find(obj => obj.id === BACKGROUND_ID);
        if (background instanceof Background) {
            this.chooseTypeOfBloodstainWhenDying(background)(this.position.clone().add(new Vector(0, this.collisionMask.h / 2)));
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
    }

    protected afterStep(gctx: GameContext) {
        if (this.spriteAnimator.currentAnimation === "a" && this.spriteAnimator.isPlayingAnimation) {
            this.acceleration = new Vector(0, 0);
            this.velocity = new Vector(0, 0);
        }
    }

    public render() {
        if (this.queuedAttackWithAnimationFrame !== null || (this.spriteAnimator.currentAnimation === "a" && this.spriteAnimator.isPlayingAnimation)) {
            this.spriteAnimator.playAnimation("a");
        } else if (this.isMoving()) {
            this.spriteAnimator.playAnimation("w");
        } else {
            this.spriteAnimator.stopAnimation();
        }

        return this.buildRenderElement();
    }


    // Consumes the armor first, then the health
    applyDamage(rawDamage: number) {
        const remainingDamage = Math.max(0, rawDamage - this.armor);
        this.armor = Math.max(0, this.armor - rawDamage);
        this.health = Math.max(0, this.health - remainingDamage);
        this.bloodDropsToAddOnNextStep.push(...generateBloodDrops(this.position.clone()))

    }

    buildRenderElement() {
        return new RenderElement((gtx) => {
            const { canvasRenderingContext } = gtx;
            this.spriteAnimator.render(
                canvasRenderingContext,
                this.position,
                this.direction.x < 0
            );
        }, true);
    }

}


export default ArmyUnit;