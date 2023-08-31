import GameContext from "../../core/gameContext";
import BaseObject from "../../objects/baseObject";
import Initializable from "../../behaviors/initializable";
import Disposable, { isDisposable } from "../../behaviors/disposable";
import Vector from "../../physics/vector";
import { PhysicableMixin } from "../../mixins/physics";
import { CollisionableMixin } from "../../mixins/collisionable";
import { Circle, Square } from "../../objects/shapes";
import RenderElement from "../../render/renderElement";
import RenderUtils from "../../render/utils";
import PixelArtSpriteAnimator from "../../sprites/PixelArtSpriteAnimator";
import soldierSprites, { buildSwordsManSprites } from './sprites';
import PixelArtSpriteSheet from "../../sprites/PixelArtSpriteSheet";

const SoldierMixin = PhysicableMixin(CollisionableMixin<Square>()(BaseObject));

const swordsmanSpriteSheetAlly = new PixelArtSpriteSheet(buildSwordsManSprites(0));
const swordsmanSpriteSheetEnemy = new PixelArtSpriteSheet(buildSwordsManSprites(1));

class Soldier extends SoldierMixin implements ArmyUnit, Disposable {
    side: 0 | 1;
    rotationSpeed: number;
    target: BaseObject | null;
    attackTimeout: number = 0;
    attackingTimeout = 0;
    spriteAnimator: PixelArtSpriteAnimator;

    constructor(position: Vector, side: 0 | 1) {
        super(position);
        this.direction = new Vector(1, 0);
        this.collisionMask = new Square(6);
        this.side = side;
        this.rotationSpeed = 2;
        this.target = null;
        this.shouldDispose = false;
        this.attackTimeout = 1;
        this.attackingTimeout = 0;
        this.spriteAnimator = new PixelArtSpriteAnimator(side === 0 ? swordsmanSpriteSheetAlly : swordsmanSpriteSheetEnemy, 1);
        this.spriteAnimator.addAnimation('w', [0, 1, 2], 0.2);
        this.spriteAnimator.addAnimation('a', [3, 4, 5, 6, 7, 8, 9], 0.2);
        this.spriteAnimator.playAnimation('w', true);
    }

    shouldDispose: boolean;

    dispose() {
        this.shouldDispose = true;
    }

    render() {
        return new RenderElement((gtx) => {
            const { canvasRenderingContext } = gtx;
            canvasRenderingContext.translate(-this.position.x, -this.position.y);
            /// mirror sprite and add the offset when direction looking other way
            if (this.direction.x >= 0) {
                canvasRenderingContext.scale(-1, 1);
            }
            this.spriteAnimator.render(canvasRenderingContext);
        }, true);
    }

    step(gctx: GameContext) {
        let hasSetAnimation = false;
        const { dt, spatialHasing } = gctx;
        this.spriteAnimator.update(dt);
        const objs = spatialHasing.query(this.position,);
        this.attackingTimeout -= dt;

        if (this.target && isDisposable(this.target) && this.target.shouldDispose) {
            this.target = null;
        }

        if (!this.target) {
            this.target = this.getNearestEnemy(objs);
        }

        if (!this.isAttacking) {

            if (this.target) {
                const directionToEnemy = this.target.position.clone().sub(this.position).normalize();
                const angleToEnemy = this.direction.angleTo(directionToEnemy);
                const rotationAmount = this.rotationSpeed * dt;
                const rotationAngle = Math.sign(angleToEnemy) * Math.min(Math.abs(angleToEnemy), rotationAmount);

                this.direction = this.direction.rotate(rotationAngle, false).normalize();
            } else {
                const directionToEnemy = new Vector(0, 0);
                const angleToEnemy = this.direction.angleTo(directionToEnemy);
                const rotationAmount = this.rotationSpeed * dt;
                const rotationAngle = Math.sign(angleToEnemy) * Math.min(Math.abs(angleToEnemy), rotationAmount);

                this.direction = this.direction.rotate(rotationAngle, false).normalize();
            }

            this.acceleration = this.direction.clone().scalar(4);
            this.velocity = this.calculateVelocity(gctx.dt);
            this.position = this.calculatePosition(gctx.dt);

        }

        if (this.target) {
            // Attacks if enemy is near
            if (this.attackingTimeout <= 0 && this.target.position.distanceTo(this.position) < 20) {
                this.attackingTimeout = this.attackTimeout;
                if (Math.random() > 0.5 && isDisposable(this.target)) {
                    this.spriteAnimator.playAnimation('a', true);
                    hasSetAnimation = true;
                    this.acceleration = new Vector(0, 0);
                    this.velocity = new Vector(0, 0);
                    // this.target.shouldDispose = true;
                    // this.target = null;
                }
            } else {
                // Retargets if enemy is far
                if (this.target.position.distanceTo(this.position) > 150) {
                    this.target = null;
                }
            }
        }


        if (!hasSetAnimation) {
            this.spriteAnimator.playAnimation('w', false);
        }
    }

    getNearestEnemy(objs: BaseObject[]) {
        const enemies: BaseObject[] = objs.filter((obj) => (obj as any).side !== undefined && (obj as any).side !== this.side);
        enemies.sort((a, b) => {
            const aDistance = a.position.distanceTo(this.position);
            const bDistance = b.position.distanceTo(this.position);
            return aDistance - bDistance;
        });
        return enemies[0];
    }

    get isAttacking() {
        return this.spriteAnimator.currentAnimation === 'a' && this.spriteAnimator.isPlayingAnimation && this.attackingTimeout > 0;
    }

}


export default Soldier;
