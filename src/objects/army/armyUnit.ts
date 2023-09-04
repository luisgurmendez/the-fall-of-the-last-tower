import { ArmyUnitSide, Target } from "@/objects/army/types";
import { Rectangle, Square } from "@/objects/shapes";
import BaseObject from "@/objects/baseObject";
import { PhysicableMixin } from "@/mixins/physics";
import { Collisionable, CollisionableMixin } from "@/mixins/collisionable";
import Cooldown from "../cooldown";
import GameContext from "@/core/gameContext";
import Disposable from "@/behaviors/disposable";
import { generateBloodExplotion } from "./swordsman/ParticleUtils";
import Background, { BACKGROUND_ID } from "../background";
import Vector from "@/physics/vector";
import PixelArtSpriteAnimator from "@/sprites/PixelArtSpriteAnimator";
import RenderElement from "@/render/renderElement";
import RenderUtils from "@/render/utils";
import Archer from "./archer/archer";

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

    abstract chooseTypeOfBloodstainWhenDying(background: Background): (inPosition: Vector) => void;

    protected abstract attack(g: GameContext): void;

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

    // Consumes the armor first, then the health
    applyDamage(rawDamage: number) {
        const remainingDamage = Math.max(0, rawDamage - this.armor);
        this.armor = Math.max(0, this.armor - rawDamage);
        this.health = Math.max(0, this.health - remainingDamage);
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