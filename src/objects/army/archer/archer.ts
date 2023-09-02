import GameContext from "@/core/gameContext";
import Disposable, { isDisposable } from "@/behaviors/disposable";
import Vector from "@/physics/vector";
import { PhysicableMixin } from "@/mixins/physics";
import { CollisionableMixin } from "@/mixins/collisionable";
import RenderElement from "@/render/renderElement";
import PixelArtSpriteAnimator from "@/sprites/PixelArtSpriteAnimator";
import PixelArtSpriteSheet from "@/sprites/PixelArtSpriteSheet";
import Attackable, { isAttackable } from "@/behaviors/attackable";
/// TODO(): reuse with swordsman
import { generateSwordsmanBloodBath } from "../swordsman/ParticleUtils";
import Background from "@/objects/background";
import BaseObject from "@/objects/baseObject";
import { Rectangle, Square } from "@/objects/shapes";
import { buildArcherSprites } from "./sprites";

const ATTACK_RANGE = 200;
const OUT_OF_REACH_RANGE = 350;

const archerAttackSpriteFrames = [3, 4, 5, 6, 7,]
const archerAttackAnimationDurationPerFrame = 0.2;
const archerArrowReleaseFrameAnimationDuration = archerAttackAnimationDurationPerFrame * 4;

/// TODO(): reuse with swordsman
const ArcherMixin = PhysicableMixin(
    CollisionableMixin<Square>()(BaseObject)
);

const archerSpriteSheetAlly = new PixelArtSpriteSheet(
    buildArcherSprites(0)
);
const archermanSpriteSheetEnemy = new PixelArtSpriteSheet(
    buildArcherSprites(1)
);

class Archer
    extends ArcherMixin
    implements ArmyUnit, Disposable, Attackable {
    side: 0 | 1;
    rotationSpeed: number;
    target: BaseObject | null;
    attackTimeout = 1000;
    attackingTimeout = 0;
    spriteAnimator: PixelArtSpriteAnimator;
    health = 10;

    constructor(position: Vector, side: 0 | 1) {
        super(position);
        this.direction = new Vector(1, 0);
        this.collisionMask = new Square(32);
        this.side = side;
        this.rotationSpeed = 2;
        this.target = null;
        this.shouldDispose = false;
        this.attackTimeout = 3;
        this.attackingTimeout = 0;
        this.spriteAnimator = new PixelArtSpriteAnimator(
            side === 0 ? archerSpriteSheetAlly : archermanSpriteSheetEnemy,
            1
        );
        this.spriteAnimator.addAnimation("w", [0, 1, 2], 0.2);
        this.spriteAnimator.addAnimation("a", archerAttackSpriteFrames, archerAttackAnimationDurationPerFrame);
        this.spriteAnimator.playAnimation("w", true);
    }


    shouldDispose: boolean;

    dispose() {
        this.shouldDispose = true;
    }

    render() {
        if (this.isAttacking) {
            this.spriteAnimator.playAnimation("a");
        } else if (this.isMoving()) {
            this.spriteAnimator.playAnimation("w");
        } else {
            this.spriteAnimator.stopAnimation();
        }

        return new RenderElement((gtx) => {
            const { canvasRenderingContext } = gtx;
            this.spriteAnimator.render(
                canvasRenderingContext,
                this.position,
                this.direction.x < 0
            );
        }, true);
    }

    step(gctx: GameContext) {
        const { dt } = gctx;
        let hasSetAnimation = false;

        if (this.health <= 0) {
            this.die(gctx);
        }

        if (this.target && isDisposable(this.target) && this.target.shouldDispose) {
            this.target = null;
        }

        this.attackingTimeout -= dt;
        this.spriteAnimator.update(dt);

        this.fixTarget(gctx);

        if (!this.isAttacking) {

            this.adjustDirection(gctx.dt);
            const lookAt = this.target?.position.clone()
                .sub(this.position)
                .normalize() ?? new Vector(0, 0);
            this.acceleration = lookAt.scalar(4);
            this.velocity = this.calculateVelocity(gctx.dt);
            this.position = this.calculatePosition(gctx.dt);
        }

        if (this.shouldAttack) {
            hasSetAnimation = this.attack(gctx);
        }


        if (!hasSetAnimation) {
            this.spriteAnimator.playAnimation("w", false);
        }
    }

    /// TODO remove, not worth it.
    private adjustDirection(dt: number) {
        const lookAt = this.target?.position.clone()
            .sub(this.position)
            .normalize() ?? new Vector(0, 0);

        const angleToEnemy = this.direction.angleTo(lookAt);
        const rotationAmount = this.rotationSpeed * dt;
        const rotationAngle =
            Math.sign(angleToEnemy) *
            Math.min(Math.abs(angleToEnemy), rotationAmount);

        this.direction = this.direction
            .rotate(rotationAngle, false)
            .normalize();
    }

    private fixTarget(gameContext: GameContext) {
        const { spatialHashing } = gameContext;
        if (this.target && (this.target.id === 'castle' || this.target.position.distanceTo(this.position) > OUT_OF_REACH_RANGE)) {
            this.target = null;
        }

        if (!this.target || this.target.id === 'castle') {
            const nearByObjs = spatialHashing.query(this.position);
            /// TODO fix types
            const nearByEnemies = nearByObjs.filter(obj => (obj as any).side !== undefined && (obj as any).side !== this.side);
            if (nearByEnemies.length > 0) {
                this.target = this.getNearestEnemy(nearByEnemies);
            } else {
                this.target = gameContext.objects.find(obj => obj.id === 'castle') ?? null;
            }
        }
    }

    private attack(gameContext: GameContext): boolean {
        this.attackingTimeout = this.attackTimeout;

        const isLookingLeft = this.direction.x < 0;
        /// adds a little offset to the arrow position
        const arrowPositionOffset = new Vector(0, 1.5);
        const arrow = new Arrow(this.position.clone().add(arrowPositionOffset), this.direction.clone(), this.side);
        setTimeout(() => {
            gameContext.objects.push(arrow);
        }, archerArrowReleaseFrameAnimationDuration * 1000)

        this.spriteAnimator.playAnimation("a", true,);
        this.acceleration = new Vector(0, 0);
        this.velocity = new Vector(0, 0);
        // if (isAttackable(this.target)) {
        // this.target.hasBeenAttacked(3);
        // }
        return true
    }

    private getNearestEnemy(enemies: BaseObject[]) {
        enemies.sort((a, b) => {
            const aDistance = a.position.distanceTo(this.position);
            const bDistance = b.position.distanceTo(this.position);
            return aDistance - bDistance;
        });
        return enemies[0];
    }

    hasBeenAttacked(damage: number) {
        if (!this.tryToBlockAttack(damage)) {
            this.health -= damage;
        }
    }

    private tryToBlockAttack(damage: number) {
        return false;
    }

    private die(gameContext: GameContext) {
        this.shouldDispose = true;
        gameContext.objects.push(
            ...generateSwordsmanBloodBath(this.position.clone())
        );
        const background = gameContext.objects.find(obj => obj.id === 'background');
        if (background instanceof Background) {
            background.drawArcherBloodstain(this.position.clone().add(new Vector(0, this.collisionMask.h / 2)));
        }
    }

    private get isAttacking() {
        return (
            this.spriteAnimator.currentAnimation === "a" &&
            this.spriteAnimator.isPlayingAnimation &&
            this.attackingTimeout > 0
        );
    }

    private get shouldAttack() {
        return this.target && this.canAttack && this.target.position.distanceTo(this.position) < ATTACK_RANGE;
    }

    private get canAttack() {
        return this.attackingTimeout <= 0;
    }
}

export default Archer;


const ArrowMixin = PhysicableMixin(CollisionableMixin<Rectangle>()(BaseObject));
const ARROW_LENGTH = 14;
class Arrow extends ArrowMixin implements Disposable {

    shouldDispose: boolean;
    side: 0 | 1;
    ttl: number;

    constructor(position: Vector, direction: Vector, side: 0 | 1) {
        super(position);
        this.direction = direction;
        this.collisionMask = new Rectangle(10, 2);
        this.velocity = direction.scalar(300);
        this.acceleration = direction.scalar(1);
        this.shouldDispose = false;
        this.side = side;
        this.friction = 0;
        this.ttl = 2;
    }

    step(gameContext: GameContext) {
        this.position = this.calculatePosition(gameContext.dt);
        const { collisions } = gameContext;
        const collisionsWith = collisions[this.id];
        if (collisionsWith && collisionsWith.length > 0) {
            // find collision with enemy
            const enemy = collisionsWith.find(obj => (obj as any).side !== undefined && (obj as any).side !== this.side);
            if (enemy) {
                if (isAttackable(enemy)) {
                    enemy.hasBeenAttacked(3);
                }
                this.shouldDispose = true;
            }
        }
        this.ttl -= gameContext.dt;
        if (this.ttl <= 0) {

            this.shouldDispose = true;
            const background = gameContext.objects.find(obj => obj.id === 'background');
            if (background instanceof Background) {
                background.drawArrow(this.position.clone(), this.direction.clone());
            }
        }
    }

    render() {
        return new RenderElement((gtx) => {
            const { canvasRenderingContext } = gtx;
            canvasRenderingContext.strokeStyle = 'black';
            canvasRenderingContext.translate(this.position.x, this.position.y);
            canvasRenderingContext.rotate(new Vector(1, 0).angleTo(this.direction));
            canvasRenderingContext.beginPath();
            canvasRenderingContext.moveTo(0, 0);
            canvasRenderingContext.lineTo(ARROW_LENGTH, 0);
            canvasRenderingContext.moveTo(ARROW_LENGTH - 2, 1.5);
            canvasRenderingContext.lineTo(ARROW_LENGTH - 2, -1.5);
            canvasRenderingContext.stroke();
        }, true);
    }
}