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
import { generateBloodExplotion } from "../ParticleUtils";
import Background from "@/objects/background";
import BaseObject from "@/objects/baseObject";
import { Rectangle, Square } from "@/objects/shapes";
import { archerSprites } from "./sprites";
import { buildArmySpritesWithSideColor } from "../spriteUtils";
import Arrow from "./arrow";
import ArmyUnit, { ATTACK_ANIMATION_ID, WALK_ANIMATION_ID } from "../armyUnit";
import { Target } from "../types";
import Cooldown from "@/objects/cooldown";
import RandomUtils from "@/utils/random";
import { CASTLE_ID } from "@/objects/castle/castle";

const ATTACK_RANGE = 800;
const OUT_OF_REACH_RANGE = 350;

const archerAttackSpriteFrames = [3, 4, 5, 6, 7,]

const archerSpriteSheetAlly = new PixelArtSpriteSheet(
    buildArmySpritesWithSideColor(archerSprites, 0)
);
const archermanSpriteSheetEnemy = new PixelArtSpriteSheet(
    buildArmySpritesWithSideColor(archerSprites, 1)
);

class Archer extends ArmyUnit {
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
            1
        );
        this.spriteAnimator.addAnimation(WALK_ANIMATION_ID, [0, 1, 2], 0.2);
        this.spriteAnimator.addAnimation(ATTACK_ANIMATION_ID, archerAttackSpriteFrames, 0.2);
        this.spriteAnimator.playAnimation(WALK_ANIMATION_ID, true);
        this.triggerAttackAnimationFrame = 4;
    }

    shouldDispose: boolean;

    step(gctx: GameContext) {
        const { dt } = gctx;
        let hasSetAnimation = false;
        this.beforeStep(gctx);

        if (this.target && isDisposable(this.target) && this.target.shouldDispose) {
            this.target = null;
        }

        this.fixTarget(gctx);

        if (!this.isAttacking) {

            this.adjustDirection(gctx.dt);
            const lookAt = this.target?.position.clone()
                .sub(this.position)
                .normalize() ?? new Vector(0, 0);
            // this.acceleration = lookAt.scalar(200);
            this.velocity = this.calculateVelocity(gctx.dt);
            this.position = this.calculatePosition(gctx.dt);
        }

        if (this.shouldAttack) {
            /// adds a little offset to the arrow position
            const arrowPositionOffset = new Vector(0, 1.5);
            const arrow = new Arrow(this.position.clone().add(arrowPositionOffset), this.direction.clone(), this.side);
            this.attack((gameContext) => {
                gameContext.objects.push(arrow);
            });
            hasSetAnimation = true;
        }

        if (!hasSetAnimation) {
            this.spriteAnimator.playAnimation("w", false);
        }
    }

    /// TODO remove?, not worth it.
    private adjustDirection(dt: number) {
        const lookAt = this.target?.position.clone()
            .sub(this.position)
            .normalize() ?? new Vector(0, 0);

        this.direction = lookAt;
    }

    private fixTarget(gameContext: GameContext) {
        const { spatialHashing } = gameContext;
        if (this.target && (this.target.id === CASTLE_ID || this.target.position.distanceTo(this.position) > OUT_OF_REACH_RANGE)) {
            this.target = null;
        }

        if (!this.target || this.target.id === CASTLE_ID) {
            const nearByObjs = spatialHashing.queryInRange(this.position, ATTACK_RANGE + 10);
            /// TODO fix types
            const nearByEnemies = nearByObjs.filter(obj => (obj as any).side !== undefined && (obj as any).side !== this.side);
            if (nearByEnemies.length > 0) {
                this.target = RandomUtils.getRandomValueOf(nearByEnemies) as Target;
            } else if (this.side === 1) {
                this.target = gameContext.objects.find(obj => obj.id === CASTLE_ID) as Target ?? null;
            }
        }
    }

    private getNearestEnemy(enemies: BaseObject[]) {
        enemies.sort((a, b) => {
            const aDistance = a.position.distanceTo(this.position);
            const bDistance = b.position.distanceTo(this.position);
            return aDistance - bDistance;
        });
        return enemies[0];
    }

    private get isAttacking() {
        return (
            this.spriteAnimator.currentAnimation === "a" &&
            this.spriteAnimator.isPlayingAnimation
        );
    }

    private get shouldAttack() {
        return this.target && this.canAttack() && this.target.position.distanceTo(this.position) < ATTACK_RANGE;
    }

    chooseTypeOfBloodstainWhenDying(background: Background): (inPosition: Vector) => void {
        return background.drawArcherBloodstain.bind(background);
    }
}

export default Archer;
