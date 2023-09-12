import GameContext from "@/core/gameContext";
import Disposable, { isDisposable } from "@/behaviors/disposable";
import Vector from "@/physics/vector";
import PixelArtSpriteAnimator from "@/sprites/PixelArtSpriteAnimator";
import PixelArtSpriteSheet from "@/sprites/PixelArtSpriteSheet";
import Background from "@/objects/background";
import BaseObject from "@/objects/baseObject";
import { Square } from "@/objects/shapes";
import { archerSprites } from "./sprites";
import { buildArmySpritesWithSideColor } from "../spriteUtils";
import Arrow from "./arrow";
import ArmyUnit, { ATTACK_ANIMATION_ID, WALK_ANIMATION_ID } from "../armyUnit";
import { Target } from "../types";
import Cooldown from "@/objects/cooldown";

const ATTACK_RANGE = 800;
const OUT_OF_REACH_RANGE = ATTACK_RANGE * 2;
const ACCELERATION = 500;

const archerAttackSpriteFrames = [3, 4, 5, 6, 7,]

const archerSpriteSheetAlly = new PixelArtSpriteSheet(
    buildArmySpritesWithSideColor(archerSprites, 0)
);
const archermanSpriteSheetEnemy = new PixelArtSpriteSheet(
    buildArmySpritesWithSideColor(archerSprites, 1)
);

class Archer extends ArmyUnit {
    protected attackRange: number = ATTACK_RANGE;
    protected accelerationRate: number = ACCELERATION;
    protected outOfSightRange: number = OUT_OF_REACH_RANGE;
    protected maxHealth: number = 30;
    protected maxArmor: number = 10;
    protected armor: number = 0;
    protected attackCooldown: Cooldown = new Cooldown(5);

    side: 0 | 1;
    rotationSpeed: number;
    target: Target | null;
    spriteAnimator: PixelArtSpriteAnimator;
    health = 10;
    protected triggerAttackAnimationFrame: number;

    constructor(position: Vector, side: 0 | 1) {
        super(position);
        this.direction = new Vector(1, 0);
        this.collisionMask = new Square(32);
        this.side = side;
        this.rotationSpeed = 2;
        this.target = null;
        this.shouldDispose = false;
        this.spriteAnimator = new PixelArtSpriteAnimator(
            side === 0 ? archerSpriteSheetAlly : archermanSpriteSheetEnemy,
            3
        );
        this.spriteAnimator.addAnimation(WALK_ANIMATION_ID, [0, 1, 2], 0.2);
        this.spriteAnimator.addAnimation(ATTACK_ANIMATION_ID, archerAttackSpriteFrames, 0.2);
        this.spriteAnimator.playAnimation(WALK_ANIMATION_ID, true);
        this.triggerAttackAnimationFrame = 4;
    }

    shouldDispose: boolean;

    protected attackIfPossible(g: GameContext) {
        if (this.shouldAttack) {
            const direction = this.target!.position.clone().sub(this.position.clone()).normalize();
            this.direction = direction.clone();
            const arrowPositionOffset = new Vector(0, 1.5);
            const position = this.position.clone();
            this.attack((gameContext) => {
                const arrow = new Arrow(position.add(arrowPositionOffset), direction, this.side);
                gameContext.objects.push(arrow);
            });
        }
    }

    // private move(g: GameContext) {
    //     if (!this.isAttacking) {
    //         let _lookingAtDirection;

    //         if (this.targetPosition) {
    //             _lookingAtDirection = this.targetPosition.clone().sub(this.position).normalize();
    //         } else if (this.target) {
    //             // move away of target if too close, ak half the attack range
    //             if (this.target.position.distanceTo(this.position) < ATTACK_RANGE) {
    //                 _lookingAtDirection = this.position.clone().sub(this.target.position.clone()).normalize();
    //             } else {
    //                 _lookingAtDirection = this.target.position.clone().sub(this.position.clone()).normalize();
    //             }
    //         } else {
    //             this.velocity = new Vector(0, 0);
    //             this.acceleration = new Vector(0, 0);
    //             return;
    //         }

    //         this.direction = _lookingAtDirection.clone();
    //         this.acceleration = _lookingAtDirection.scalar(this.accelerationRate);
    //         this.velocity = this.calculateVelocity(g.dt);
    //     }
    // }


    // private fixTarget(gameContext: GameContext) {
    //     const { spatialHashing } = gameContext;

    //     if (this.target && isDisposable(this.target) && this.target.shouldDispose) {
    //         this.target = null;
    //     }

    //     if (this.targetPosition && this.targetPosition.distanceTo(this.position) < 10) {
    //         this.targetPosition = null;
    //     }


    //     if (this.targetPosition) {
    //         this.target = null;
    //     } else {
    //         if (this.target && (this.target.id === CASTLE_ID || this.target.position.distanceTo(this.position) > OUT_OF_REACH_RANGE)) {
    //             this.target = null;
    //         }

    //         if (!this.target || this.target.id === CASTLE_ID) {
    //             const nearByObjs = spatialHashing.query(this.position);
    //             const nearByEnemies = nearByObjs.filter(otherSideObjectsFiltering(this.side));
    //             if (nearByEnemies.length > 0) {
    //                 this.target = RandomUtils.getRandomValueOf(nearByEnemies) as Target;
    //             } else if (this.side === 1) {
    //                 this.targetPosition = new Vector();
    //             }
    //         }
    //     }

    // }

    private get shouldAttack() {
        return this.target && this.canAttack() && this.target.position.distanceTo(this.position) < ATTACK_RANGE;
    }

    chooseTypeOfBloodstainWhenDying(background: Background): (inPosition: Vector) => void {
        return background.drawArcherBloodstain.bind(background);
    }
}

export default Archer;
